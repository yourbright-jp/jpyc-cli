import { describe, expect, it } from 'vitest';

import { makeCliFixture } from './helpers/cli.js';

describe('account command API', () => {
  it('prints the public address for a local wallet', async () => {
    const { runJson } = await makeCliFixture();
    const created = await runJson(['wallet', 'create', '--id', 'default']);

    const { result, parsed } = await runJson(['account', 'address', '--wallet', 'default']);

    expect(result.exitCode).toBe(0);
    expect(parsed).toMatchObject({ ok: true, wallet: 'default' });
    expect(parsed.address).toBe(created.parsed.wallet.address);
    expect(parsed.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it('returns native and JPYC balances as decimal strings', async () => {
    const { runJson } = await makeCliFixture({
      rpc: {
        nativeBalance: '1.2345',
        tokenBalances: { JPYC: '10000.25' },
      },
    });
    await runJson(['wallet', 'create', '--id', 'default']);

    const { result, parsed } = await runJson([
      'account',
      'balance',
      '--wallet',
      'default',
      '--network',
      'polygon',
      '--tokens',
      'native,jpyc',
    ]);

    expect(result.exitCode).toBe(0);
    expect(parsed.ok).toBe(true);
    expect(parsed.network).toBe('polygon');
    expect(parsed.balances).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ symbol: 'POL', type: 'native', amount: '1.2345' }),
        expect.objectContaining({ symbol: 'JPYC', type: 'erc20', amount: '10000.25' }),
      ]),
    );
  });

  it('returns account nonce for the selected network', async () => {
    const { runJson } = await makeCliFixture({ rpc: { nonce: 42 } });
    await runJson(['wallet', 'create', '--id', 'default']);

    const { result, parsed } = await runJson(['account', 'nonce', '--wallet', 'default', '--network', 'polygon']);

    expect(result.exitCode).toBe(0);
    expect(parsed).toMatchObject({ ok: true, network: 'polygon', nonce: 42 });
  });
});
