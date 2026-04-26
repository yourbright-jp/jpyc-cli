import { describe, expect, it } from 'vitest';

import { makeCliFixture } from './helpers/cli.js';

describe('config command API', () => {
  it('initializes local config with safe defaults', async () => {
    const { runJson } = await makeCliFixture();

    const { result, parsed } = await runJson(['config', 'init']);

    expect(result.exitCode).toBe(0);
    expect(parsed).toMatchObject({
      ok: true,
      config: {
        defaultNetwork: 'polygon',
        networks: {
          polygon: {
            chainId: 137,
            rpcUrlEnv: 'JPYC_POLYGON_RPC_URL',
          },
        },
      },
    });
  });

  it('gets and sets default network and wallet without exposing secrets', async () => {
    const { runJson } = await makeCliFixture();
    await runJson(['config', 'init']);

    const setNetwork = await runJson(['config', 'set', 'defaultNetwork', 'polygon']);
    const setWallet = await runJson(['config', 'set', 'defaultWallet', 'default']);
    const get = await runJson(['config', 'get']);

    expect(setNetwork.result.exitCode).toBe(0);
    expect(setWallet.result.exitCode).toBe(0);
    expect(get.parsed.config.defaultNetwork).toBe('polygon');
    expect(get.parsed.config.defaultWallet).toBe('default');
    expect(JSON.stringify(get.parsed)).not.toContain('JPYC_KEYSTORE_PASSWORD');
  });

  it('lists configured networks and tokens', async () => {
    const { runJson } = await makeCliFixture();
    await runJson(['config', 'init']);

    const networks = await runJson(['config', 'networks']);
    const tokens = await runJson(['config', 'tokens', '--network', 'polygon']);

    expect(networks.parsed.networks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'polygon', chainId: 137, rpcUrlEnv: 'JPYC_POLYGON_RPC_URL' }),
      ]),
    );
    expect(tokens.parsed.tokens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ symbol: 'JPYC', type: 'erc20', decimals: expect.any(Number) }),
      ]),
    );
  });
});
