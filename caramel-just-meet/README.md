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

## ランキングを本物にするには

`src/ranking/types.ts` の `RankingRepository` を実装して `App` の `rankingRepository` に渡す。
詳しくは仕様書の「6. 世界ランキング（モック）」。
