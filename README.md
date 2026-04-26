# JPYC CLI

JPYC CLI は、EVM ネットワーク上の JPYC ウォレット作成、残高確認、コントラクト呼び出し、送金をローカルで行うためのコマンドラインツールです。

人間と AI エージェントの両方から使いやすいように、各コマンドは JSON 出力に対応し、送金などの破壊的な操作は dry-run と明示確認を前提にしています。

## 要件

- Node.js `>=20.19.0`
- 利用するネットワークの RPC URL
- 実送金する場合は、送信元ウォレットに対象ネットワークのネイティブガス代

## インストール

```bash
npm install -g @yourbright/jpyc-cli
```

インストール確認:

```bash
jpyc schema list --output json
```

## プロンプト経由でインストールする

AI coding agent にセットアップさせる場合は、次のようなプロンプトを渡してください。

```text
@yourbright/jpyc-cli をインストールして動作確認してください。
```

グローバルインストールせずに一度だけ実行する場合:

```bash
npx --yes --package=@yourbright/jpyc-cli -- jpyc schema list --output json
```

## Codex Skill としてインストールする

Codex に JPYC CLI の安全な使い方を覚えさせたい場合は、GitHub CLI `v2.90.0` 以降の `gh skill` でインストールできます。

```bash
gh skill install yourbright-jp/jpyc-cli jpyc-cli --agent codex --scope user
```

インストール後、Codex を再起動してから `$jpyc-cli` を指定してください。

## クイックスタート

ウォレットを作成:

```bash
jpyc wallet create --id default --output json
```

ウォレット一覧:

```bash
jpyc wallet list --output json
```

Polygon RPC URL を設定:

```bash
export JPYC_POLYGON_RPC_URL="https://polygon-mainnet.g.alchemy.com/v2/<key>"
```

ネイティブトークンと JPYC の残高確認:

```bash
jpyc account balance \
  --wallet default \
  --network polygon \
  --tokens native,jpyc \
  --output json
```

JPYC 送金内容の確認:

```bash
jpyc transfer plan \
  --network polygon \
  --from default \
  --to 0x0000000000000000000000000000000000000000 \
  --amount 1 \
  --token jpyc \
  --output json
```

送金前の dry-run:

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

dry-run の結果を確認してから実送金:

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

## 安全上の注意

- JPYC CLI は non-custodial です。ウォレットファイルは利用者自身が管理します。
- ウォレットデータは `JPYC_CLI_HOME` が設定されていればその配下、未設定なら `~/.jpyc-cli` に保存されます。
- 現在のウォレットストアはローカル JSON ファイルです。秘密情報として扱い、commit しないでください。
- `wallet show` と `wallet list` は秘密鍵を表示しません。
- `wallet export-private-key --yes` は秘密鍵を表示します。安全な端末でのみ使ってください。
- トランザクションを broadcast するコマンドには `--yes` が必要です。
- 実送金前に `transfer plan` と `transfer send --dry-run` を使ってください。

## 環境変数

| 変数 | 用途 |
| --- | --- |
| `JPYC_CLI_HOME` | ローカルのウォレット/config 保存先。未設定時は `~/.jpyc-cli`。 |
| `JPYC_ETHEREUM_RPC_URL` | Ethereum mainnet RPC URL。 |
| `JPYC_POLYGON_RPC_URL` | Polygon mainnet RPC URL。 |
| `JPYC_AVALANCHE_RPC_URL` | Avalanche C-Chain RPC URL。 |

## コマンド例

### スキーマ

```bash
jpyc schema list --output json
jpyc schema wallet.create --output json
jpyc schema transfer.send --output json
```

### ウォレット

```bash
jpyc wallet create --id default --output json
jpyc wallet import --id imported --from-private-key-env JPYC_PRIVATE_KEY --output json
jpyc wallet list --output json
jpyc wallet show --id default --output json
jpyc wallet export-private-key --id default --yes --output json
```

### アカウント

```bash
jpyc account address --wallet default --output json
jpyc account balance --wallet default --network polygon --tokens native,jpyc --output json
jpyc account nonce --wallet default --network polygon --output json
```

### 送金

```bash
jpyc transfer plan --network polygon --from default --to <address> --amount 1 --token jpyc --output json
jpyc transfer send --network polygon --from default --to <address> --amount 1 --token jpyc --dry-run --output json
jpyc transfer send --network polygon --from default --to <address> --amount 1 --token jpyc --yes --output json
```

### コントラクト read

```bash
jpyc contract read \
  --network polygon \
  --address <contract> \
  --abi-json '[{"type":"function","name":"symbol","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"string"}]}]' \
  --function symbol \
  --output json
```

## 開発

依存関係のインストール:

```bash
npm ci
```

チェック:

```bash
npm run typecheck
npm run build
```

Alchemy RPC を使った fork test:

```bash
export JPYC_ALCHEMY_API_KEY="<key>"
npm run test:fork:alchemy
```

npm package の中身を確認:

```bash
npm pack --dry-run
```

## ライセンス

MIT
