# JPYC Info Design System

このドキュメントは、JPYC Info の現行サイト、今後の Web UI、動画、OG 画像、スライド、紹介資料で共通利用するデザインガイドです。

JPYC Info は「JPYC のオンチェーン指標とサービス情報を、明るく、正確に、信頼できる形で見せる情報ダッシュボード」として扱います。暗いクリプト感や過度な装飾ではなく、白い情報面、淡い青のキャンバス、読みやすいデータ表示を基準にします。

## Design Principles

### 1. Clear Financial Information

数字、チャート、コントラクト情報、サービス一覧を最優先します。装飾は情報の理解を助ける範囲に留め、画面上の主役を常にデータ、状態、次の行動に置きます。

### 2. Light Trust

信頼感は重厚な黒や金ではなく、余白、整ったカード、薄い境界線、安定したタイポグラフィで作ります。背景は淡く、コンテンツ面は白く、文字は濃いスレートで読みやすくします。

### 3. Connected Ecosystem

JPYC Info はチェーン、ホルダー、流動性、サービス、Agent / MCP / CLI などの接続点を扱います。接続や流れは JPYC ブルーを主役にし、ティールを補助的なフロー表現として使います。

### 4. Production Ready

Web だけでなく、動画や資料でも再利用できるようにします。1920x1080 の動画、1200x675 の OG 画像、16:9 スライドでも破綻しない大きめの文字、明確な階層、安定した余白を使います。

## Brand Voice

- 正確で落ち着いた情報提供をする。
- JPYC やオンチェーン情報に詳しくない人にも読める言葉を使う。
- 煽り、投資リターンの示唆、過度な未来予測を避ける。
- 「公式ダッシュボード」「一覧」「確認」「推移」「チェーン別」「導入相談」など、用途が明確な表現を優先する。
- Agent / CLI / MCP など技術文脈では、安全性、ローカル実行、明示的な確認、dry-run を強調する。

## Color System

### Core Tokens

| Token | Hex | Usage |
| --- | --- | --- |
| `background` | `#eef2ff` | ページ背景、動画キャンバス、淡いセクション背景 |
| `surface` | `#ffffff` | カード、パネル、テーブル、フォーム |
| `surfaceHover` | `#f4f6fb` | ホバー面、非アクティブな淡い面 |
| `border` | `#e2e8f0` | カード境界、テーブル罫線、フォーム境界 |
| `ink` | `#0f172a` | 主要テキスト、見出し、重要な数値 |
| `text` | `#334155` | 本文、説明文 |
| `muted` | `#64748b` | 補助テキスト、日時、注釈 |
| `accent` | `#2563eb` | 主要ボタン、リンク、選択状態、重要なライン |
| `accentDeep` | `#1d4ed8` | 強い見出しアクセント、動画のブランド強調 |
| `accentSoft` | `#dbeafe` | バッジ背景、チャート補助、淡い情報面 |
| `flow` | `#0d9488` | 接続、進行、完了、安全確認、動画の流線 |
| `success` | `#047857` | 成功メッセージ、完了状態 |
| `successBg` | `#ecfdf5` | 成功メッセージ背景 |
| `error` | `#991b1b` | エラー文、危険状態 |
| `errorBg` | `#fee2e2` | エラー背景 |

### Usage Rules

- `accent` は主役です。主要 CTA、選択中タブ、重要なチャート系列に使います。
- `flow` は補助です。進行、接続、完了、安全確認を示すときだけ使います。
- 背景全体を濃色にしません。濃色は CTA 帯や小さな強調面に限定します。
- 紫、ネオン、サイバーパンク調、黒背景中心の配色は使いません。
- 金融サービスらしい落ち着きは、暗さではなく余白と整列で作ります。

## Typography

### Font Stack

```css
font-family: "Noto Sans JP", "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

コード、CLI、JSON、コントラクトアドレスには以下を使います。

```css
font-family: "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace;
```

### Web Scale

| Role | Size | Weight | Line Height |
| --- | ---: | ---: | ---: |
| Page title | `2.25rem` to `4.6rem` | `700-900` | `1.08-1.2` |
| Section title | `1.875rem` to `2.25rem` | `700-900` | `1.18-1.3` |
| Card title | `1.05rem` to `1.5rem` | `700-900` | `1.35-1.5` |
| Body | `1rem` | `400-700` | `1.7-1.95` |
| Meta / label | `0.75rem` to `0.875rem` | `800-900` | `1.3-1.5` |
| Data value | `1.5rem` to `2.5rem` | `800-900` | `1.0-1.2` |

### Video Scale

1920x1080 の動画では、停止しなくても読める大きさを優先します。

| Role | Size | Weight |
| --- | ---: | ---: |
| Hero title | `96px` to `138px` | `900` |
| Scene title | `72px` to `108px` | `800-900` |
| Lead | `36px` to `46px` | `700` |
| Card title | `28px` to `38px` | `800` |
| Terminal / JSON | `24px` to `32px` | `700-800` |
| Small label | `18px` to `24px` | `800` |

### Typography Rules

- 見出しの letter spacing は原則 `0` にします。
- UI ラベルだけ `0.02em` から `0.24em` の tracking を使えます。
- 日本語本文は行間を広めに取り、詰めた印象を避けます。
- 長い英数字、アドレス、Tx hash は monospace にし、必要なら省略表示します。

## Layout

### Page Shell

- 最大幅は `1120px` から `1200px` を基準にします。
- ページ左右余白は desktop で `24px` 以上、mobile で `16px` 以上を確保します。
- セクション間は `24px` から `48px` の余白を使います。
- 情報密度の高い画面でも、カード内余白は `16px` 未満にしません。

### Grid

- Dashboard: `1fr`, `2 columns`, `3 columns` を用途で切り替えます。
- 重要な集計値は上部に置き、詳細チャートやテーブルは下に置きます。
- サービス一覧やカード群は desktop で `3 columns`、tablet で `2 columns`、mobile で `1 column` を基本にします。
- 動画では 2 カラム構成を多用し、左に文脈、右に UI / データ / terminal を置くと安定します。

## Component System

### Navigation

- 背景は `surface` または半透明の白。
- 境界線は `border`。
- 現在地は `accent` の文字色、淡い背景、または下線で示します。
- ナビゲーションは情報の入口であり、過度に大きくしません。

### Hero

用途:
- JPYC Info のトップ説明
- 特設ページの導入
- 動画のタイトルシーン

ルール:
- H1 はプロダクト名、ページ名、または明確なカテゴリ名にします。
- 補足説明は本文側に置きます。
- 背景は淡い青、白いカード、または実際のプロダクト画面を使います。
- 動画では `JPYC Info`, `JPYC-CLI`, `JPYC-AGENT` などの対象名を第一視認に置きます。

### Metric Panel

用途:
- 総流通量
- 日次ホルダー数
- TVL
- チェーン別合計
- 最終更新日時

ルール:
- 数値は大きく、単位は近くに置きます。
- 補助ラベルは `muted`、重要な変化は `accent` または `flow` で示します。
- エラーや一部取得失敗は隠さず、短いメッセージで表示します。

### Chart Panel

用途:
- 供給量推移
- Inflow / Outflow
- ホルダー推移
- チェーン別比較

ルール:
- パネル背景は `surface`、境界線は `border`。
- グリッド線は薄く、チャート線や棒を主役にします。
- 複数系列では `accent`, `flow`, `accentSoft`, slate 系を組み合わせます。
- タイトル、サブタイトル、取得状態、エラー状態を必ず用意します。

### Table / Address List

用途:
- コントラクトアドレス
- Issuer / Redeem
- サービス一覧
- チェーン別詳細

ルール:
- 長いアドレスは monospace。
- 行は十分な高さを取り、クリック可能な要素を詰めすぎません。
- コピー、外部リンク、詳細表示などの操作は明確なアイコンまたはテキストで示します。
- mobile では横スクロールかカード化を使い、文字の重なりを避けます。

### Service Card

用途:
- JPYC 対応サービス
- 導入事例
- MCP / Agent / CLI の入口

ルール:
- カードは `border-radius: 12px` から `16px`。
- 背景は白、必要に応じて淡い青のグラデーションを少量使います。
- カテゴリ、対応状況、CTA を明確に分けます。
- カード内にさらにカードを入れません。

### CTA

用途:
- 導入相談
- ダウンロード
- ワークスペースを開く
- ガイドを見る

ルール:
- Primary は `accent` 背景、白文字。
- Secondary は白背景、`border`、`ink`。
- CTA は短い動詞で書きます。
- 動画内 CTA は 1 シーンに 1 つまでにします。

### Form

用途:
- 導入相談
- 掲載依頼
- ログイン / サインアップ

ルール:
- ラベルは太く、入力欄は `#f8fafc` に近い淡色背景。
- 必須/任意バッジを明確にします。
- 成功とエラーは色だけでなくテキストでも伝えます。
- 送信中、成功、失敗の状態を必ず用意します。

### Badge

用途:
- 期間限定
- 対応済み
- 確定値
- チェーン名
- 導入方法

ルール:
- 小さくても太字にします。
- Primary badge は `accentSoft` 背景、`accentDeep` 文字。
- Success badge は `successBg` 背景、`success` 文字。
- 乱用せず、状態や分類が必要なときに使います。

## Motion System

### Web Interaction

- 通常のホバーやタブ切替は `150ms` から `200ms`。
- ease は `cubic-bezier(.4, 0, .2, 1)`。
- ボタンの hover は色、境界線、影の変化を中心にし、大きな移動は避けます。
- `prefers-reduced-motion: reduce` では transition を最小化します。

### Video Motion

JPYC Info の動画では「データが整理され、チェーンやサービスがつながっていく」感覚を使います。

推奨:
- 左から右、上から下への自然な情報フロー。
- 白い UI 面が軽く入る。
- 青からティールへの細い流線で接続を示す。
- チャートや数値は段階的に表示する。
- terminal や JSON は行単位で出し、読ませすぎない。

避ける:
- 高速なズーム連発。
- 暗い cyberpunk 表現。
- ネオン紫や派手なグロー。
- 読み切れない量の terminal text。
- 実送金や秘密鍵を想起させる危険な演出。

## Media-Specific Rules

### Website

- 情報探索を最優先します。
- ランディングページ風の大きな装飾より、ダッシュボードとしての一覧性を優先します。
- 主要な画面では、読み込み中、取得失敗、一部チェーン取得不可、データなしの状態を用意します。
- mobile ではカードの縦積みと横スクロールテーブルを使い分けます。

### Video

- 1 シーン 1 メッセージを守ります。
- 重要語は 3 から 7 語程度にします。
- UI は実物に寄せますが、読みやすさのために情報量を削ります。
- 16:9 の 1920x1080 を基準にし、SNS 切り抜きに備えて中央 80% に重要要素を置きます。
- 既存の `videos/jpyc-cli-release/DESIGN.md` は、この共通ガイドの動画向け派生として扱います。

### OG Image / Thumbnail

- サイズは 1200x675 を基準にします。
- 左上または中央に `JPYC Info` とページ名を置きます。
- 背景は淡い青、右側にチャートやカードの抽象表現を置きます。
- 小さく表示されても読めるよう、本文を詰め込みません。

### Slides / Documents

- 1 スライド 1 主張を基本にします。
- 見出し、短い説明、1 つの図または表で構成します。
- チャートは Web と同じ色を使い、補足説明は `muted` にします。
- 重要な数値は `ink` と `accent` で強調します。

## Accessibility

- 通常テキストは白背景上で十分なコントラストを確保します。
- 色だけで状態を伝えません。必ずラベルや説明を併用します。
- フォーカスリングは `accent` で見えるようにします。
- クリック可能領域は mobile で十分な高さを確保します。
- 長い日本語や長いアドレスがカード内で重ならないよう、折り返しや省略を設計します。

## Implementation Tokens

Web 実装では、以下の CSS custom properties を基準にします。

```css
:root {
  --background: #eef2ff;
  --surface: #ffffff;
  --surface-hover: #f4f6fb;
  --border: #e2e8f0;
  --ink: #0f172a;
  --text: #334155;
  --muted: #64748b;
  --accent: #2563eb;
  --accent-deep: #1d4ed8;
  --accent-soft: #dbeafe;
  --flow: #0d9488;
  --success: #047857;
  --success-bg: #ecfdf5;
  --error: #991b1b;
  --error-bg: #fee2e2;
}
```

動画実装では、既存の `videos/jpyc-cli-release/index.html` と同じく `--bg`, `--surface`, `--accent`, `--accent-deep`, `--ink`, `--muted`, `--border`, `--flow`, `--flow-soft` を使ってもよいです。ただし意味はこのドキュメントのトークンに合わせます。

## Do / Do Not

### Do

- 白い情報面を中心にする。
- JPYC ブルーを主要なブランド信号として使う。
- ティールは接続、進行、安全確認に限定して使う。
- 数字、チャート、テーブルを読みやすくする。
- エラーや取得不可状態を明確に表示する。
- 動画では大きな文字と少ない情報量を使う。

### Do Not

- 暗い cyberpunk / hacker 風にしない。
- 紫やネオンを主役にしない。
- カードの中にカードを重ねすぎない。
- 重要な情報を装飾や背景画像の上に埋もれさせない。
- 秘密鍵、実送金、未確認の投資効果を見せない。
- terminal や JSON を読めない密度で表示しない。

## Production Checklist

新しい Web ページ、動画、資料を作る前に確認します。

- JPYC Info の目的に合っているか。
- 背景、surface、accent、flow の役割が守られているか。
- 主要メッセージが一目で分かるか。
- 数字やチャートが装飾より強いか。
- mobile または 16:9 動画で文字が重ならないか。
- エラー、空状態、読み込み状態を考慮したか。
- 禁止表現や危険な金融/送金表現がないか。

## Relationship to Existing Files

- `videos/jpyc-cli-release/DESIGN.md`: JPYC-CLI release video の個別ビジュアルガイド。この共通デザインシステムに基づく派生ドキュメントとして扱います。
- `videos/jpyc-cli-release/index.html`: 既存動画の実装例。淡い青背景、白い UI 面、JPYC ブルー、ティールの流線、読みやすい terminal 表現を参照できます。
- `docs/JPYC_CLI_V2_DESIGN.md`: CLI の機能設計書。ビジュアルガイドではありませんが、Agent / CLI 文脈の安全性表現における内容面の参照元です。

## Future Extensions

このドキュメントでは、現行サイトと制作物に必要な共通 UI / motion ルールを定義します。ロゴ利用規定、法務レビュー済みのコピー規定、広告テンプレート、SNS 投稿テンプレートは、公式素材や運用要件が固まった段階で別章として追加します。
