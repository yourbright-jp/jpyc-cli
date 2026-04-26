import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach } from 'vitest';

import { createJpycCli } from '../../src/cli/index.js';

export type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type MockRpc = {
  chainId?: number;
  nativeBalance?: string;
  tokenBalances?: Record<string, string>;
  nonce?: number;
  estimatedGas?: string;
  readResult?: unknown;
  txHash?: string;
};

export type MockTxRecorder = {
  broadcasts: unknown[];
};

export async function makeCliFixture(options: { env?: Record<string, string>; rpc?: MockRpc } = {}) {
  const homeDir = await mkdtemp(join(tmpdir(), 'jpyc-cli-test-'));
  const txRecorder: MockTxRecorder = { broadcasts: [] };

  const cli = createJpycCli({
    homeDir,
    env: {
      JPYC_KEYSTORE_PASSWORD: 'test-password',
      JPYC_POLYGON_RPC_URL: 'https://rpc.example.invalid',
      ...options.env,
    },
    rpc: {
      chainId: 137,
      nativeBalance: '1.25',
      tokenBalances: {
        JPYC: '10000',
      },
      nonce: 7,
      estimatedGas: '65000',
      readResult: '10000',
      txHash: '0xhash000000000000000000000000000000000000000000000000000000000000',
      ...options.rpc,
    },
    txRecorder,
  });

  async function run(args: string[]): Promise<CliResult> {
    return cli.run(args);
  }

  async function runJson(args: string[]) {
    const result = await run([...args, '--output', 'json']);
    const parsed = JSON.parse(result.stdout);
    return { result, parsed };
  }

  afterEach(async () => {
    await rm(homeDir, { recursive: true, force: true });
  });

  return { homeDir, txRecorder, run, runJson };
}

export const validAddress = '0xabc0000000000000000000000000000000000000';
export const validContract = '0xdef0000000000000000000000000000000000000';
