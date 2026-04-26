import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createJpycCli } from '../src/cli/index.js';

const servers: Array<ReturnType<typeof createServer>> = [];

function readBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

async function startRpcServer(chainIdHex: `0x${string}`) {
  const seenMethods: string[] = [];
  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const payload = JSON.parse(await readBody(request)) as { id: number; method: string };
    seenMethods.push(payload.method);
    const result = payload.method === 'eth_chainId' ? chainIdHex : '0x0';
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result }));
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Unable to start test RPC server');
  return { url: `http://127.0.0.1:${address.port}`, seenMethods };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe('RPC chain id validation', () => {
  it('rejects RPC endpoints whose chainId does not match the selected network', async () => {
    const rpc = await startRpcServer('0x1');
    const homeDir = await mkdtemp(join(tmpdir(), 'jpyc-cli-chain-id-'));
    const cli = createJpycCli({ homeDir, env: { JPYC_POLYGON_RPC_URL: rpc.url } });

    try {
      await cli.run(['wallet', 'create', '--id', 'default', '--output', 'json']);
      const result = await cli.run([
        'account',
        'balance',
        '--wallet',
        'default',
        '--network',
        'polygon',
        '--tokens',
        'native',
        '--output',
        'json',
      ]);
      const parsed = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(1);
      expect(parsed.error.code).toBe('RPC_CHAIN_ID_MISMATCH');
      expect(parsed.error.message).toContain('expected 137');
      expect(rpc.seenMethods).toContain('eth_chainId');
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });
});
