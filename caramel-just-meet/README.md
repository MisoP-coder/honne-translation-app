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
1. [dash.cloudflare.com](https://dash.cloudflare.com) で **Workers & Pages → Create → Pages → Connect to Git**、この GitHub リポジトリを選ぶ。
2. ビルドの設定
   | 項目 | 値 |
   | --- | --- |
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | `npm run build:web` |
   | Build output directory | `dist` |
   | Root directory（Advanced） | `caramel-just-meet` |
3. **Environment variables**（Production）に入れる（`.env.example` を参照）。
   - `EXPO_PUBLIC_SUPABASE_URL` = Project URL
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = 公開キー
   - `EXPO_PUBLIC_SITE_URL` = 公開する URL（例 `https://caramel.misop-craft.com`）。**Cloudflare では必ず入れる**（シェア用カードの画像 URL に使う）
4. **Save and Deploy**。Node.js のバージョンは `.node-version`（22）で決まる。環境変数を変えたら、もう一度デプロイしないと反映されない。
5. キャッシュの設定は `public/_headers`（ビルドで `dist/_headers` にコピーされる）。

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

### 運営メモ
- よくない名前は Supabase の **Table Editor → caramel_scores** から行を消す。
- ありえない点数はサーバーで弾くが、ずるを完全に防ぐことはできない。
