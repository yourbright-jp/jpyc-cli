import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterAll, describe, expect, it } from 'vitest';
import { createPublicClient, formatUnits, http, parseUnits, type Address } from 'viem';

import { createJpycCli } from '../../src/cli/index.js';

const RUN_FORK_TESTS = process.env.RUN_ANVIL_FORK_TESTS === '1';

const JPYC_CONTRACT_ADDRESS = '0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29' as const;
const JPYC_ISSUER_ADDRESS = '0x8549e82239a88f463ab6e55ad1895b629a00def3' as const;
const JPYC_REDEEM_ADDRESS = '0xb808af91bdc577bfb3f9c91470f3286dd076e5c1' as const;

const INSECURE_ANVIL_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const ANVIL_ADDRESS = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266' as const;
const RECEIVER = '0x000000000000000000000000000000000000bEEF' as Address;

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

async function startFork(target: ForkTarget) {
  assertAnvilAvailable();
  const forkUrl: string | undefined = process.env[target.rpcEnv];
  if (!forkUrl) {
    throw new Error(`${target.rpcEnv} is required to run the ${target.name} JPYC fork test.`);
  }

  const port = randomPort();
  const rpcUrl = `http://127.0.0.1:${port}`;
  const child = spawn(
    'anvil',
    ['--host', '127.0.0.1', '--port', String(port), '--fork-url', forkUrl, '--chain-id', String(target.chainId)],
    { stdio: 'pipe' },
  );
  child.on('error', () => undefined);
  const publicClient = await waitForFork(rpcUrl, target.chainId);
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
    const result = await cli.run([...args, '--output', 'json']);
    return { result, parsed: JSON.parse(result.stdout) };
  }

  return { homeDir, runJson, cleanup: () => rm(homeDir, { recursive: true, force: true }) };
}

async function readJpycBalance(publicClient: ReturnType<typeof createPublicClient>, address: Address) {
  return publicClient.readContract({
    address: JPYC_CONTRACT_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address],
  }) as Promise<bigint>;
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
        const configInit = await fixture.runJson(['config', 'init']);
        const networks = await fixture.runJson(['config', 'networks']);
        const tokens = await fixture.runJson(['config', 'tokens', '--network', target.id]);
        const walletImport = await fixture.runJson([
          'wallet',
          'import',
          '--id',
          'fork-signer',
          '--from-private-key-env',
          'INSECURE_ANVIL_PRIVATE_KEY',
        ]);
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

        expect(schemaList.parsed.schemas).toEqual(expect.arrayContaining(['wallet.import', 'account.balance', 'transfer.send', 'contract.read']));
        expect(transferSchema.parsed.safety).toMatchObject({
          requiresDryRunByDefault: true,
          requiresYesForBroadcast: true,
          printsPrivateKey: false,
        });
        expect(configInit.parsed.ok).toBe(true);
        expect(networks.parsed.networks).toEqual(expect.arrayContaining([expect.objectContaining({ name: target.id, chainId: target.chainId })]));
        expect(tokens.parsed.tokens).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ symbol: 'JPYC', type: 'erc20', decimals: 18, address: JPYC_CONTRACT_ADDRESS }),
          ]),
        );
        expect(walletImport.parsed).toMatchObject({ ok: true, secretPrinted: false });
        expect(walletImport.parsed.wallet.address).toBe(ANVIL_ADDRESS);
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
        expect(transferPlan.parsed.plan).toMatchObject({
          network: target.id,
          chainId: target.chainId,
          to: RECEIVER,
          token: 'JPYC',
          tokenAddress: JPYC_CONTRACT_ADDRESS,
        });
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
