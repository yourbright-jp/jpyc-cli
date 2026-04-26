# JPYC CLI

Local-first command-line tooling for JPYC wallets, balances, contract calls, and transfers on EVM networks.

JPYC CLI is designed for both humans and AI agents: every command can return JSON, mutating commands support dry runs, and private keys are never printed unless explicitly exported.

## Requirements

- Node.js `>=20.19.0`
- RPC URLs for the networks you want to use
- Native gas token on the sending network when broadcasting transactions

## Install

```bash
npm install -g @yourbright/jpyc-cli
```

Check that the binary is available:

```bash
jpyc schema list --output json
```

## Install Via Prompt

If you are using an AI coding agent, give it a prompt like this:

```text
Install and verify @yourbright/jpyc-cli.

Steps:
1. Confirm Node.js is >=20.19.0.
2. Run: npm install -g @yourbright/jpyc-cli
3. Run: jpyc schema list --output json
4. Create a local test wallet with:
   jpyc wallet create --id default --output json
5. Do not print, export, or commit private keys.
6. If checking balances, ask me for the RPC URL or use an existing environment variable.
```

For a one-off run without global install:

```bash
npx --yes --package=@yourbright/jpyc-cli -- jpyc schema list --output json
```

## Quick Start

Create a wallet:

```bash
jpyc wallet create --id default --output json
```

List wallets:

```bash
jpyc wallet list --output json
```

Configure an RPC URL through your shell:

```bash
export JPYC_POLYGON_RPC_URL="https://polygon-mainnet.g.alchemy.com/v2/<key>"
```

Check native and JPYC balances:

```bash
jpyc account balance \
  --wallet default \
  --network polygon \
  --tokens native,jpyc \
  --output json
```

Plan a JPYC transfer:

```bash
jpyc transfer plan \
  --network polygon \
  --from default \
  --to 0x0000000000000000000000000000000000000000 \
  --amount 1 \
  --token jpyc \
  --output json
```

Dry-run the transfer before broadcasting:

```bash
jpyc transfer send \
  --network polygon \
  --from default \
  --to 0x0000000000000000000000000000000000000000 \
  --amount 1 \
  --token jpyc \
  --dry-run \
  --output json
```

Broadcast only after checking the dry-run result:

```bash
jpyc transfer send \
  --network polygon \
  --from default \
  --to 0x0000000000000000000000000000000000000000 \
  --amount 1 \
  --token jpyc \
  --yes \
  --output json
```

## Safety Notes

- JPYC CLI is non-custodial. You control the wallet files.
- Wallet data is stored locally under `JPYC_CLI_HOME` when set, otherwise `~/.jpyc-cli`.
- The current wallet store is a local JSON file. Treat it as sensitive and do not commit it.
- `wallet show` and `wallet list` do not print private keys.
- `wallet export-private-key --yes` prints the private key. Use it only in a secure terminal.
- Commands that broadcast transactions require `--yes`.
- Prefer `transfer plan` and `transfer send --dry-run` before any real transfer.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `JPYC_CLI_HOME` | Directory for local wallet/config files. Defaults to `~/.jpyc-cli`. |
| `JPYC_ETHEREUM_RPC_URL` | Ethereum mainnet RPC URL. |
| `JPYC_POLYGON_RPC_URL` | Polygon mainnet RPC URL. |
| `JPYC_AVALANCHE_RPC_URL` | Avalanche C-Chain RPC URL. |

## Commands

### Schemas

```bash
jpyc schema list --output json
jpyc schema wallet.create --output json
jpyc schema transfer.send --output json
```

### Wallets

```bash
jpyc wallet create --id default --output json
jpyc wallet import --id imported --from-private-key-env JPYC_PRIVATE_KEY --output json
jpyc wallet list --output json
jpyc wallet show --id default --output json
jpyc wallet export-private-key --id default --yes --output json
```

### Accounts

```bash
jpyc account address --wallet default --output json
jpyc account balance --wallet default --network polygon --tokens native,jpyc --output json
jpyc account nonce --wallet default --network polygon --output json
```

### Transfers

```bash
jpyc transfer plan --network polygon --from default --to <address> --amount 1 --token jpyc --output json
jpyc transfer send --network polygon --from default --to <address> --amount 1 --token jpyc --dry-run --output json
jpyc transfer send --network polygon --from default --to <address> --amount 1 --token jpyc --yes --output json
```

### Contracts

```bash
jpyc contract read \
  --network polygon \
  --address <contract> \
  --abi-json '[{"type":"function","name":"symbol","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"string"}]}]' \
  --function symbol \
  --output json
```

## Development

Install dependencies:

```bash
npm ci
```

Run checks:

```bash
npm run typecheck
npm run build
```

Run Alchemy-backed fork tests:

```bash
export JPYC_ALCHEMY_API_KEY="<key>"
npm run test:fork:alchemy
```

Preview the npm package:

```bash
npm pack --dry-run
```

## License

MIT
