import { describe, expect, it } from 'vitest';

import { makeCliFixture } from './helpers/cli.js';

describe('wallet command API', () => {
  it('creates a local encrypted keystore wallet without printing a private key', async () => {
    const { runJson } = await makeCliFixture();

    const { result, parsed } = await runJson(['wallet', 'create', '--id', 'default']);

    expect(result.exitCode).toBe(0);
    expect(parsed).toMatchObject({
      ok: true,
      wallet: {
        id: 'default',
        type: 'local-keystore',
      },
      secretPrinted: false,
    });
    expect(parsed.wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(result.stdout).not.toMatch(/[a-fA-F0-9]{64}/);
    expect(result.stderr).toBe('');
  });

  it('creates a wallet from --json-input using the same schema as flags', async () => {
    const { runJson } = await makeCliFixture();

    const { parsed } = await runJson(['wallet', 'create', '--json-input', '{"id":"json-wallet"}']);

    expect(parsed.ok).toBe(true);
    expect(parsed.wallet.id).toBe('json-wallet');
    expect(parsed.wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it('imports a private key from an environment variable and never echoes the key', async () => {
    const privateKey = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const { runJson } = await makeCliFixture({ env: { JPYC_PRIVATE_KEY: privateKey } });

    const { result, parsed } = await runJson([
      'wallet',
      'import',
      '--id',
      'treasury',
      '--from-private-key-env',
      'JPYC_PRIVATE_KEY',
    ]);

    expect(result.exitCode).toBe(0);
    expect(parsed.ok).toBe(true);
    expect(parsed.wallet.id).toBe('treasury');
    expect(parsed.secretPrinted).toBe(false);
    expect(result.stdout).not.toContain(privateKey.slice(2));
  });

  it('rejects direct --private-key input with a security policy violation', async () => {
    const { runJson } = await makeCliFixture();

    const { result, parsed } = await runJson([
      'wallet',
      'import',
      '--id',
      'unsafe',
      '--private-key',
      '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    ]);

    expect(result.exitCode).toBe(9);
    expect(parsed).toMatchObject({
      ok: false,
      error: {
        code: 'PRIVATE_KEY_ARGUMENT_FORBIDDEN',
        retriable: false,
      },
    });
  });

  it('lists and shows only non-secret wallet metadata', async () => {
    const { runJson } = await makeCliFixture();
    await runJson(['wallet', 'create', '--id', 'default']);

    const list = await runJson(['wallet', 'list']);
    const show = await runJson(['wallet', 'show', '--id', 'default']);

    expect(list.parsed.ok).toBe(true);
    expect(list.parsed.wallets).toHaveLength(1);
    expect(list.parsed.wallets[0]).toMatchObject({ id: 'default', type: 'local-keystore' });
    expect(JSON.stringify(list.parsed.wallets[0])).not.toContain('privateKey');
    expect(show.parsed.wallet).toMatchObject({ id: 'default', type: 'local-keystore' });
    expect(JSON.stringify(show.parsed.wallet)).not.toContain('privateKey');
  });

  it('requires explicit unsafe flags before exporting a private key', async () => {
    const { runJson } = await makeCliFixture();
    await runJson(['wallet', 'create', '--id', 'default']);

    const denied = await runJson(['wallet', 'export-private-key', '--id', 'default']);
    const allowed = await runJson([
      'wallet',
      'export-private-key',
      '--id',
      'default',
      '--unsafe-reveal',
      '--yes-i-understand-private-key-exposure',
    ]);

    expect(denied.result.exitCode).toBe(9);
    expect(denied.parsed.error.code).toBe('PRIVATE_KEY_EXPORT_REQUIRES_UNSAFE_CONFIRMATION');
    expect(allowed.result.exitCode).toBe(0);
    expect(allowed.parsed.ok).toBe(true);
    expect(allowed.parsed.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });
});
