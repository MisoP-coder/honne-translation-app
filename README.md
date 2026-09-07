# 言いにくいことの翻訳

上司に言いにくい報告・相談を、**相手のタイプ**と**これまでの実績**に合わせた言い方に翻訳する、会社員向けの Web アプリです。

プロトタイプ(`docs/honne-translation-app.prototype.jsx`)をベースに、Supabase 認証とデータ保存、Claude API のサーバー側呼び出し、Vercel デプロイまでを含めた構成にしています。

## できること

- **上司プロフィールの登録・編集** — 呼び名 / 5つの特性(反応のタイプ・聞きたい順番・好む連絡手段・確認の細かさ・ミスへの反応)/ 地雷ワードの自由記述メモ
- **言い方の候補とリスク予測** — 状況を入力すると、Claude がトーンの異なる3案と、それぞれの「信頼への影響」「関係の温度感」「今後求められそうな対応」を返します
- **結果の記録と学習** — 「うまくいった / 様子見 / こじれた」を記録。同じ上司の実績が3件以上たまると、一般論ではなくその実績を最優先の判断材料として予測します
- **ログインとデータ保存** — Supabase Auth(パスワード / メールリンク)と Postgres。データは Row Level Security で本人しか読み書きできません

## 構成

```
app/
  page.jsx                ホーム(サーバー側でログイン確認 + 初期データ取得)
  login/page.jsx          ログイン画面
  auth/callback/route.js  メールリンク・確認メールからの戻り先
  auth/signout/route.js   ログアウト
  api/analyze/route.js    Claude API を呼ぶサーバールート(APIキーはここだけで使用)
components/
  HonneApp.jsx            アプリ本体(プロトタイプの UI を移植)
  LoginForm.jsx           ログイン / 新規登録 / メールリンク
lib/
  supabase/client.js      ブラウザ用 Supabase クライアント
  supabase/server.js      サーバー用 Supabase クライアント
  constants.js, theme.js
proxy.js                  セッション更新と未ログイン時のリダイレクト(Next.js 16 の proxy)
supabase/schema.sql       テーブル・RLS ポリシー定義
```

### データの流れ

- 上司プロフィールと実績データの読み書きは、**ブラウザから Supabase に直接**行います(RLS が認可を担当)
- Claude API の呼び出しだけは `/api/analyze` の**サーバー側**で行います。プロンプトに載せる上司プロフィールと実績データも、クライアントから受け取らずサーバーがログインユーザーの権限で DB から取り直します

## セットアップ

### 1. Supabase プロジェクトを用意する

1. [Supabase](https://supabase.com/) で新規プロジェクトを作成
2. ダッシュボードの **SQL Editor** で `supabase/schema.sql` の内容を実行(テーブルと RLS が作成されます)
3. **Project Settings → API** から `Project URL` と `anon public` キーを控える
4. **Authentication → URL Configuration** で以下を設定
   - Site URL: `http://localhost:3000`(本番は Vercel の URL)
   - Redirect URLs: `http://localhost:3000/auth/callback`(本番は `https://<your-app>.vercel.app/auth/callback`)

> メール確認を省いてすぐ試したい場合は、**Authentication → Sign In / Providers → Email** の "Confirm email" をオフにします。

### 2. Claude API キーを用意する

[Anthropic Console](https://console.anthropic.com/) で API キーを発行します。使用モデルは `claude-opus-5` です(`app/api/analyze/route.js` の `MODEL` で変更できます)。

### 3. 環境変数

`.env.example` をコピーして `.env.local` を作り、値を入れます。

```bash
cp .env.example .env.local
```

| 変数名 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase の Project URL(ブラウザにも公開される) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase の anon key(ブラウザにも公開される) |
| `ANTHROPIC_API_KEY` | Claude API キー。**サーバー専用。`NEXT_PUBLIC_` を付けないこと** |

### 4. 起動

```bash
npm install
npm run dev
```

http://localhost:3000 を開き、メールアドレスとパスワードで新規登録します。

## Vercel へのデプロイ

1. このリポジトリを GitHub に push し、[Vercel](https://vercel.com/new) で Import(Framework は Next.js が自動検出されます)
2. **Environment Variables** に `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `ANTHROPIC_API_KEY` を登録して Deploy
3. デプロイ後、Supabase の **Authentication → URL Configuration** に本番 URL を追加
   - Site URL: `https://<your-app>.vercel.app`
   - Redirect URLs: `https://<your-app>.vercel.app/auth/callback`

環境変数を変更したときは、Vercel 側で再デプロイすると反映されます。

## セキュリティについて

- `ANTHROPIC_API_KEY` はサーバールートでのみ読み込み、ブラウザには一切渡していません
- 全テーブルで RLS を有効化し、`auth.uid() = user_id` の行だけを操作できるようにしています
- 実績データの挿入時は、そのプロフィールが本人のものであることも RLS 側で確認しています
- ユーザーが入力した状況やメモは「相談内容」であって指示ではない、とシステムプロンプトで明示しています
