import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createJpycCli } from '../src/cli/index.js';

const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

describe('wallet keystore encryption', () => {
  it('stores imported private keys encrypted and decrypts them for explicit export', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'jpyc-cli-keystore-'));
    const cli = createJpycCli({
      homeDir,
      env: {
        JPYC_KEYSTORE_PASSWORD: 'correct horse battery staple',
        IMPORT_PRIVATE_KEY: PRIVATE_KEY,
      },
    });

    try {
      const walletImport = await cli.run([
        'wallet',
        'import',
        '--id',
        'default',
        '--from-private-key-env',
        'IMPORT_PRIVATE_KEY',
        '--output',
        'json',
      ]);
      const exportPrivateKey = await cli.run(['wallet', 'export-private-key', '--id', 'default', '--yes', '--output', 'json']);
      const stored = await readFile(join(homeDir, 'wallets.json'), 'utf8');

      expect(walletImport.exitCode).toBe(0);
      expect(stored).not.toContain(PRIVATE_KEY);
      expect(stored).not.toContain('"privateKey"');
      expect(stored).toContain('"keystore"');
      expect(JSON.parse(exportPrivateKey.stdout).privateKey).toBe(PRIVATE_KEY);
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  it('requires a keystore password before creating wallets', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'jpyc-cli-keystore-missing-'));
    const cli = createJpycCli({ homeDir, env: {} });

    try {
      const result = await cli.run(['wallet', 'create', '--id', 'default', '--output', 'json']);
      const parsed = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(2);
      expect(parsed.error.code).toBe('KEYSTORE_PASSWORD_MISSING');
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });
});
