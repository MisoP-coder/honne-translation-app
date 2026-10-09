# 極限！カラメル・ジャスト・ミート

ぷるぷる揺れるプリンの頂点に、タップでカラメルを乗せ続けるゲーム。
Expo (React Native) + TypeScript。仕様は [docs/spec.md](docs/spec.md)。

## 動かし方

```bash
cd caramel-just-meet
npm install
npx expo start        # スマホの Expo Go で QR を読む
npx expo start --web  # ブラウザで遊ぶ
```

## チェック

```bash
npm test           # テスト（Jest）
npm run typecheck  # 型チェック
```

## BGM と効果音

`assets/sounds/` の音はすべて `scripts/generate_sounds.py` で合成した自作の音源です（外部の音源は使っていません）。
作り直すときは `python3 scripts/generate_sounds.py`（numpy が必要）。

## 公開する（Cloudflare Pages + Supabase）

広告や投げ銭などで収益化するので、商用利用できる Cloudflare Pages に置きます
（Vercel の無料プラン Hobby は商用利用が禁止）。`vercel.json` は Vercel に戻すとき用に残しています。

### 1. Supabase（ランキングのデータ置き場）
1. [supabase.com](https://supabase.com) で新しいプロジェクトを作る。
2. 左メニューの **SQL Editor** を開き、`supabase/schema.sql` の中身を全部貼って **Run**。
3. **Project Settings → API**（または **API Keys**）で次の 2 つを控える。
   - Project URL（`https://xxxx.supabase.co`）
   - 公開キー（`anon` または `publishable`）。**`service_role` / `secret` キーは絶対に使わない。**

### 2. Cloudflare Pages（サイトの置き場）

GitHub Actions（`.github/workflows/caramel-cloudflare-pages.yml`）が、main の `caramel-just-meet/` が更新されるたびに
テスト → ビルド → Cloudflare Pages へのアップロード（`wrangler pages deploy`）を行います。
Cloudflare の画面で GitHub とつなぐ方法は、スマホの Chrome ではポップアップの関係でつながらなかったため使っていません。

1. Cloudflare で API トークンを作る：右上の人のアイコン → **プロフィール** → **API トークン** → **トークンを作成** → **カスタム トークン**
   - 権限：**アカウント** / **Cloudflare Pages** / **編集**
   - アカウント リソース：**含む** / 自分のアカウント
2. Cloudflare のアカウント ID を控える（ダッシュボードの URL の `dash.cloudflare.com/` の直後の英数字 32 文字）。
3. GitHub のリポジトリの **Settings → Secrets and variables → Actions → New repository secret** に入れる。
   - `CLOUDFLARE_API_TOKEN` = 1 のトークン
   - `CLOUDFLARE_ACCOUNT_ID` = 2 のアカウント ID
4. GitHub の **Actions → caramel-just-meet → Cloudflare Pages → Run workflow** で公開する（以後は main が更新されるたびに自動）。
   最初の 1 回で Pages のプロジェクト `caramel-just-meet` が作られ、`https://caramel-just-meet.pages.dev` で開ける。

Supabase の URL と公開キー、公開 URL はワークフローに直接書いてある（ブラウザに埋め込まれる公開の値なので秘密ではない）。
変えるときはワークフローの `env` を書き換える。キャッシュの設定は `public/_headers`。

### 3. 独自ドメイン（お名前.com のサブドメイン）
1. Pages のプロジェクトで **Custom domains → Set up a custom domain** に `caramel.misop-craft.com` を入れる。
2. お名前.com の DNS で、`caramel` の CNAME の値を `<プロジェクト名>.pages.dev` に変える（Cloudflare の画面に出る値）。
3. Cloudflare の画面で **Active** になったら完了（https も自動）。

### Vercel から移すときの順番（止まらないように）
1. Cloudflare Pages でデプロイし、`<プロジェクト名>.pages.dev` で遊べることとランキングがつながることを確かめる。
2. Cloudflare に独自ドメインを追加し、お名前.com の CNAME を Cloudflare の値に変える。
3. `caramel.misop-craft.com` が Cloudflare で開くようになったら、Vercel のプロジェクトからドメインを外し、プロジェクトを消す（またはデプロイを止める）。

環境変数がないと、ランキングは「サンプル表示」で動きます。

### 手元でブラウザ版をビルドする
```bash
cp .env.example .env   # 値を入れる（.env は git に入らない）
npm run build:web      # dist/ にできる
```

### 広告（Google AdSense）

ブラウザ版だけ、ランキング画面と（縦に十分長い画面の）ゲームオーバー画面の下に、小さなバナー広告を出します。プレイ中には出しません。
GitHub の **Settings → Secrets and variables → Actions → Variables** に次を入れると、次の公開から広告が入ります（未設定なら出ません）。

| 名前 | 値 |
| --- | --- |
| `ADSENSE_CLIENT` | パブリッシャー ID（`ca-pub-` から始まる） |
| `ADSENSE_SLOT_RANKING` | ランキング画面用の広告ユニットの ID（数字） |
| `ADSENSE_SLOT_GAMEOVER` | ゲームオーバー画面用の広告ユニットの ID（数字） |

`ADSENSE_CLIENT` を入れると、ビルドで `index.html` に AdSense の確認タグと読み込みスクリプトが入り、`ads.txt` も作られます（`scripts/postbuild-web.mjs`）。
プライバシーポリシーは `public/privacy.html`、遊び方のページは `public/about.html`。

### 運営メモ
- よくない名前は Supabase の **Table Editor → caramel_scores** から行を消す。
- ありえない点数はサーバーで弾くが、ずるを完全に防ぐことはできない。
