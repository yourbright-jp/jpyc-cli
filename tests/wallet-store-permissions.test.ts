import { chmod, lstat, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createJpycCli } from '../src/cli/index.js';

function modeBits(mode: number) {
  return mode & 0o777;
}

describe('wallet store permissions', () => {
  it('tightens existing wallet store and home directory permissions before saving secrets', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'jpyc-cli-wallet-perms-'));
    const walletsPath = join(homeDir, 'wallets.json');
    await writeFile(walletsPath, '{"wallets":[]}\n', { mode: 0o644 });
    await chmod(walletsPath, 0o644);
    await chmod(homeDir, 0o755);

    const cli = createJpycCli({ homeDir, env: { JPYC_KEYSTORE_PASSWORD: 'test-password' } });

    try {
      const result = await cli.run(['wallet', 'create', '--id', 'default', '--output', 'json']);

      expect(result.exitCode).toBe(0);
      expect(modeBits((await lstat(homeDir)).mode)).toBe(0o700);
      expect(modeBits((await lstat(walletsPath)).mode)).toBe(0o600);
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  it('rejects symlinked wallet stores instead of writing secrets through them', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'jpyc-cli-wallet-symlink-'));
    const targetDir = await mkdtemp(join(tmpdir(), 'jpyc-cli-wallet-target-'));
    const walletsPath = join(homeDir, 'wallets.json');
    const targetPath = join(targetDir, 'wallets.json');
    await mkdir(homeDir, { recursive: true });
    await writeFile(targetPath, '{"wallets":[]}\n', 'utf8');
    await symlink(targetPath, walletsPath);

    const cli = createJpycCli({ homeDir, env: { JPYC_KEYSTORE_PASSWORD: 'test-password' } });

    try {
      const result = await cli.run(['wallet', 'create', '--id', 'default', '--output', 'json']);
      const parsed = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(1);
      expect(parsed.error.code).toBe('WALLET_STORE_UNSAFE');
    } finally {
      await rm(homeDir, { recursive: true, force: true });
      await rm(targetDir, { recursive: true, force: true });
    }
  });
});
