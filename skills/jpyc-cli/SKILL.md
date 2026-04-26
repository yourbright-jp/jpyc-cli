---
name: jpyc-cli
description: Use when Codex needs to install or operate @yourbright/jpyc-cli for JPYC wallet creation, wallet listing, address/balance checks, transfer planning, dry-runs, JPYC/native token transfers, contract reads/writes, or npm package verification. Trigger whenever the user asks to use JPYC CLI, install JPYC CLI, check JPYC balances, create/import a JPYC wallet, send JPYC, or prepare commands for an AI agent to operate JPYC CLI safely.
---

# JPYC CLI

Use JPYC CLI as a local-first, non-custodial command-line tool. Prefer JSON output for every command. Treat wallet files and private keys as secrets.

## Install

Require Node.js `>=20.19.0`.

```bash
node --version
npm install -g @yourbright/jpyc-cli
jpyc schema list --output json
```

For one-off use without global install:

```bash
npx --yes --package=@yourbright/jpyc-cli -- jpyc schema list --output json
```

If Node is too old, stop and ask the user whether to switch/install Node 20.19+ before continuing.

## Safety Rules

- Do not print, export, paste, or commit private keys unless the user explicitly asks for private key export.
- Never run `wallet export-private-key --yes` without explicit user approval.
- Never broadcast a transaction without first running `transfer plan` and `transfer send --dry-run`.
- Before any broadcast command with `--yes`, restate network, from wallet/address, recipient, token, amount, and gas estimate, then wait for explicit confirmation.
- Use a dedicated `JPYC_CLI_HOME` for experiments when possible, for example `/tmp/jpyc-cli-local`.
- Do not commit wallet stores, `.env`, `.env.local`, RPC keys, or generated local wallet files.
- If using mainnet RPC, be explicit about the network: `ethereum`, `polygon`, or `avalanche`.

## Environment

JPYC CLI reads RPC URLs from environment variables:

```bash
export JPYC_ETHEREUM_RPC_URL="https://..."
export JPYC_POLYGON_RPC_URL="https://..."
export JPYC_AVALANCHE_RPC_URL="https://..."
```

Wallet/config storage:

```bash
export JPYC_CLI_HOME="$HOME/.jpyc-cli"
```

Use `JPYC_CLI_HOME=/tmp/jpyc-cli-local` for disposable testing.

## Wallet Workflow

Create a wallet:

```bash
jpyc wallet create --id default --output json
```

List wallets:

```bash
jpyc wallet list --output json
```

Show public wallet metadata:

```bash
jpyc wallet show --id default --output json
```

Import from an environment variable:

```bash
JPYC_PRIVATE_KEY="0x..." jpyc wallet import --id imported --from-private-key-env JPYC_PRIVATE_KEY --output json
```

## Balance Workflow

Check address:

```bash
jpyc account address --wallet default --output json
```

Check native and JPYC balances on Polygon:

```bash
jpyc account balance --wallet default --network polygon --tokens native,jpyc --output json
```

If balance checks fail with `RPC_URL_MISSING`, ask for the relevant RPC URL or derive it from an approved existing environment variable.

## Transfer Workflow

Always perform these steps in order.

1. Plan:

```bash
jpyc transfer plan --network polygon --from default --to <address> --amount 1 --token jpyc --output json
```

2. Dry-run:

```bash
jpyc transfer send --network polygon --from default --to <address> --amount 1 --token jpyc --dry-run --output json
```

3. Ask for explicit confirmation. Include:

- network
- from wallet/address
- recipient
- token and amount
- gas estimate
- whether this is mainnet

4. Broadcast only after confirmation:

```bash
jpyc transfer send --network polygon --from default --to <address> --amount 1 --token jpyc --yes --output json
```

After broadcasting, report the transaction hash and re-check balances if the user wants confirmation.

## Contract Read

Use `contract.read` for view calls. Keep ABI JSON minimal.

```bash
jpyc contract read \
  --network polygon \
  --address <contract> \
  --abi-json '[{"type":"function","name":"symbol","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"string"}]}]' \
  --function symbol \
  --output json
```

## Development and Package Verification

When working inside the `yourbright-jp/jpyc-cli` repository:

```bash
npm ci
npm run typecheck
npm run build
npm pack --dry-run
```

Alchemy-backed fork tests require a keyed Alchemy app with Ethereum, Polygon, and Avalanche enabled:

```bash
export JPYC_ALCHEMY_API_KEY="<key>"
npm run test:fork:alchemy
```

Do not publish to npm unless the user explicitly asks. Before publishing, run `npm publish --dry-run --access public`.
