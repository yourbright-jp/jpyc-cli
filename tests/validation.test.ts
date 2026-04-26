import { describe, expect, it } from 'vitest';

import { makeCliFixture, validAddress } from './helpers/cli.js';

describe('agent-safe validation', () => {
  it('rejects invalid EVM addresses with a compact JSON error', async () => {
    const { runJson } = await makeCliFixture();
    await runJson(['wallet', 'create', '--id', 'default']);

    const { result, parsed } = await runJson([
      'transfer',
      'plan',
      '--network',
      'polygon',
      '--from',
      'default',
      '--to',
      '0xabc...?fields=name',
      '--amount',
      '1000',
      '--token',
      'jpyc',
    ]);

    expect(result.exitCode).toBe(2);
    expect(parsed).toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_ADDRESS',
        details: { field: 'to' },
        retriable: false,
      },
    });
  });

  it('rejects control characters in JSON input', async () => {
    const { runJson } = await makeCliFixture();

    const { result, parsed } = await runJson([
      'wallet',
      'create',
      '--json-input',
      '{"id":"bad\\u0000wallet"}',
    ]);

    expect(result.exitCode).toBe(9);
    expect(parsed.error.code).toBe('CONTROL_CHARACTER_REJECTED');
  });

  it('rejects path traversal in ABI and artifact paths', async () => {
    const { runJson } = await makeCliFixture();

    const read = await runJson([
      'contract',
      'read',
      '--network',
      'polygon',
      '--address',
      validAddress,
      '--abi',
      '../../.ssh/id_rsa',
      '--function',
      'balanceOf',
      '--args',
      JSON.stringify([validAddress]),
    ]);
    const deploy = await runJson([
      'contract',
      'deploy',
      '--network',
      'polygon',
      '--wallet',
      'default',
      '--artifact',
      '%2e%2e/secrets.json',
      '--constructor-args',
      '[]',
      '--dry-run',
    ]);

    expect(read.result.exitCode).toBe(9);
    expect(read.parsed.error.code).toBe('UNSAFE_PATH_REJECTED');
    expect(deploy.result.exitCode).toBe(9);
    expect(deploy.parsed.error.code).toBe('UNSAFE_PATH_REJECTED');
  });

  it('rejects amounts that exceed token decimals precision', async () => {
    const { runJson } = await makeCliFixture();
    await runJson(['wallet', 'create', '--id', 'default']);

    const { result, parsed } = await runJson([
      'transfer',
      'plan',
      '--network',
      'polygon',
      '--from',
      'default',
      '--to',
      validAddress,
      '--amount',
      '1000.0000000000000000001',
      '--token',
      'jpyc',
    ]);

    expect(result.exitCode).toBe(2);
    expect(parsed.error).toMatchObject({
      code: 'INVALID_AMOUNT_PRECISION',
      details: { decimals: 18 },
      retriable: false,
    });
  });

  it('rejects a chain id mismatch from the configured RPC', async () => {
    const { runJson } = await makeCliFixture({ rpc: { chainId: 1 } });
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

    expect(result.exitCode).toBe(5);
    expect(parsed.error).toMatchObject({
      code: 'CHAIN_ID_MISMATCH',
      details: { expected: 137, actual: 1 },
      retriable: false,
    });
  });
});
