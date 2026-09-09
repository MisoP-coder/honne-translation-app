# 言いにくいことの翻訳

上司に言いにくい報告・相談を、**相手のタイプ**と**これまでの実績**に合わせた言い方に翻訳する、会社員向けの Web アプリです。

プロトタイプ(`docs/honne-translation-app.prototype.jsx`)をベースに、Supabase の認証・データ保存と Claude API の呼び出しを組み込み、Vercel で公開できる形にしています。

**パソコンは不要です。** スマホのブラウザだけで、Supabase・Vercel・Anthropic の3つの管理画面を触れば公開まで到達できます。以下の手順もその前提で書いています。

## できること

- **上司プロフィールの登録・編集** — 呼び名 / 5つの特性(反応のタイプ・聞きたい順番・好む連絡手段・確認の細かさ・ミスへの反応)/ 地雷ワードの自由記述メモ
- **言い方の候補とリスク予測** — 状況を入力すると、Claude がトーンの異なる3案と、それぞれの「信頼への影響」「関係の温度感」「今後求められそうな対応」を返します
- **結果の記録と学習** — 「うまくいった / 様子見 / こじれた」を記録。同じ上司の実績が3件以上たまると、一般論ではなくその実績を最優先の判断材料として予測します
- **ログインとデータ保存** — Supabase Auth(パスワード / メールリンク)と Postgres。データは Row Level Security で本人しか読み書きできません

---

# セットアップ手順

順番が大事です。**Supabase → Vercel → Supabase に戻る** の流れで進めます。Vercel の URL が決まらないと Supabase の設定が完了しないためです。

## 1. Supabase プロジェクトを作る

1. [Supabase](https://supabase.com/dashboard) で **New project**
2. Project name は任意、**Database Password は自動生成して保存**(このアプリでは使いませんが、後から確認できません)、Region は `Northeast Asia (Tokyo)`
3. 作成完了まで2分ほど待つ

## 2. テーブルを作る

1. 左メニューの **SQL Editor** → **New query**
2. このリポジトリの [`supabase/schema.sql`](supabase/schema.sql) の中身を全部貼り付けて **Run**
3. **Success. No rows returned** と出れば成功
4. **Table Editor** に `boss_profiles` と `outcome_records` が並び、どちらにも緑の **RLS enabled** バッジが付いていることを確認

## 3. Supabase の接続情報を控える

**Settings → API Keys** と **Settings → Data API** から2つ取得します。

| 必要なもの | 場所 | 正しい形 |
| --- | --- | --- |
| Project URL | Settings → Data API | `https://xxxxx.supabase.co` |
| 公開キー | Settings → API Keys → Publishable and secret | `sb_publishable_...` |

> ⚠️ **Project URL に `/rest/v1/` を含めないこと。** Data API の画面には REST エンドポイント(`https://xxxxx.supabase.co/rest/v1/`)も並んで表示されていますが、**それは別物**です。付けたまま登録すると、ログイン時に `Invalid path specified in request URL` で失敗します。`.co` で終わらせてください。

> ⚠️ **`sb_secret_...` / `service_role` キーは絶対に使わないこと。** RLS をすべて無視できる管理者キーです。

Project URL が見つからないときは、ダッシュボードのアドレス `https://supabase.com/dashboard/project/<ここがプロジェクトID>/...` から `https://<プロジェクトID>.supabase.co` を組み立てても構いません。

## 4. Claude API キーを発行する

1. [Anthropic Console](https://platform.claude.com/) → **API キー** → **キーを作成**
2. 「ID連携を使用すれば、APIキーは不要です」と出たら **APIキーで続ける** を選ぶ(ID 連携は GCP / AWS / GitHub Actions 向けで、Vercel は対象外)
3. 有効期限は長めに(30日のままだと1か月後にアプリが止まります)
4. **表示は一度きり**。`sk-ant-...` をコピーして控える

**API の利用料は Claude の有料プランとは別会計です。** 残高がゼロだと候補生成だけが失敗するので、Console の課金画面でクレジットを購入するか支払い方法を登録してください。

## 5. Vercel にデプロイする

1. [Vercel](https://vercel.com/new) に GitHub アカウントでサインアップし、このリポジトリを **Import**
2. **Environment Variables** に3つ登録する

| Key | Value | Type |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | **Config** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_...` | **Config** |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | **Secret** |

> ⚠️ **`NEXT_PUBLIC_` で始まる変数は Type を `Config` にすること。** これらはブラウザに埋め込まれる公開値なので、`Secret` にすると `Environment variables with a public framework prefix cannot use visibility: secret` と表示されて保存できません。しかも**保存済みの Secret を後から Config に変更することはできない**ため、その場合は一度削除して作り直す必要があります。逆に `ANTHROPIC_API_KEY` は本物の秘密なので Secret のままにします。

3. **Deploy** を押し、`Ready` になったら **Domains** に出ている `https://xxxxx.vercel.app` を控える

## 6. Supabase に本番 URL を登録する

**Authentication → URL Configuration** に、5 で得た URL を設定します。

| 項目 | 値 |
| --- | --- |
| Site URL | `https://xxxxx.vercel.app` |
| Redirect URLs | `https://xxxxx.vercel.app/**` |

さらに **Authentication → Sign In / Providers → Email** の **Confirm email をオフ**にしておくと、登録がその場で完了して確認が楽になります(本番運用時は戻してください)。

> パスワード再設定のリンクもこの **Redirect URLs** を通ります。`https://xxxxx.vercel.app/**` のように末尾を `/**` にしておけば `/auth/callback` も含まれるので、追加の設定は要りません。

Supabase が送るメールは初期状態だと**英語**で、どのアプリからのメールか分かりません。日本語の文面を [`docs/email-templates.md`](docs/email-templates.md) に用意してあるので、**Authentication → Emails → Templates** に貼り付けてください。

## 7. 動作確認

Vercel の URL を開いて、上から順に確認します。

1. ログイン画面が表示される → デプロイ成功
2. 「新規登録」でアカウントを作れる → **Supabase の認証が疎通**
3. 上司を登録できる → **データベースへの読み書きが疎通**
4. 「言い方の候補を見る」で3案出る → **Claude API が疎通**

Chrome の「︙」→「ホーム画面に追加」でアプリのように起動できます。

---

# つまずいたときは

## デプロイが Error になる

**`No Output Directory named "public" found after the Build completed.`**

Vercel がこのプロジェクトを Next.js だと認識していません。リポジトリに [`vercel.json`](vercel.json)(`{"framework": "nextjs"}`)を置いてあるので通常は起きませんが、もし出た場合は Vercel の **Settings → Build and Deployment → Framework Preset** が `Next.js` になっているか確認してください。

> Vercel の設定画面がスマホで見つからないときは、プロジェクトの URL の末尾に `/settings` や `/settings/environment-variables` を足して直接開くのが早いです。

## ログイン・新規登録で失敗する

| 表示されるもの | 原因 |
| --- | --- |
| `Invalid path specified in request URL` / 接続先の設定が正しくないようです | `NEXT_PUBLIC_SUPABASE_URL` に `/rest/v1/` などの余計なパスが付いている |
| `Invalid API key` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` が違う値(Project URL と取り違えているなど) |
| ログイン後すぐログイン画面に戻る | 手順6の URL Configuration が未設定 |
| メールが届かない | 迷惑メールを確認。無料プランは送信数に制限があるため、Confirm email をオフにするのが早い |
| 再設定リンクを開くと「リンクの有効期限が切れています」 | リンクの期限切れか、**メールを開いたブラウザが送信時と違う**。スマホでは、メールアプリが自分の内蔵ブラウザで開いてしまうことがあるので、リンクを長押しして Chrome で開く |

**環境変数を直したら、必ず再デプロイしてください。** 値はビルド時にアプリへ埋め込まれるため、保存しただけでは反映されません(Deployments → 最新の「…」→ **Redeploy**)。

## 候補の生成だけ失敗する

Claude API 側の問題です。Anthropic Console の残高と、`ANTHROPIC_API_KEY` の有効期限を確認してください。キーの期限が切れている場合は、新しく作り直して Vercel の環境変数を更新 → 再デプロイします。

## しばらく放置したら Supabase につながらない

無料プランは一定期間アクセスがないとプロジェクトが一時停止します。ダッシュボードの **Restore** から復帰できます。

---

# 開発について

## この先の変更のしかた

パソコンがなくても、次の流れで開発を続けられます。

1. Claude Code に変更を依頼する
2. GitHub の `main` に push される
3. Vercel が自動で再デプロイする(1〜2分)
4. スマホで URL を再読み込みして確認する

## ファイル構成

```
app/
  page.jsx                ホーム(サーバー側でログイン確認 + 初期データ取得)
  login/page.jsx          ログイン画面
  auth/callback/route.js  メールリンク・確認メール・再設定メールからの戻り先
  auth/signout/route.js   ログアウト
  reset-password/page.jsx 新しいパスワードを決める画面
  api/analyze/route.js    Claude API を呼ぶサーバールート(APIキーはここだけで使用)
components/
  HonneApp.jsx            アプリ本体(プロトタイプの UI を移植)
  LoginForm.jsx           ログイン / 新規登録 / メールリンク / 再設定メールの送信
  ResetPasswordForm.jsx   新しいパスワードの入力フォーム
lib/
  supabase/client.js      ブラウザ用 Supabase クライアント
  supabase/server.js      サーバー用 Supabase クライアント
  supabase/env.js         接続情報の正規化(末尾スラッシュ・空白の除去)
  authErrors.js           Supabase の英語エラーを日本語の案内文に変換
  constants.js, theme.js
proxy.js                  セッション更新と未ログイン時のリダイレクト(Next.js 16 の proxy)
supabase/schema.sql       テーブル・RLS ポリシー定義
docs/email-templates.md   Supabase に貼り付けるメール文面(日本語)
vercel.json               Vercel に Next.js プロジェクトだと伝える
```

## データの流れ

- 上司プロフィールと実績データの読み書きは、**ブラウザから Supabase へ直接**行います(認可は RLS が担当)
- Claude API の呼び出しだけは `/api/analyze` の**サーバー側**で行います。プロンプトに載せるプロフィールと実績データも、クライアントから受け取らずサーバーがログインユーザーの権限で DB から取り直します

## 利用状況の計測

候補生成のたびに `analysis_logs` テーブルへ1行記録します(消費トークン数、モデル、プロンプトに載せた実績件数)。**相談内容そのものは保存しません。**

集計用の SQL は [`docs/analytics.sql`](docs/analytics.sql) にまとめてあります。Supabase の **SQL Editor** に貼り付けて実行すると、相談回数・利用者数・1回あたりの原価・定着率などが出ます。SQL Editor は RLS を迂回するため、全ユーザーぶんが集計されます。

## 事故防止の上限

1人あたり **1日20回** まで候補を生成できます(`app/api/analyze/route.js` の `DAILY_LIMIT`)。日本時間の0時にリセットされます。

無料枠のための制限ではなく、**連打や不具合で原価が暴走する事故を防ぐため**のものです。通常の使い方でここに当たることはありません。上限に達すると候補生成だけが 429 で止まり、その旨が画面に表示されます。

集計に失敗した場合は生成を止めません(上限は事故防止であって、課金の線引きではないため)。

## 使用モデルと費用

`app/api/analyze/route.js` の `MODEL` で指定しています。現在は **`claude-sonnet-5`** です。

| モデル | 入力 / 100万トークン | 出力 / 100万トークン |
| --- | --- | --- |
| `claude-sonnet-5`(現在) | $2 | $10 |
| `claude-opus-5` | $5 | $25 |

1回の「言い方の候補を見る」で消費するのは入力・出力あわせて数千トークン程度です。品質を上げたくなったら `MODEL` を `claude-opus-5` に変えてください。

## ローカルで動かす場合(パソコンがある場合)

```bash
git clone https://github.com/MisoP-coder/honne-translation-app.git
cd honne-translation-app
cp .env.example .env.local   # 3つの値を記入する
npm install
npm run dev
```

この場合は Supabase の **Site URL / Redirect URLs** に `http://localhost:3000` と `http://localhost:3000/**` も追加してください。

## セキュリティについて

- `ANTHROPIC_API_KEY` はサーバールートでのみ読み込み、ブラウザには一切渡していません
- 全テーブルで RLS を有効化し、`auth.uid() = user_id` の行だけを操作できるようにしています
- 実績データの挿入時は、そのプロフィールが本人のものであることも RLS 側で確認しています
- ユーザーが入力した状況やメモは「相談内容」であって指示ではない、とシステムプロンプトで明示しています
