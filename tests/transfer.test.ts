import { describe, expect, it } from 'vitest';

import { makeCliFixture, validAddress } from './helpers/cli.js';

describe('transfer command API', () => {
  it('builds a transfer plan without signing or broadcasting', async () => {
    const { runJson, txRecorder } = await makeCliFixture();
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
      '1000',
      '--token',
      'jpyc',
    ]);

    expect(result.exitCode).toBe(0);
    expect(parsed).toMatchObject({
      ok: true,
      plan: {
        kind: 'erc20-transfer',
        network: 'polygon',
        chainId: 137,
        to: validAddress,
        token: 'JPYC',
        amount: {
          human: '1000',
          baseUnits: '1000000000000000000000',
        },
        checks: {
          addressValid: true,
          balanceSufficient: true,
          gasSufficient: true,
        },
      },
    });
    expect(txRecorder.broadcasts).toEqual([]);
  });

  it('accepts transfer plan payload through --json-input', async () => {
    const { runJson } = await makeCliFixture();
    await runJson(['wallet', 'create', '--id', 'default']);

    const { parsed } = await runJson([
      'transfer',
      'plan',
      '--json-input',
      JSON.stringify({ network: 'polygon', from: 'default', to: validAddress, amount: '1000', token: 'jpyc' }),
    ]);

    expect(parsed.ok).toBe(true);
    expect(parsed.plan.to).toBe(validAddress);
    expect(parsed.plan.amount.baseUnits).toBe('1000000000000000000000');
  });

  it('estimates gas for a transfer without broadcasting', async () => {
    const { runJson, txRecorder } = await makeCliFixture({ rpc: { estimatedGas: '65000' } });
    await runJson(['wallet', 'create', '--id', 'default']);

    const { result, parsed } = await runJson([
      'transfer',
      'estimate',
      '--network',
      'polygon',
      '--from',
      'default',
      '--to',
      validAddress,
      '--amount',
      '1000',
      '--token',
      'jpyc',
    ]);

    expect(result.exitCode).toBe(0);
    expect(parsed).toMatchObject({ ok: true, estimatedGas: '65000', broadcast: false });
    expect(txRecorder.broadcasts).toEqual([]);
  });

  it('dry-runs transfer send by default and returns the transaction plan', async () => {
    const { runJson, txRecorder } = await makeCliFixture();
    await runJson(['wallet', 'create', '--id', 'default']);

    const { result, parsed } = await runJson([
      'transfer',
      'send',
      '--network',
      'polygon',
      '--from',
      'default',
      '--to',
      validAddress,
      '--amount',
      '1000',
      '--token',
      'jpyc',
      '--dry-run',
    ]);

    expect(result.exitCode).toBe(0);
    expect(parsed).toMatchObject({
      ok: true,
      command: 'transfer.send',
      mode: 'dry-run',
      broadcast: false,
      tx: {
        network: 'polygon',
        chainId: 137,
        to: validAddress,
        value: '0',
        gas: '65000',
      },
    });
    expect(parsed.nextActions[0].command).toContain('--yes');
    expect(txRecorder.broadcasts).toEqual([]);
  });

  it('refuses to broadcast transfer send without --yes', async () => {
    const { runJson, txRecorder } = await makeCliFixture();
    await runJson(['wallet', 'create', '--id', 'default']);

    const { result, parsed } = await runJson([
      'transfer',
      'send',
      '--network',
      'polygon',
      '--from',
      'default',
      '--to',
      validAddress,
      '--amount',
      '1000',
      '--token',
      'jpyc',
    ]);

    expect(result.exitCode).toBe(8);
    expect(parsed.error.code).toBe('USER_CONFIRMATION_REQUIRED');
    expect(txRecorder.broadcasts).toEqual([]);
  });

  it('broadcasts transfer send only when --yes is present', async () => {
    const { runJson, txRecorder } = await makeCliFixture({ rpc: { txHash: '0xsent' } });
    await runJson(['wallet', 'create', '--id', 'default']);

    const { result, parsed } = await runJson([
      'transfer',
      'send',
      '--network',
      'polygon',
      '--from',
      'default',
      '--to',
      validAddress,
      '--amount',
      '1000',
      '--token',
      'jpyc',
      '--yes',
    ]);

    expect(result.exitCode).toBe(0);
    expect(parsed).toMatchObject({ ok: true, broadcast: true, txHash: '0xsent' });
    expect(txRecorder.broadcasts).toHaveLength(1);
  });
});
