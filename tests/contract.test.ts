import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { makeCliFixture, validAddress, validContract } from './helpers/cli.js';

async function writeAbi(homeDir: string) {
  const abiPath = join(homeDir, 'erc20.abi.json');
  await writeFile(
    abiPath,
    JSON.stringify([
      {
        type: 'function',
        name: 'balanceOf',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
      },
      {
        type: 'function',
        name: 'transfer',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
      },
    ]),
  );
  return abiPath;
}

async function writeArtifact(homeDir: string) {
  const artifactPath = join(homeDir, 'MyContract.json');
  await writeFile(
    artifactPath,
    JSON.stringify({
      abi: [],
      bytecode: '0x60006000',
    }),
  );
  return artifactPath;
}

describe('contract command API', () => {
  it('reads contract state without a wallet or broadcast', async () => {
    const { homeDir, runJson, txRecorder } = await makeCliFixture({ rpc: { readResult: '10000' } });
    const abiPath = await writeAbi(homeDir);

    const { result, parsed } = await runJson([
      'contract',
      'read',
      '--network',
      'polygon',
      '--address',
      validContract,
      '--abi',
      abiPath,
      '--function',
      'balanceOf',
      '--args',
      JSON.stringify([validAddress]),
    ]);

    expect(result.exitCode).toBe(0);
    expect(parsed).toMatchObject({
      ok: true,
      command: 'contract.read',
      network: 'polygon',
      address: validContract,
      function: 'balanceOf',
      result: '10000',
    });
    expect(txRecorder.broadcasts).toEqual([]);
  });

  it('dry-runs contract write and returns calldata without broadcasting', async () => {
    const { homeDir, runJson, txRecorder } = await makeCliFixture();
    const abiPath = await writeAbi(homeDir);
    await runJson(['wallet', 'create', '--id', 'default']);

    const { result, parsed } = await runJson([
      'contract',
      'write',
      '--network',
      'polygon',
      '--wallet',
      'default',
      '--address',
      validContract,
      '--abi',
      abiPath,
      '--function',
      'transfer',
      '--args',
      JSON.stringify([validAddress, '1000000000000000000000']),
      '--dry-run',
    ]);

    expect(result.exitCode).toBe(0);
    expect(parsed).toMatchObject({
      ok: true,
      command: 'contract.write',
      mode: 'dry-run',
      broadcast: false,
      tx: {
        network: 'polygon',
        chainId: 137,
        to: validContract,
        value: '0',
      },
    });
    expect(parsed.tx.data).toMatch(/^0x[a-fA-F0-9]+$/);
    expect(txRecorder.broadcasts).toEqual([]);
  });

  it('requires --yes before broadcasting contract write', async () => {
    const { homeDir, runJson, txRecorder } = await makeCliFixture({ rpc: { txHash: '0xwrite' } });
    const abiPath = await writeAbi(homeDir);
    await runJson(['wallet', 'create', '--id', 'default']);

    const denied = await runJson([
      'contract',
      'write',
      '--network',
      'polygon',
      '--wallet',
      'default',
      '--address',
      validContract,
      '--abi',
      abiPath,
      '--function',
      'transfer',
      '--args',
      JSON.stringify([validAddress, '1000000000000000000000']),
    ]);
    const allowed = await runJson([
      'contract',
      'write',
      '--network',
      'polygon',
      '--wallet',
      'default',
      '--address',
      validContract,
      '--abi',
      abiPath,
      '--function',
      'transfer',
      '--args',
      JSON.stringify([validAddress, '1000000000000000000000']),
      '--yes',
    ]);

    expect(denied.result.exitCode).toBe(8);
    expect(denied.parsed.error.code).toBe('USER_CONFIRMATION_REQUIRED');
    expect(allowed.result.exitCode).toBe(0);
    expect(allowed.parsed).toMatchObject({ ok: true, broadcast: true, txHash: '0xwrite' });
    expect(txRecorder.broadcasts).toHaveLength(1);
  });

  it('dry-runs contract deploy by default and requires --yes for broadcast', async () => {
    const { homeDir, runJson, txRecorder } = await makeCliFixture({ rpc: { txHash: '0xdeploy' } });
    const artifactPath = await writeArtifact(homeDir);
    await runJson(['wallet', 'create', '--id', 'default']);

    const dryRun = await runJson([
      'contract',
      'deploy',
      '--network',
      'polygon',
      '--wallet',
      'default',
      '--artifact',
      artifactPath,
      '--constructor-args',
      JSON.stringify(['arg1', 'arg2']),
      '--dry-run',
    ]);
    const denied = await runJson([
      'contract',
      'deploy',
      '--network',
      'polygon',
      '--wallet',
      'default',
      '--artifact',
      artifactPath,
      '--constructor-args',
      JSON.stringify(['arg1', 'arg2']),
    ]);
    const allowed = await runJson([
      'contract',
      'deploy',
      '--network',
      'polygon',
      '--wallet',
      'default',
      '--artifact',
      artifactPath,
      '--constructor-args',
      JSON.stringify(['arg1', 'arg2']),
      '--yes',
    ]);

    expect(dryRun.parsed).toMatchObject({ ok: true, command: 'contract.deploy', mode: 'dry-run', broadcast: false });
    expect(denied.result.exitCode).toBe(8);
    expect(allowed.parsed).toMatchObject({ ok: true, command: 'contract.deploy', broadcast: true, txHash: '0xdeploy' });
    expect(txRecorder.broadcasts).toHaveLength(1);
  });
});
