# 要約の達人 〜上司の長文LINEを1文字で読め〜

降ってくる上司の長文 LINE（絵文字まみれのおじさん構文）をタップで要約し、飛び出した結論だけを要約カゴでキャッチするゲーム。
「明日休み…なんてネ😜」のひっかけを見抜きながら、9:00 から 18:00 まで耐えれば定時退社。
Expo (React Native) + TypeScript。仕様は [docs/spec.md](docs/spec.md)。

カラメル乗せゲーム（`../caramel-just-meet/`）とは別のアプリです。コード・音・保存データ・公開先をすべて分けています
（音の管理やボタンなどの部品は、カラメル乗せゲームのものを `src/shared/` に写して使っています）。

## 動かし方

```bash
cd line-summary
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

`assets/sounds/` の音はすべて `scripts/generate_sounds.py` で波形から合成した自作の音源です（外部の音源は使っていません）。
作り直すときは `python3 scripts/generate_sounds.py`（numpy が必要）。

## 公開する（Cloudflare Pages）

GitHub Actions（`.github/workflows/line-summary-cloudflare-pages.yml`）が、main の `line-summary/` が更新されるたびに
テスト → ビルド → Cloudflare Pages へのアップロードを行います。Cloudflare の API トークンとアカウント ID は、
カラメル乗せゲームで設定したもの（GitHub の Secrets）をそのまま使います。

最初の公開で Pages のプロジェクト `line-summary` が作られ、`https://line-summary.pages.dev` で開けます。
独自ドメイン（例：`line.misop-craft.com`）にするときは、カラメル乗せゲームの README の「独自ドメイン」と同じ手順で、
Pages の **Custom domains** に追加し、お名前.com の DNS に CNAME を足します。そのあとワークフローの `EXPO_PUBLIC_SITE_URL` も書き換えます。

### 手元でブラウザ版をビルドする
```bash
npm run build:web      # dist/ にできる
```
