import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createJpycCli } from '../src/cli/index.js';

describe('transfer token validation', () => {
  it('rejects unknown transfer tokens instead of treating them as JPYC', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'jpyc-cli-token-validation-'));
    const cli = createJpycCli({ homeDir, env: {} });

    try {
      const result = await cli.run([
        'transfer',
        'plan',
        '--network',
        'polygon',
        '--from',
        'default',
        '--to',
        '0x000000000000000000000000000000000000bEEF',
        '--amount',
        '1',
        '--token',
        'usdc',
        '--output',
        'json',
      ]);
      const parsed = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(2);
      expect(parsed.error.code).toBe('INVALID_ARGUMENT');
      expect(parsed.error.message).toContain('--token');
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });
});
