import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterAll, describe, expect, it } from 'vitest';
import {
  createPublicClient,
  encodeAbiParameters,
  encodeFunctionData,
  formatUnits,
  http,
  keccak256,
  padHex,
  parseEther,
  parseUnits,
  toHex,
  type Address,
} from 'viem';

import { createJpycCli } from '../../src/cli/index.js';

const RUN_FORK_TESTS = process.env.RUN_ANVIL_FORK_TESTS === '1';

const JPYC_CONTRACT_ADDRESS = '0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29' as const;
const JPYC_ISSUER_ADDRESS = '0x8549e82239a88f463ab6e55ad1895b629a00def3' as const;
const JPYC_REDEEM_ADDRESS = '0xb808af91bdc577bfb3f9c91470f3286dd076e5c1' as const;

const INSECURE_ANVIL_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const ANVIL_ADDRESS = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266' as const;
const RECEIVER = '0x000000000000000000000000000000000000bEEF' as Address;
const NATIVE_RECEIVER = '0x000000000000000000000000000000000000CAFE' as Address;
const TEST_DEPLOY_INIT_CODE = '0x600a600c600039600a6000f3602a60005260206000f3' as const;

const ERC20_ABI = [
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

type ForkTarget = {
  id: 'ethereum' | 'polygon' | 'avalanche';
  name: string;
  chainId: number;
  rpcEnv: string;
  cliRpcEnv: string;
  nativeSymbol: 'ETH' | 'POL' | 'AVAX';
};

const FORK_TARGETS: ForkTarget[] = [
  {
    id: 'ethereum',
    name: 'Ethereum mainnet',
    chainId: 1,
    rpcEnv: 'JPYC_ETHEREUM_FORK_RPC_URL',
    cliRpcEnv: 'JPYC_ETHEREUM_RPC_URL',
    nativeSymbol: 'ETH',
  },
  {
    id: 'polygon',
    name: 'Polygon',
    chainId: 137,
    rpcEnv: 'JPYC_POLYGON_FORK_RPC_URL',
    cliRpcEnv: 'JPYC_POLYGON_RPC_URL',
    nativeSymbol: 'POL',
  },
  {
    id: 'avalanche',
    name: 'Avalanche C-Chain',
    chainId: 43114,
    rpcEnv: 'JPYC_AVALANCHE_FORK_RPC_URL',
    cliRpcEnv: 'JPYC_AVALANCHE_RPC_URL',
    nativeSymbol: 'AVAX',
  },
];

function randomPort() {
  return 25_000 + Math.floor(Math.random() * 20_000);
}

function assertAnvilAvailable() {
  const availability = spawnSync('anvil', ['--version'], { encoding: 'utf8' });
  if (availability.error && 'code' in availability.error && availability.error.code === 'ENOENT') {
    throw new Error('Anvil binary is required for fork tests. Install Foundry and ensure `anvil` is on PATH.');
  }
  if (availability.status !== 0) {
    throw new Error(`Unable to run anvil --version: ${availability.stderr || availability.error?.message || 'unknown error'}`);
  }
}

async function waitForFork(rpcUrl: string, chainId: number) {
  const client = createPublicClient({ transport: http(rpcUrl) });
  let lastError: unknown;
  for (let i = 0; i < 120; i += 1) {
    try {
      const actualChainId = await client.getChainId();
      if (actualChainId !== chainId) {
        throw new Error(`fork chain id mismatch: expected=${chainId} actual=${actualChainId}`);
      }
      const bytecode = await client.getBytecode({ address: JPYC_CONTRACT_ADDRESS });
      if (!bytecode || bytecode === '0x') {
        throw new Error(`JPYC bytecode missing at ${JPYC_CONTRACT_ADDRESS}`);
      }
      return client;
    } catch (error) {
      lastError = error;
      await delay(250);
    }
  }
  throw lastError;
}

function redactRpcUrl(value: string) {
  return value.replace(/(g\.alchemy\.com\/v2\/)[^\s/?#]+/g, '$1***');
}

async function startFork(target: ForkTarget) {
  assertAnvilAvailable();
  const forkUrl: string | undefined = process.env[target.rpcEnv];
  if (!forkUrl) {
    throw new Error(`${target.rpcEnv} is required to run the ${target.name} JPYC fork test.`);
  }

  const port = randomPort();
  const rpcUrl = `http://127.0.0.1:${port}`;
  if (process.env.JPYC_FORK_TEST_DEBUG === '1') console.error(`[${target.id}] starting anvil fork ${redactRpcUrl(forkUrl)}`);
  const child = spawn(
    'anvil',
    ['--host', '127.0.0.1', '--port', String(port), '--fork-url', forkUrl, '--chain-id', String(target.chainId)],
    { stdio: 'pipe' },
  );
  child.on('error', () => undefined);
  child.stderr.on('data', (chunk) => {
    if (process.env.JPYC_FORK_TEST_DEBUG === '1') console.error(`[${target.id}] anvil ${String(chunk).trim()}`);
  });
  const publicClient = await waitForFork(rpcUrl, target.chainId);
  if (process.env.JPYC_FORK_TEST_DEBUG === '1') console.error(`[${target.id}] anvil fork ready ${rpcUrl}`);
  return { process: child, rpcUrl, publicClient };
}

async function stopFork(process: ChildProcessWithoutNullStreams | undefined) {
  if (!process || process.killed) return;
  process.kill('SIGTERM');
  await delay(100);
  if (!process.killed) process.kill('SIGKILL');
}

async function makeForkCliFixture(target: ForkTarget, rpcUrl: string) {
  const homeDir = await mkdtemp(join(tmpdir(), `jpyc-cli-${target.id}-fork-`));
  const cli = createJpycCli({
    homeDir,
    env: {
      JPYC_KEYSTORE_PASSWORD: 'test-password',
      INSECURE_ANVIL_PRIVATE_KEY,
      [target.cliRpcEnv]: rpcUrl,
    },
  });

  async function runJson(args: string[]) {
    if (process.env.JPYC_FORK_TEST_DEBUG === '1') console.error(`[${target.id}] cli ${args.join(' ')}`);
    const result = await cli.run([...args, '--output', 'json']);
    if (process.env.JPYC_FORK_TEST_DEBUG === '1') console.error(`[${target.id}] cli done ${args.join(' ')} exit=${result.exitCode}`);
    return { result, parsed: JSON.parse(result.stdout) };
  }

  async function runJsonInput(command: string, input: unknown) {
    if (process.env.JPYC_FORK_TEST_DEBUG === '1') console.error(`[${target.id}] cli ${command} --json-input`);
    const result = await cli.run([command, '--json-input', JSON.stringify(input), '--output', 'json']);
    if (process.env.JPYC_FORK_TEST_DEBUG === '1') console.error(`[${target.id}] cli done ${command} --json-input exit=${result.exitCode}`);
    return { result, parsed: JSON.parse(result.stdout) };
  }

  return { homeDir, runJson, runJsonInput, cleanup: () => rm(homeDir, { recursive: true, force: true }) };
}

async function readJpycBalance(publicClient: ReturnType<typeof createPublicClient>, address: Address) {
  return publicClient.readContract({
    address: JPYC_CONTRACT_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address],
  }) as Promise<bigint>;
}

function balanceStorageSlot(address: Address, mappingSlot: bigint) {
  return keccak256(
    encodeAbiParameters(
      [
        { name: 'account', type: 'address' },
        { name: 'slot', type: 'uint256' },
      ],
      [address, mappingSlot],
    ),
  );
}

async function seedJpycBalanceOnFork(params: {
  publicClient: ReturnType<typeof createPublicClient>;
  rpcUrl: string;
  holder: Address;
  amount: bigint;
}) {
  const { publicClient, rpcUrl, holder, amount } = params;
  const previousBalance = await readJpycBalance(publicClient, holder);

  await publicClient.request({
    method: 'anvil_impersonateAccount',
    params: [JPYC_ISSUER_ADDRESS],
  });
  try {
    await publicClient.request({
      method: 'anvil_setBalance',
      params: [JPYC_ISSUER_ADDRESS, toHex(parseEther('10'))],
    });
    const txHash = await publicClient.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: JPYC_ISSUER_ADDRESS,
          to: JPYC_CONTRACT_ADDRESS,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [holder, amount],
          }),
        },
      ],
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
    const currentBalance = await readJpycBalance(publicClient, holder);
    if (currentBalance >= previousBalance + amount) {
      return { seedMethod: 'impersonated-transfer', txHash, previousBalance };
    }
  } finally {
    await publicClient.request({
      method: 'anvil_stopImpersonatingAccount',
      params: [JPYC_ISSUER_ADDRESS],
    });
  }

  throw new Error(`Unable to seed JPYC balance for ${holder} on fork ${rpcUrl}; impersonated transfer from JPYC issuer failed`);
}

const describeForks = RUN_FORK_TESTS ? describe : describe.skip;

describeForks('JPYC CLI fork-backed API tests against real JPYC contracts', () => {
  const forks: Partial<Record<ForkTarget['id'], Awaited<ReturnType<typeof startFork>>>> = {};

  afterAll(async () => {
    await Promise.all(Object.values(forks).map((fork) => stopFork(fork?.process)));
  });

  for (const target of FORK_TARGETS) {
    it(`covers wallet/account/config/schema/contract/transfer commands on ${target.name} fork using the canonical JPYC address`, async () => {
      forks[target.id] = await startFork(target);
      const fork = forks[target.id]!;
      const fixture = await makeForkCliFixture(target, fork.rpcUrl);
      try {
        const bytecode = await fork.publicClient.getBytecode({ address: JPYC_CONTRACT_ADDRESS });
        expect(bytecode).toMatch(/^0x[0-9a-fA-F]+$/);
        expect(bytecode).not.toBe('0x');

        const schemaList = await fixture.runJson(['schema', 'list']);
        const transferSchema = await fixture.runJson(['schema', 'transfer.send']);
        const walletCreateSchema = await fixture.runJson(['schema', 'wallet.create']);
        const contractDeploySchema = await fixture.runJson(['schema', 'contract.deploy']);
        const configInit = await fixture.runJson(['config', 'init']);
        const configGetBeforeSet = await fixture.runJson(['config', 'get', `networks.${target.id}.rpcUrlEnv`]);
        const configSetRpcEnv = await fixture.runJson(['config', 'set', `networks.${target.id}.rpcUrlEnv`, target.cliRpcEnv]);
        const configGetAfterSet = await fixture.runJson(['config', 'get', `networks.${target.id}.rpcUrlEnv`]);
        const networks = await fixture.runJson(['config', 'networks']);
        const tokens = await fixture.runJson(['config', 'tokens', '--network', target.id]);
        const walletCreate = await fixture.runJson(['wallet', 'create', '--id', 'generated']);
        const walletShowGenerated = await fixture.runJson(['wallet', 'show', '--id', 'generated']);
        const walletExportWithoutYes = await fixture.runJson(['wallet', 'export-private-key', '--id', 'generated']);
        const walletImport = await fixture.runJson([
          'wallet',
          'import',
          '--id',
          'fork-signer',
          '--from-private-key-env',
          'INSECURE_ANVIL_PRIVATE_KEY',
        ]);
        const walletList = await fixture.runJson(['wallet', 'list']);
        const walletShowSigner = await fixture.runJson(['wallet', 'show', '--id', 'fork-signer']);
        const walletExportSigner = await fixture.runJson(['wallet', 'export-private-key', '--id', 'fork-signer', '--yes']);
        const accountAddress = await fixture.runJson(['account', 'address', '--wallet', 'fork-signer']);
        const accountBalance = await fixture.runJson([
          'account',
          'balance',
          '--wallet',
          'fork-signer',
          '--network',
          target.id,
          '--tokens',
          'native,jpyc',
        ]);
        const nonce = await fixture.runJson(['account', 'nonce', '--wallet', 'fork-signer', '--network', target.id]);
        const symbol = await fixture.runJson([
          'contract',
          'read',
          '--network',
          target.id,
          '--address',
          JPYC_CONTRACT_ADDRESS,
          '--abi-json',
          JSON.stringify(ERC20_ABI),
          '--function',
          'symbol',
          '--args',
          '[]',
        ]);
        const decimals = await fixture.runJson([
          'contract',
          'read',
          '--network',
          target.id,
          '--address',
          JPYC_CONTRACT_ADDRESS,
          '--abi-json',
          JSON.stringify(ERC20_ABI),
          '--function',
          'decimals',
          '--args',
          '[]',
        ]);
        const balanceOfIssuer = await fixture.runJson([
          'contract',
          'read',
          '--network',
          target.id,
          '--address',
          JPYC_CONTRACT_ADDRESS,
          '--abi-json',
          JSON.stringify(ERC20_ABI),
          '--function',
          'balanceOf',
          '--args',
          JSON.stringify([JPYC_ISSUER_ADDRESS]),
        ]);
        const missingWalletBalance = await fixture.runJson(['account', 'balance', '--wallet', 'missing', '--network', target.id]);
        const invalidSchema = await fixture.runJson(['schema', 'does.not.exist']);

        const deployDryRun = await fixture.runJson([
          'contract',
          'deploy',
          '--network',
          target.id,
          '--wallet',
          'fork-signer',
          '--bytecode',
          TEST_DEPLOY_INIT_CODE,
          '--dry-run',
        ]);
        const deployWithoutYes = await fixture.runJson([
          'contract',
          'deploy',
          '--network',
          target.id,
          '--wallet',
          'fork-signer',
          '--bytecode',
          TEST_DEPLOY_INIT_CODE,
        ]);
        const deployActual = await fixture.runJson([
          'contract',
          'deploy',
          '--network',
          target.id,
          '--wallet',
          'fork-signer',
          '--bytecode',
          TEST_DEPLOY_INIT_CODE,
          '--yes',
        ]);
        const deployedBytecode = await fork.publicClient.getBytecode({ address: deployActual.parsed.contractAddress });

        const seededAmount = parseUnits('100', 18);
        const seedResult = await seedJpycBalanceOnFork({
          publicClient: fork.publicClient,
          rpcUrl: fork.rpcUrl,
          holder: ANVIL_ADDRESS,
          amount: seededAmount,
        });
        expect(seedResult.seedMethod).toMatch(/^(storage-slot|impersonated-transfer)$/);

        const receiverBalanceBefore = await readJpycBalance(fork.publicClient, RECEIVER);
        const transferPlan = await fixture.runJson([
          'transfer',
          'plan',
          '--network',
          target.id,
          '--from',
          'fork-signer',
          '--to',
          RECEIVER,
          '--amount',
          '1',
          '--token',
          'jpyc',
        ]);
        const transferEstimate = await fixture.runJson([
          'transfer',
          'estimate',
          '--network',
          target.id,
          '--from',
          'fork-signer',
          '--to',
          RECEIVER,
          '--amount',
          '1',
          '--token',
          'jpyc',
        ]);
        const jsonInputPlan = await fixture.runJsonInput('transfer.plan', {
          network: target.id,
          from: 'fork-signer',
          to: RECEIVER,
          amount: '1',
          token: 'jpyc',
        });
        const nativeReceiverBefore = await fork.publicClient.getBalance({ address: NATIVE_RECEIVER });
        const nativeTransferDryRun = await fixture.runJson([
          'transfer',
          'send',
          '--network',
          target.id,
          '--from',
          'fork-signer',
          '--to',
          NATIVE_RECEIVER,
          '--amount',
          '0.001',
          '--token',
          'native',
          '--dry-run',
        ]);
        const nativeReceiverAfterDryRun = await fork.publicClient.getBalance({ address: NATIVE_RECEIVER });
        const nativeTransferActual = await fixture.runJson([
          'transfer',
          'send',
          '--network',
          target.id,
          '--from',
          'fork-signer',
          '--to',
          NATIVE_RECEIVER,
          '--amount',
          '0.001',
          '--token',
          'native',
          '--yes',
        ]);
        const nativeReceiverAfterTransfer = await fork.publicClient.getBalance({ address: NATIVE_RECEIVER });
        const transferDryRun = await fixture.runJson([
          'transfer',
          'send',
          '--network',
          target.id,
          '--from',
          'fork-signer',
          '--to',
          RECEIVER,
          '--amount',
          '1',
          '--token',
          'jpyc',
          '--dry-run',
        ]);
        const transferWithoutYes = await fixture.runJson([
          'transfer',
          'send',
          '--network',
          target.id,
          '--from',
          'fork-signer',
          '--to',
          RECEIVER,
          '--amount',
          '1',
          '--token',
          'jpyc',
        ]);
        const contractWriteDryRun = await fixture.runJson([
          'contract',
          'write',
          '--network',
          target.id,
          '--wallet',
          'fork-signer',
          '--address',
          JPYC_CONTRACT_ADDRESS,
          '--abi-json',
          JSON.stringify(ERC20_ABI),
          '--function',
          'transfer',
          '--args',
          JSON.stringify([RECEIVER, parseUnits('1', 18).toString()]),
          '--dry-run',
        ]);
        const receiverBalanceAfterDryRuns = await readJpycBalance(fork.publicClient, RECEIVER);
        const actualTransfer = await fixture.runJson([
          'transfer',
          'send',
          '--network',
          target.id,
          '--from',
          'fork-signer',
          '--to',
          RECEIVER,
          '--amount',
          '1',
          '--token',
          'jpyc',
          '--yes',
        ]);
        const receiverBalanceAfterTransfer = await readJpycBalance(fork.publicClient, RECEIVER);
        const contractWriteActual = await fixture.runJson([
          'contract',
          'write',
          '--network',
          target.id,
          '--wallet',
          'fork-signer',
          '--address',
          JPYC_CONTRACT_ADDRESS,
          '--abi-json',
          JSON.stringify(ERC20_ABI),
          '--function',
          'transfer',
          '--args',
          JSON.stringify([RECEIVER, parseUnits('1', 18).toString()]),
          '--yes',
        ]);
        const receiverBalanceAfterContractWrite = await readJpycBalance(fork.publicClient, RECEIVER);
        const signerBalanceAfterContractWrite = await readJpycBalance(fork.publicClient, ANVIL_ADDRESS);

        expect(schemaList.parsed.schemas).toEqual(expect.arrayContaining(['wallet.import', 'account.balance', 'transfer.send', 'contract.read']));
        expect(transferSchema.parsed.safety).toMatchObject({
          requiresDryRunByDefault: true,
          requiresYesForBroadcast: true,
          printsPrivateKey: false,
        });
        expect(walletCreateSchema.parsed.command).toBe('wallet.create');
        expect(walletCreateSchema.parsed.safety).toMatchObject({ printsPrivateKey: false });
        expect(contractDeploySchema.parsed.command).toBe('contract.deploy');
        expect(contractDeploySchema.parsed.safety).toMatchObject({ requiresYesForBroadcast: true });
        expect(configInit.parsed.ok).toBe(true);
        expect(configGetBeforeSet.parsed.value).toBe(target.cliRpcEnv);
        expect(configSetRpcEnv.parsed).toMatchObject({ ok: true, key: `networks.${target.id}.rpcUrlEnv`, value: target.cliRpcEnv });
        expect(configGetAfterSet.parsed.value).toBe(target.cliRpcEnv);
        expect(networks.parsed.networks).toEqual(expect.arrayContaining([expect.objectContaining({ name: target.id, chainId: target.chainId })]));
        expect(tokens.parsed.tokens).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ symbol: 'JPYC', type: 'erc20', decimals: 18, address: JPYC_CONTRACT_ADDRESS }),
          ]),
        );
        expect(walletCreate.parsed).toMatchObject({ ok: true, secretPrinted: false });
        expect(walletCreate.parsed.wallet).toMatchObject({ id: 'generated' });
        expect(walletCreate.parsed.wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(walletCreate.result.stdout).not.toContain('privateKey');
        expect(walletShowGenerated.parsed.wallet).toMatchObject({ id: 'generated', address: walletCreate.parsed.wallet.address });
        expect(walletShowGenerated.parsed.wallet).not.toHaveProperty('privateKey');
        expect(walletExportWithoutYes.result.exitCode).toBe(8);
        expect(walletExportWithoutYes.parsed.error.code).toBe('PRIVATE_KEY_EXPORT_REQUIRES_YES');
        expect(walletImport.parsed).toMatchObject({ ok: true, secretPrinted: false });
        expect(walletImport.parsed.wallet.address).toBe(ANVIL_ADDRESS);
        expect(walletList.parsed.wallets).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: 'generated', address: walletCreate.parsed.wallet.address }),
            expect.objectContaining({ id: 'fork-signer', address: ANVIL_ADDRESS }),
          ]),
        );
        expect(walletShowSigner.parsed.wallet).toMatchObject({ id: 'fork-signer', address: ANVIL_ADDRESS });
        expect(walletShowSigner.parsed.wallet).not.toHaveProperty('privateKey');
        expect(walletExportSigner.parsed.privateKey).toBe(INSECURE_ANVIL_PRIVATE_KEY);
        expect(accountAddress.parsed.address).toBe(ANVIL_ADDRESS);
        expect(accountBalance.parsed.balances).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ symbol: target.nativeSymbol, type: 'native' }),
            expect.objectContaining({ symbol: 'JPYC', type: 'erc20', contract: JPYC_CONTRACT_ADDRESS }),
          ]),
        );
        expect(Number(nonce.parsed.nonce)).toBeGreaterThanOrEqual(0);
        expect(symbol.parsed.result).toBe('JPYC');
        expect(decimals.parsed.result).toBe('18');
        expect(BigInt(balanceOfIssuer.parsed.result)).toBeGreaterThanOrEqual(0n);
        expect(missingWalletBalance.result.exitCode).toBe(4);
        expect(missingWalletBalance.parsed.error.code).toBe('WALLET_NOT_FOUND');
        expect(invalidSchema.result.exitCode).toBe(2);
        expect(invalidSchema.parsed.error.code).toBe('SCHEMA_NOT_FOUND');
        expect(deployDryRun.parsed).toMatchObject({ ok: true, command: 'contract.deploy', mode: 'dry-run', broadcast: false });
        expect(deployWithoutYes.result.exitCode).toBe(8);
        expect(deployWithoutYes.parsed.error.code).toBe('USER_CONFIRMATION_REQUIRED');
        expect(deployActual.parsed).toMatchObject({ ok: true, command: 'contract.deploy', broadcast: true });
        expect(deployActual.parsed.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        expect(deployActual.parsed.contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(deployedBytecode).toMatch(/^0x[0-9a-fA-F]+$/);
        expect(deployedBytecode).not.toBe('0x');
        expect(transferPlan.parsed.plan).toMatchObject({
          network: target.id,
          chainId: target.chainId,
          to: RECEIVER,
          token: 'JPYC',
          tokenAddress: JPYC_CONTRACT_ADDRESS,
        });
        expect(transferEstimate.parsed).toMatchObject({ ok: true, command: 'transfer.estimate' });
        expect(BigInt(transferEstimate.parsed.estimate.gas)).toBeGreaterThan(0n);
        expect(jsonInputPlan.parsed.plan).toMatchObject({ network: target.id, to: RECEIVER, token: 'JPYC' });
        expect(nativeTransferDryRun.parsed).toMatchObject({
          ok: true,
          command: 'transfer.send',
          mode: 'dry-run',
          broadcast: false,
          token: { symbol: target.nativeSymbol, type: 'native' },
        });
        expect(nativeReceiverAfterDryRun - nativeReceiverBefore).toBe(0n);
        expect(nativeTransferActual.parsed).toMatchObject({
          ok: true,
          command: 'transfer.send',
          broadcast: true,
          token: { symbol: target.nativeSymbol, type: 'native' },
        });
        expect(nativeTransferActual.parsed.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        expect(formatUnits(nativeReceiverAfterTransfer - nativeReceiverBefore, 18)).toBe('0.001');
        expect(transferDryRun.parsed).toMatchObject({
          ok: true,
          command: 'transfer.send',
          mode: 'dry-run',
          broadcast: false,
          token: {
            symbol: 'JPYC',
            address: JPYC_CONTRACT_ADDRESS,
          },
        });
        expect(transferWithoutYes.result.exitCode).toBe(8);
        expect(transferWithoutYes.parsed.error.code).toBe('USER_CONFIRMATION_REQUIRED');
        expect(contractWriteDryRun.parsed).toMatchObject({
          ok: true,
          command: 'contract.write',
          mode: 'dry-run',
          broadcast: false,
          tx: {
            network: target.id,
            chainId: target.chainId,
            to: JPYC_CONTRACT_ADDRESS,
          },
        });
        expect(formatUnits(receiverBalanceAfterDryRuns - receiverBalanceBefore, 18)).toBe('0');
        expect(actualTransfer.result.exitCode).toBe(0);
        expect(actualTransfer.parsed).toMatchObject({
          ok: true,
          command: 'transfer.send',
          broadcast: true,
          token: {
            symbol: 'JPYC',
            address: JPYC_CONTRACT_ADDRESS,
          },
        });
        expect(actualTransfer.parsed.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        expect(formatUnits(receiverBalanceAfterTransfer - receiverBalanceBefore, 18)).toBe('1');
        expect(contractWriteActual.parsed).toMatchObject({ ok: true, command: 'contract.write', broadcast: true });
        expect(contractWriteActual.parsed.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        expect(formatUnits(receiverBalanceAfterContractWrite - receiverBalanceBefore, 18)).toBe('2');
        expect(formatUnits(seededAmount - signerBalanceAfterContractWrite, 18)).toBe('2');
      } finally {
        await fixture.cleanup();
      }
    }, 90_000);
  }
});

describe('JPYC CLI Anvil fork test configuration', () => {
  it('keeps only fork-backed command tests and requires RPC URLs for Ethereum, Polygon, and Avalanche', () => {
    expect(RUN_FORK_TESTS).toBe(process.env.RUN_ANVIL_FORK_TESTS === '1');
    expect(FORK_TARGETS.map((target) => target.rpcEnv)).toEqual([
      'JPYC_ETHEREUM_FORK_RPC_URL',
      'JPYC_POLYGON_FORK_RPC_URL',
      'JPYC_AVALANCHE_FORK_RPC_URL',
    ]);
    expect(FORK_TARGETS.map((target) => target.cliRpcEnv)).toEqual([
      'JPYC_ETHEREUM_RPC_URL',
      'JPYC_POLYGON_RPC_URL',
      'JPYC_AVALANCHE_RPC_URL',
    ]);
    expect(new Set(FORK_TARGETS.map(() => JPYC_CONTRACT_ADDRESS)).size).toBe(1);
  });
});
