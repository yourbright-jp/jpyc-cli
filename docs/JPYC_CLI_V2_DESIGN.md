# JPYC CLI v2 設計書

作成日: 2026-04-25

> **非公式サービスです。**
> 本サービスは、YourBright社が提供するサービスです。JPYC株式会社による公式サービスではありません。

## 1. 目的

JPYC info v2 の中核として、MCP ではなく npm 配布可能な CLI と Agent Skill だけで完結するローカル実行基盤を設計する。

この CLI は、人間・スクリプト・AI Agent が同じバイナリを安全に利用できることを目指す。特に、秘密鍵生成・秘密鍵 import・公開アドレス作成・JPYC 送金・コントラクト read/write/deploy を、中央集権的な OAuth や外部認可サーバーに依存せず、ローカルで完結させる。

## 2. 非目標

以下は v2 の対象外とする。

- MCP server の提供
- OAuth ベースの中央認可
- hosted wallet / custodial wallet
- サーバー側での秘密鍵保管
- ブラウザ redirect を前提にした認証フロー
- Agent がユーザー確認なしに送金・contract write・deploy を実行できる仕組み

## 3. 設計原則

JPYC CLI v2 は以下を原則とする。

1. **CLI is the product**: MCP ではなく CLI と Skill を配布単位にする。
2. **Local-first key management**: 秘密鍵の生成・import・暗号化保存はローカルで完結する。
3. **No central OAuth**: 認証・認可の中央サーバーを置かない。
4. **Agent-safe by default**: Agent は信頼できる操作者ではない前提で入力検証と safety rails を設計する。
5. **JSON-first**: すべてのコマンドは機械可読な JSON 出力を持つ。
6. **Raw JSON payload first-class**: flags だけでなく、Agent が完全な JSON payload を渡せる。
7. **Schema introspection**: Agent が実行時に command schema を取得できる。
8. **Dry-run by default for mutating operations**: 送金・contract write・deploy は dry-run / simulation を先に実行する。
9. **No private key on stdout by default**: 秘密鍵を標準出力に表示しない。
10. **Skill ships with CLI**: Agent 用の運用ルール・禁止事項・例を Skill として同梱する。

## 4. 参考にする CLI / Agent 設計プラクティス

### 4.1 Command Line Interface Guidelines

- URL: <https://clig.dev/>
- GitHub: <https://github.com/cli-guidelines/cli-guidelines>

採用する観点:

- help / documentation / subcommands の一貫性
- stdout / stderr の使い分け
- exit code の厳格化
- configuration / environment variables の設計
- scripting しやすい出力

### 4.2 12-Factor Agents

- URL: <https://github.com/humanlayer/12-factor-agents>

採用する観点:

- Tools are just structured outputs
- Own your control flow
- Compact errors into context window
- Small, focused agents
- Stateless reducer 的な実行モデル

### 4.3 You Need to Rewrite Your CLI for AI Agents

- URL: <https://justin.poehnelt.com/posts/rewrite-your-cli-for-ai-agents/>

採用する観点:

- Raw JSON Payloads > Bespoke Flags
- Schema Introspection Replaces Documentation
- Context Window Discipline
- Input Hardening Against Hallucinations
- Ship Agent Skills, Not Just Commands
- Safety Rails: Dry-Run

ただし、同記事の multi-surface / MCP 方針は本設計では採用しない。JPYC CLI v2 は **CLI + Skill のみ**で完結する。

## 5. 配布形態

npm package として配布する。

```bash
npm install -g @yourbright/jpyc-cli
```

または:

```bash
npx @yourbright/jpyc-cli --help
```

binary name:

```bash
jpyc
```

将来の分割余地は残すが、MVP では単一 package とする。

```txt
@yourbright/jpyc-cli
  ├─ CLI binary
  ├─ core wallet / keystore module
  ├─ transaction builder / simulator
  ├─ contract module
  ├─ schema introspection
  └─ bundled Agent Skill files
```

## 6. 推奨技術スタック

```txt
Runtime: Node.js >= 20
Language: TypeScript
EVM client: viem
Schema validation: zod
JSON schema generation: zod-to-json-schema
CLI parser: commander / clipanion / cac のいずれか
Testing: vitest
Bundling: tsup
Lint / format: biome または eslint + prettier
Package manager: bun または npm
```

EVM 操作は `viem` を第一候補とする。理由は以下。

- account / public client / wallet client の分離が明確
- 型安全性が高い
- chain / transport / ABI handling が扱いやすい
- simulation / estimate / write の流れが表現しやすい

## 7. ディレクトリ構成案

```txt
jpyc-cli/
  package.json
  tsconfig.json
  README.md
  src/
    cli/
      index.ts
      commands/
        wallet.ts
        account.ts
        transfer.ts
        contract.ts
        config.ts
        schema.ts
    core/
      wallet/
        createWallet.ts
        importWallet.ts
        exportWallet.ts
      keystore/
        encryptKeystore.ts
        decryptKeystore.ts
        keystorePath.ts
      chains/
        registry.ts
        resolveChain.ts
      tokens/
        registry.ts
        resolveToken.ts
      tx/
        planTransfer.ts
        simulateTransfer.ts
        sendTransfer.ts
      contract/
        readContract.ts
        simulateContractWrite.ts
        writeContract.ts
        deployContract.ts
      validation/
        address.ts
        amount.ts
        jsonInput.ts
        paths.ts
        strings.ts
      output/
        json.ts
        human.ts
        errors.ts
    schemas/
      wallet.ts
      transfer.ts
      contract.ts
      config.ts
      schemaRegistry.ts
  agent/
    CONTEXT.md
    skills/
      jpyc-wallet.md
      jpyc-transfer.md
      jpyc-contract.md
  tests/
    wallet.test.ts
    transfer.test.ts
    contract.test.ts
    validation.test.ts
```

## 8. コマンド体系

### 8.1 Global flags

全コマンドで共通化する。

```bash
--output human|json|ndjson
--json-input '<json>'
--config <path>
--no-color
--quiet
--verbose
```

Agent は原則 `--output json` を使う。

### 8.2 Wallet commands

```bash
jpyc wallet create
jpyc wallet import
jpyc wallet list
jpyc wallet show
jpyc wallet export
jpyc wallet export-private-key
jpyc wallet remove
jpyc wallet rename
```

#### wallet create

```bash
jpyc wallet create --id default --output json
```

出力例:

```json
{
  "ok": true,
  "wallet": {
    "id": "default",
    "address": "0x1234567890123456789012345678901234567890",
    "type": "local-keystore",
    "path": "~/.jpyc/keystores/default.json"
  },
  "secretPrinted": false
}
```

秘密鍵は表示しない。

#### wallet import

推奨:

```bash
JPYC_PRIVATE_KEY=0x... jpyc wallet import \
  --id treasury \
  --from-private-key-env JPYC_PRIVATE_KEY \
  --output json
```

非推奨:

```bash
jpyc wallet import --id treasury --private-key 0x...
```

`--private-key` 直渡しは shell history / process list に残るため warning を出す。Agent Skill では禁止する。

#### export-private-key

デフォルトでは private key export は無効に近い扱いにする。

```bash
jpyc wallet export-private-key \
  --id default \
  --unsafe-reveal \
  --yes-i-understand-private-key-exposure
```

この操作は Agent Skill では原則禁止する。

### 8.3 Account commands

```bash
jpyc account address --wallet default --output json
jpyc account balance --wallet default --network polygon --tokens native,jpyc --output json
jpyc account nonce --wallet default --network polygon --output json
```

出力例:

```json
{
  "ok": true,
  "network": "polygon",
  "address": "0x1234567890123456789012345678901234567890",
  "balances": [
    {
      "symbol": "POL",
      "type": "native",
      "amount": "1.234"
    },
    {
      "symbol": "JPYC",
      "type": "erc20",
      "contract": "0x0000000000000000000000000000000000000000",
      "amount": "10000"
    }
  ]
}
```

### 8.4 Transfer commands

```bash
jpyc transfer plan
jpyc transfer estimate
jpyc transfer send
jpyc transfer history
```

#### transfer plan

署名・送信を行わず、送金計画だけを作る。

```bash
jpyc transfer plan \
  --network polygon \
  --from default \
  --to 0xabc0000000000000000000000000000000000000 \
  --amount 1000 \
  --token jpyc \
  --output json
```

出力例:

```json
{
  "ok": true,
  "plan": {
    "kind": "erc20-transfer",
    "network": "polygon",
    "chainId": 137,
    "from": "0x1234567890123456789012345678901234567890",
    "to": "0xabc0000000000000000000000000000000000000",
    "token": "JPYC",
    "amount": {
      "human": "1000",
      "baseUnits": "1000000000000000000000"
    },
    "checks": {
      "addressValid": true,
      "balanceSufficient": true,
      "gasSufficient": true
    }
  }
}
```

#### transfer send dry-run

```bash
jpyc transfer send \
  --network polygon \
  --from default \
  --to 0xabc0000000000000000000000000000000000000 \
  --amount 1000 \
  --token jpyc \
  --dry-run \
  --output json
```

#### transfer send broadcast

broadcast には `--yes` を必須とする。

```bash
jpyc transfer send \
  --network polygon \
  --from default \
  --to 0xabc0000000000000000000000000000000000000 \
  --amount 1000 \
  --token jpyc \
  --yes \
  --output json
```

### 8.5 Contract commands

```bash
jpyc contract read
jpyc contract write
jpyc contract deploy
jpyc contract encode
jpyc contract decode
jpyc contract verify-input
```

#### contract read

```bash
jpyc contract read \
  --network polygon \
  --address 0xcontract000000000000000000000000000000000 \
  --abi ./abi.json \
  --function balanceOf \
  --args '["0xabc0000000000000000000000000000000000000"]' \
  --output json
```

#### contract write dry-run

```bash
jpyc contract write \
  --network polygon \
  --wallet default \
  --address 0xcontract000000000000000000000000000000000 \
  --abi ./abi.json \
  --function transfer \
  --args '["0xabc0000000000000000000000000000000000000", "1000000000000000000000"]' \
  --dry-run \
  --output json
```

#### contract write broadcast

```bash
jpyc contract write \
  --network polygon \
  --wallet default \
  --address 0xcontract000000000000000000000000000000000 \
  --abi ./abi.json \
  --function transfer \
  --args '["0xabc0000000000000000000000000000000000000", "1000000000000000000000"]' \
  --yes \
  --output json
```

#### contract deploy

```bash
jpyc contract deploy \
  --network polygon \
  --wallet default \
  --artifact ./artifacts/MyContract.json \
  --constructor-args '["arg1", "arg2"]' \
  --dry-run \
  --output json
```

Deploy も broadcast には `--yes` を必須とする。

### 8.6 Config commands

```bash
jpyc config init
jpyc config get
jpyc config set
jpyc config networks
jpyc config tokens
jpyc config path
```

設定ファイル:

```txt
~/.jpyc/config.json
~/.jpyc/keystores/*.json
~/.jpyc/logs/*.ndjson
```

設定例:

```json
{
  "defaultNetwork": "polygon",
  "defaultWallet": "default",
  "networks": {
    "polygon": {
      "chainId": 137,
      "rpcUrlEnv": "JPYC_POLYGON_RPC_URL"
    }
  },
  "tokens": {
    "polygon": {
      "JPYC": {
        "address": "0x0000000000000000000000000000000000000000",
        "decimals": 18
      }
    }
  }
}
```

RPC URL は secret 扱いになる場合があるため、config 直書きより env を推奨する。

```bash
JPYC_POLYGON_RPC_URL=https://...
```

### 8.7 Schema commands

Agent が runtime に command schema を取得する。

```bash
jpyc schema list --output json
jpyc schema wallet.create --output json
jpyc schema transfer.send --output json
jpyc schema contract.write --output json
```

出力例:

```json
{
  "ok": true,
  "command": "transfer.send",
  "description": "Send JPYC or native token from a local wallet",
  "inputSchema": {
    "type": "object",
    "required": ["network", "to", "amount"],
    "properties": {
      "network": {
        "type": "string",
        "enum": ["ethereum", "polygon", "avalanche", "local"]
      },
      "to": {
        "type": "string",
        "pattern": "^0x[a-fA-F0-9]{40}$"
      },
      "amount": {
        "type": "string"
      },
      "dryRun": {
        "type": "boolean",
        "default": true
      }
    }
  },
  "safety": {
    "requiresDryRunByDefault": true,
    "requiresYesForBroadcast": true,
    "printsPrivateKey": false
  }
}
```

## 9. JSON input 設計

すべての主要 command は flags と `--json-input` の両方をサポートする。

Agent は complex payload では `--json-input` を優先する。

```bash
jpyc transfer send \
  --json-input '{
    "network": "polygon",
    "token": "JPYC",
    "from": "default",
    "to": "0xabc0000000000000000000000000000000000000",
    "amount": "1000",
    "unit": "jpyc",
    "dryRun": true
  }' \
  --output json
```

内部では flags と JSON input を同じ payload に正規化する。

```txt
flags / json-input
  ↓
normalized payload
  ↓
zod validation
  ↓
execution plan
  ↓
dry-run / simulation / broadcast
```

## 10. ローカル秘密鍵管理

### 10.1 Keystore

秘密鍵は local keystore に暗号化保存する。

```txt
~/.jpyc/keystores/default.json
```

ファイル権限:

```txt
0600
```

keystore format は以下のどちらかを採用する。

1. Web3 Secret Storage v3 compatible format
2. 独自 JSON format + scrypt / Argon2id

互換性を重視するなら Web3 Secret Storage v3 を優先する。

### 10.2 Password handling

人間向け:

```bash
jpyc wallet unlock --id default
```

Agent / CI 向け:

```bash
JPYC_KEYSTORE_PASSWORD=... jpyc transfer send ...
```

または:

```bash
jpyc transfer send \
  --wallet default \
  --password-env JPYC_KEYSTORE_PASSWORD
```

より安全な secret file:

```bash
jpyc transfer send \
  --wallet default \
  --password-file /run/secrets/jpyc_wallet_password
```

### 10.3 禁止・非推奨

以下を Agent Skill で禁止または強く非推奨にする。

- private key を command-line argument で渡す
- private key を stdout に出す
- private key を log に残す
- keystore password を command-line argument で渡す
- `--yes` をユーザー確認なしに付ける

## 11. Agent-safe validation

AI Agent は hallucination により、通常の人間とは異なる壊れた入力を生成する。CLI は最後の防衛線として以下を検証する。

### 11.1 共通 validation

- control characters を拒否する
- EVM address を厳密に検証する
- `?`, `#`, `%` を resource id に混入させない
- path traversal を拒否する
- output path は CWD 以下または許可ディレクトリ以下に制限する
- ABI / artifact path を canonicalize する
- JSON input は schema validation する
- 金額は number ではなく decimal string として扱う
- chainId mismatch を拒否する
- token decimals を明示的に処理する
- zero address への送金 / contract 操作は危険扱いにする

### 11.2 reject 例

```txt
0xabc...?fields=name  -> reject
../../.ssh/id_rsa    -> reject
hello\u0000world      -> reject
%2e%2e/secrets        -> reject
1000.0000000000000000001 with decimals 18 -> reject
```

### 11.3 金額処理

JavaScript `number` は使わない。

```txt
amount: string
baseUnits: bigint
```

小数変換は decimal parser で行う。

## 12. Safety rails

### 12.1 Mutating operations

以下は mutating / dangerous operation とする。

- `wallet export-private-key`
- `wallet remove`
- `transfer send`
- `contract write`
- `contract deploy`
- `config set` のうち network / token / rpc 周辺

これらは以下を満たす。

- default は dry-run / simulation
- broadcast / destructive action は `--yes` 必須
- mainnet では追加確認を検討
- Agent Skill では「ユーザーの明示確認なしに `--yes` 禁止」と明記

### 12.2 dry-run 出力例

```json
{
  "ok": true,
  "command": "transfer.send",
  "mode": "dry-run",
  "broadcast": false,
  "tx": {
    "network": "polygon",
    "chainId": 137,
    "from": "0x1234567890123456789012345678901234567890",
    "to": "0xabc0000000000000000000000000000000000000",
    "data": "0xa9059cbb...",
    "value": "0",
    "gas": "65000"
  },
  "warnings": [],
  "nextActions": [
    {
      "description": "Broadcast this transaction after explicit user confirmation",
      "command": "jpyc transfer send --network polygon --to 0xabc0000000000000000000000000000000000000 --amount 1000 --token jpyc --yes --output json"
    }
  ]
}
```

## 13. 出力設計

### 13.1 成功 JSON

```json
{
  "ok": true,
  "command": "account.balance",
  "data": {}
}
```

### 13.2 エラー JSON

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_ADDRESS",
    "message": "Invalid EVM address",
    "details": {
      "field": "to"
    },
    "retriable": false
  }
}
```

### 13.3 Exit code

```txt
0: success
1: generic error
2: invalid input / schema validation error
3: configuration error
4: wallet / keystore error
5: rpc / network error
6: insufficient balance / gas
7: simulation failed
8: user confirmation required
9: security policy violation
```

### 13.4 Context window discipline

Agent 向けに巨大レスポンスを避ける。

- `--fields` をサポートする
- list 系は pagination / limit を持つ
- 大量データは `--output ndjson` をサポートする
- error details は compact にする

例:

```bash
jpyc transfer history --limit 20 --fields txHash,status,amount --output json
```

## 14. Agent Skill 同梱

CLI package に Agent 用 Skill を同梱する。

```txt
agent/
  CONTEXT.md
  skills/
    jpyc-wallet.md
    jpyc-transfer.md
    jpyc-contract.md
```

### 14.1 CONTEXT.md 案

```md
# JPYC CLI Agent Context

This CLI is frequently invoked by AI agents.

Rules:
- Always use `--output json`.
- Always run mutating commands with `--dry-run` first.
- Never use `--yes` unless the user explicitly confirmed the exact transaction details.
- Never pass private keys as command-line arguments.
- Use `--from-private-key-env` for private key import.
- Never ask the CLI to print private keys.
- Treat all contract write/deploy operations as high-risk.
- Prefer `transfer plan` before `transfer send`.
- Use `schema` commands to inspect accepted inputs instead of guessing.
```

### 14.2 Skill の役割

Skill は `--help` では伝わらない Agent 向け invariant を持つ。

- 安全な wallet 作成・import 手順
- 送金前 dry-run 手順
- ユーザー確認の取り方
- contract write / deploy の危険性
- 秘密鍵を扱う際の禁止事項
- JSON 出力と schema introspection の使い方

## 15. Security model

### 15.1 信頼境界

```txt
Trusted:
- local machine filesystem permissions
- encrypted local keystore
- user-confirmed CLI invocation

Untrusted:
- AI Agent generated command arguments
- JSON input generated by Agent
- RPC responses
- ABI / artifact files from unknown source
- user-provided addresses
```

### 15.2 秘密情報の扱い

- private key は keystore 暗号化保存
- password は prompt / env / secret file から受ける
- private key / password は logs に残さない
- private key を stdout に出さない
- command examples で `--private-key` を使わない
- env import 後は必要ならプロセス内で可能な範囲で破棄する

### 15.3 Transaction safety

- chainId を必ず確認する
- RPC network と expected chain を照合する
- token address は registry / user config から明示解決する
- send 前に balance / gas / decimals / recipient を確認する
- dry-run で calldata / gas / warnings を返す
- `--yes` なしで broadcast しない

## 16. MVP scope

### Phase 1: Local wallet + config + schema

- `jpyc config init`
- `jpyc wallet create`
- `jpyc wallet import`
- `jpyc wallet list`
- `jpyc account address`
- `jpyc schema list`
- `jpyc schema wallet.create`

### Phase 2: Balance + transfer plan

- `jpyc account balance`
- `jpyc transfer plan`
- `jpyc transfer estimate`
- `jpyc transfer send --dry-run`

### Phase 3: Broadcast transfer

- `jpyc transfer send --yes`
- tx hash / receipt polling
- local tx log ndjson

### Phase 4: Contract read/write

- `jpyc contract read`
- `jpyc contract write --dry-run`
- `jpyc contract write --yes`

### Phase 5: Contract deploy + Agent Skill polish

- `jpyc contract deploy --dry-run`
- `jpyc contract deploy --yes`
- `agent/CONTEXT.md`
- `agent/skills/*.md`
- examples / README

## 17. Acceptance criteria

MVP 完了条件:

- npm package として `jpyc` binary が動く
- local keystore を作成できる
- private key を env から import できる
- private key が stdout / logs に出ない
- address / balance を JSON で取得できる
- JPYC transfer plan が作れる
- JPYC transfer dry-run ができる
- `--yes` なしでは送金 broadcast されない
- `schema` command で主要 command の JSON schema を取得できる
- Agent Skill に安全運用ルールが同梱されている
- validation test がある
- dry-run / send の unit or integration test がある

## 18. 実装上の注意

- 秘密情報を fixture / snapshot に含めない
- test private key は明示的に insecure test key として分離する
- RPC を使うテストは mock / local chain / opt-in integration に分ける
- CI では mainnet 送金テストを絶対に行わない
- `--yes` が必要なテストは local chain のみに限定する
- README の examples はすべて安全側にする

## 19. 最終方針

JPYC CLI v2 は、OAuth / MCP / 中央管理を使わず、ローカル秘密鍵管理と Agent-safe CLI 設計で完結する。

```txt
User / Agent
   ↓
JPYC Skill
   ↓
jpyc CLI
   ↓
local encrypted keystore
   ↓
RPC provider
   ↓
JPYC token / EVM contract
```

この構成により、JPYC info v2 は以下を同時に満たす。

- npm で配布しやすい
- Agent から呼びやすい
- ローカルで秘密鍵を完結できる
- 送金・contract 操作の安全策を CLI 側で強制できる
- MCP / OAuth の中央集権的な運用負荷を避けられる
