import { describe, expect, it } from 'vitest';

import { makeCliFixture } from './helpers/cli.js';

describe('schema command API', () => {
  it('lists the stable command schemas used by agents', async () => {
    const { runJson } = await makeCliFixture();

    const { result, parsed } = await runJson(['schema', 'list']);

    expect(result.exitCode).toBe(0);
    expect(parsed.ok).toBe(true);
    expect(parsed.schemas).toEqual(
      expect.arrayContaining([
        'wallet.create',
        'wallet.import',
        'wallet.list',
        'wallet.show',
        'wallet.export-private-key',
        'account.address',
        'account.balance',
        'account.nonce',
        'transfer.plan',
        'transfer.estimate',
        'transfer.send',
        'contract.read',
        'contract.write',
        'contract.deploy',
        'config.init',
        'config.get',
        'config.set',
        'config.networks',
        'config.tokens',
      ]),
    );
  });

  it('describes transfer.send as dry-run-by-default and requiring --yes for broadcast', async () => {
    const { runJson } = await makeCliFixture();

    const { result, parsed } = await runJson(['schema', 'transfer.send']);

    expect(result.exitCode).toBe(0);
    expect(parsed.ok).toBe(true);
    expect(parsed.command).toBe('transfer.send');
    expect(parsed.inputSchema.required).toEqual(expect.arrayContaining(['network', 'to', 'amount']));
    expect(parsed.inputSchema.properties.to.pattern).toBe('^0x[a-fA-F0-9]{40}$');
    expect(parsed.safety).toMatchObject({
      requiresDryRunByDefault: true,
      requiresYesForBroadcast: true,
      printsPrivateKey: false,
    });
  });

  it('returns a compact JSON error for an unknown schema', async () => {
    const { runJson } = await makeCliFixture();

    const { result, parsed } = await runJson(['schema', 'unknown.command']);

    expect(result.exitCode).toBe(2);
    expect(parsed).toMatchObject({
      ok: false,
      error: {
        code: 'UNKNOWN_SCHEMA',
        retriable: false,
      },
    });
  });
});
