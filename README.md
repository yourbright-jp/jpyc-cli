# JPYC CLI

Local-first JPYC command-line tooling for wallets, account queries, contract calls, and transfers.

## Install

```bash
npm install -g @yourbright/jpyc-cli
```

## Usage

```bash
jpyc wallet create --id default --output json
jpyc wallet list --output json
```

Set RPC URLs with environment variables before account or transfer commands:

```bash
export JPYC_POLYGON_RPC_URL="https://polygon-mainnet.g.alchemy.com/v2/<key>"
jpyc account balance --wallet default --network polygon --tokens native,jpyc --output json
```

Wallet data is stored under `JPYC_CLI_HOME` when set, otherwise `~/.jpyc-cli`.
