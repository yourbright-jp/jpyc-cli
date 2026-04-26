import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createJpycCli } from '../src/cli/index.js';

describe('wallet store error handling', () => {
  it('fails closed and preserves the store when wallets.json is invalid JSON', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'jpyc-cli-wallet-store-'));
    const walletsPath = join(homeDir, 'wallets.json');
    await mkdir(homeDir, { recursive: true });
    await writeFile(walletsPath, '{ invalid json\n', 'utf8');

    const cli = createJpycCli({ homeDir, env: {} });

    try {
      const result = await cli.run(['wallet', 'create', '--id', 'default', '--output', 'json']);
      const parsed = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(1);
      expect(parsed.error.code).toBe('WALLET_STORE_INVALID');
      await expect(readFile(walletsPath, 'utf8')).resolves.toBe('{ invalid json\n');
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });
});
