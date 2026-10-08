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

## 公開する（Vercel + Supabase）

### 1. Supabase（ランキングのデータ置き場）
1. [supabase.com](https://supabase.com) で新しいプロジェクトを作る。
2. 左メニューの **SQL Editor** を開き、`supabase/schema.sql` の中身を全部貼って **Run**。
3. **Project Settings → API**（または **API Keys**）で次の 2 つを控える。
   - Project URL（`https://xxxx.supabase.co`）
   - 公開キー（`anon` または `publishable`）。**`service_role` / `secret` キーは絶対に使わない。**

### 2. Vercel（サイトの置き場）
1. [vercel.com](https://vercel.com) で **Add New → Project**、この GitHub リポジトリを選ぶ。
2. **Root Directory** を `caramel-just-meet` にする（ビルドの設定は `vercel.json` から読まれる）。
3. **Environment Variables** に入れる（`.env.example` を参照）。
   - `EXPO_PUBLIC_SUPABASE_URL` = Project URL
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = 公開キー
   - `EXPO_PUBLIC_SITE_URL` = 独自ドメインを使うときだけ（例 `https://caramel.example.com`）
4. **Deploy**。環境変数を変えたら、もう一度デプロイしないと反映されない。

環境変数がないと、ランキングは「サンプル表示」で動きます。

### 手元でブラウザ版をビルドする
```bash
cp .env.example .env   # 値を入れる（.env は git に入らない）
npm run build:web      # dist/ にできる
```

### 運営メモ
- よくない名前は Supabase の **Table Editor → caramel_scores** から行を消す。
- ありえない点数はサーバーで弾くが、ずるを完全に防ぐことはできない。
