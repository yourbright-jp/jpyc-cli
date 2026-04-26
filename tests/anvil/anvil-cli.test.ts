import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPublicClient,
  formatEther,
  http,
  parseEther,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

import { createJpycCli } from '../../src/cli/index.js';

const RUN_ANVIL_TESTS = process.env.RUN_ANVIL_TESTS === '1';
const ANVIL_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const ANVIL_ACCOUNT = privateKeyToAccount(ANVIL_PRIVATE_KEY).address;
const RECEIVER = '0x000000000000000000000000000000000000bEEF' as Address;

function randomPort() {
  return 20_000 + Math.floor(Math.random() * 20_000);
}

async function waitForAnvil(rpcUrl: string) {
  const client = createPublicClient({ chain: foundry, transport: http(rpcUrl) });
  let lastError: unknown;
  for (let i = 0; i < 50; i += 1) {
    try {
      await client.getChainId();
      return client;
    } catch (error) {
      lastError = error;
      await delay(100);
    }
  }
  throw lastError;
}

async function startAnvil() {
  const availability = spawnSync('anvil', ['--version'], { encoding: 'utf8' });
  if (availability.error && 'code' in availability.error && availability.error.code === 'ENOENT') {
    throw new Error('Anvil binary is required for test:anvil. Install Foundry and ensure `anvil` is on PATH.');
  }
  if (availability.status !== 0) {
    throw new Error(`Unable to run anvil --version: ${availability.stderr || availability.error?.message || 'unknown error'}`);
  }

  const port = randomPort();
  const rpcUrl = `http://127.0.0.1:${port}`;
  const process = spawn('anvil', ['--host', '127.0.0.1', '--port', String(port), '--chain-id', '31337'], {
    stdio: 'pipe',
  });
  process.on('error', () => undefined);
  const publicClient = await waitForAnvil(rpcUrl);
  return { process, rpcUrl, publicClient };
}

async function stopAnvil(process: ChildProcessWithoutNullStreams | undefined) {
  if (!process || process.killed) return;
  process.kill('SIGTERM');
  await delay(100);
  if (!process.killed) process.kill('SIGKILL');
}

async function makeAnvilCliFixture(rpcUrl: string) {
  const homeDir = await mkdtemp(join(tmpdir(), 'jpyc-cli-anvil-'));
  const txRecorder = { broadcasts: [] as unknown[] };
  const cli = createJpycCli({
    homeDir,
    env: {
      JPYC_KEYSTORE_PASSWORD: 'test-password',
      JPYC_LOCAL_RPC_URL: rpcUrl,
      ANVIL_PRIVATE_KEY,
    },
    txRecorder,
  });

  async function run(args: string[]) {
    return cli.run([...args, '--output', 'json']);
  }

  async function runJson(args: string[]) {
    const result = await run(args);
    return { result, parsed: JSON.parse(result.stdout) };
  }

  return { homeDir, txRecorder, runJson, cleanup: () => rm(homeDir, { recursive: true, force: true }) };
}

async function writeStorageArtifact(homeDir: string) {
  const artifactPath = join(homeDir, 'Storage.json');
  await writeFile(
    artifactPath,
    JSON.stringify({
      abi: [
        {
          type: 'function',
          name: 'get',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ name: '', type: 'uint256' }],
        },
        {
          type: 'function',
          name: 'set',
          stateMutability: 'nonpayable',
          inputs: [{ name: 'value', type: 'uint256' }],
          outputs: [],
        },
      ],
      // Solidity equivalent:
      // contract Storage { uint256 public value; function get() external view returns (uint256) { return value; } function set(uint256 v) external { value = v; } }
      // This bytecode is intentionally checked in as test fixture data so the test does not require solc.
      bytecode:
        '0x6080604052348015600e575f80fd5b5061016d8061001c5f395ff3fe608060405234801561000f575f80fd5b506004361061003f575f3560e01c806360fe47b1146100435780636d4ce63c1461005f5780633fa4f2451461007d575b5f80fd5b61005d600480360381019061005891906100d3565b61009b565b005b6100676100a4565b604051610074919061010d565b60405180910390f35b6100856100aa565b604051610092919061010d565b60405180910390f35b805f8190555050565b5f5481565b5f5481565b5f80fd5b5f819050919050565b6100b2816100a0565b81146100bc575f80fd5b50565b5f813590506100cd816100a9565b92915050565b5f602082840312156100e8576100e761009c565b5b5f6100f5848285016100bf565b91505092915050565b610107816100a0565b82525050565b5f6020820190506101205f8301846100fe565b9291505056fea2646970667358221220d0f730fcb3ef8cb5445c04063bb6c1672f3b8886ef050d3f0c61f6f95f9d2f1a64736f6c63430008180033',
    }),
  );
  return artifactPath;
}

const describeAnvil = RUN_ANVIL_TESTS ? describe : describe.skip;

describeAnvil('JPYC CLI Anvil-backed command API', () => {
  let anvil: Awaited<ReturnType<typeof startAnvil>> | undefined;

  beforeAll(async () => {
    anvil = await startAnvil();
  }, 15_000);

  afterAll(async () => {
    await stopAnvil(anvil?.process);
  });

  it('imports an Anvil private key, derives its real address, and reads native balance from local chain', async () => {
    const fixture = await makeAnvilCliFixture(anvil!.rpcUrl);
    try {
      const imported = await fixture.runJson([
        'wallet',
        'import',
        '--id',
        'anvil0',
        '--from-private-key-env',
        'ANVIL_PRIVATE_KEY',
      ]);
      const balance = await fixture.runJson([
        'account',
        'balance',
        '--wallet',
        'anvil0',
        '--network',
        'local',
        '--tokens',
        'native',
      ]);

      expect(imported.result.exitCode).toBe(0);
      expect(imported.parsed.wallet.address).toBe(ANVIL_ACCOUNT);
      expect(balance.result.exitCode).toBe(0);
      expect(balance.parsed.balances[0]).toMatchObject({ symbol: 'ETH', type: 'native' });
      expect(Number(balance.parsed.balances[0].amount)).toBeGreaterThan(0);
    } finally {
      await fixture.cleanup();
    }
  });

  it('dry-runs native transfer without changing receiver balance, then broadcasts with --yes', async () => {
    const fixture = await makeAnvilCliFixture(anvil!.rpcUrl);
    try {
      await fixture.runJson(['wallet', 'import', '--id', 'anvil0', '--from-private-key-env', 'ANVIL_PRIVATE_KEY']);
      const before = await anvil!.publicClient.getBalance({ address: RECEIVER });

      const dryRun = await fixture.runJson([
        'transfer',
        'send',
        '--network',
        'local',
        '--from',
        'anvil0',
        '--to',
        RECEIVER,
        '--amount',
        '1',
        '--token',
        'native',
        '--dry-run',
      ]);
      const afterDryRun = await anvil!.publicClient.getBalance({ address: RECEIVER });
      const sent = await fixture.runJson([
        'transfer',
        'send',
        '--network',
        'local',
        '--from',
        'anvil0',
        '--to',
        RECEIVER,
        '--amount',
        '1',
        '--token',
        'native',
        '--yes',
      ]);
      const afterSend = await anvil!.publicClient.getBalance({ address: RECEIVER });

      expect(dryRun.result.exitCode).toBe(0);
      expect(dryRun.parsed.broadcast).toBe(false);
      expect(afterDryRun).toBe(before);
      expect(sent.result.exitCode).toBe(0);
      expect(sent.parsed.broadcast).toBe(true);
      expect(sent.parsed.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(formatEther(afterSend - before)).toBe('1');
    } finally {
      await fixture.cleanup();
    }
  });

  it('deploys a contract to Anvil, reads it, writes it with --yes, and verifies updated state', async () => {
    const fixture = await makeAnvilCliFixture(anvil!.rpcUrl);
    try {
      await fixture.runJson(['wallet', 'import', '--id', 'anvil0', '--from-private-key-env', 'ANVIL_PRIVATE_KEY']);
      const artifactPath = await writeStorageArtifact(fixture.homeDir);

      const dryRunDeploy = await fixture.runJson([
        'contract',
        'deploy',
        '--network',
        'local',
        '--wallet',
        'anvil0',
        '--artifact',
        artifactPath,
        '--constructor-args',
        '[]',
        '--dry-run',
      ]);
      const deployed = await fixture.runJson([
        'contract',
        'deploy',
        '--network',
        'local',
        '--wallet',
        'anvil0',
        '--artifact',
        artifactPath,
        '--constructor-args',
        '[]',
        '--yes',
      ]);
      const contractAddress = deployed.parsed.contractAddress as Address;
      const initialRead = await fixture.runJson([
        'contract',
        'read',
        '--network',
        'local',
        '--address',
        contractAddress,
        '--abi',
        artifactPath,
        '--function',
        'get',
        '--args',
        '[]',
      ]);
      const write = await fixture.runJson([
        'contract',
        'write',
        '--network',
        'local',
        '--wallet',
        'anvil0',
        '--address',
        contractAddress,
        '--abi',
        artifactPath,
        '--function',
        'set',
        '--args',
        '[42]',
        '--yes',
      ]);
      const afterWrite = await fixture.runJson([
        'contract',
        'read',
        '--network',
        'local',
        '--address',
        contractAddress,
        '--abi',
        artifactPath,
        '--function',
        'get',
        '--args',
        '[]',
      ]);

      expect(dryRunDeploy.result.exitCode).toBe(0);
      expect(dryRunDeploy.parsed.broadcast).toBe(false);
      expect(deployed.result.exitCode).toBe(0);
      expect(contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(initialRead.parsed.result).toBe('0');
      expect(write.parsed.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(afterWrite.parsed.result).toBe('42');
    } finally {
      await fixture.cleanup();
    }
  });
});

describe('JPYC CLI Anvil test configuration', () => {
  it('documents that Anvil-backed tests are opt-in and require RUN_ANVIL_TESTS=1', () => {
    expect(RUN_ANVIL_TESTS).toBe(process.env.RUN_ANVIL_TESTS === '1');
  });
});
