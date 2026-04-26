#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnvLocal() {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) return;

  const content = readFileSync(path, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;

    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadDotEnvLocal();

const apiKey = process.env.JPYC_ALCHEMY_API_KEY ?? process.env.ALCHEMY_API_KEY;

if (!apiKey) {
  console.error(
    'Missing JPYC_ALCHEMY_API_KEY. Put it in .env.local or export it before running npm run test:fork:alchemy.',
  );
  process.exit(1);
}

const alchemyForkUrls = {
  JPYC_ETHEREUM_FORK_RPC_URL: `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`,
  JPYC_POLYGON_FORK_RPC_URL: `https://polygon-mainnet.g.alchemy.com/v2/${apiKey}`,
  JPYC_AVALANCHE_FORK_RPC_URL: `https://avax-mainnet.g.alchemy.com/v2/${apiKey}`,
};

for (const [envName, url] of Object.entries(alchemyForkUrls)) {
  // Force the fork suite to use Alchemy when this script is selected.
  // This avoids accidental success via ambient public-node RPC env vars.
  process.env[envName] = url;
}

process.env.RUN_ANVIL_FORK_TESTS = '1';

const child = spawn('vitest', ['run', 'tests/anvil/jpyc-fork.test.ts'], {
  env: process.env,
  shell: true,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`vitest exited via signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
