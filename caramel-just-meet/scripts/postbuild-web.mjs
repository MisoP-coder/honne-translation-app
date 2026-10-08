// Web 版のビルド（npx expo export -p web）のあとに実行する。
// シェア用カードの画像 URL は「https:// から始まる完全な URL」でないと X に表示されないので、
// dist/index.html の %SITE_URL% を公開先の URL に置き換える。
//   1. EXPO_PUBLIC_SITE_URL（自分で設定した URL。独自ドメインを使うとき）
//   2. VERCEL_PROJECT_PRODUCTION_URL（Vercel が自動で入れる本番の URL）
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../dist/index.html', import.meta.url);
const raw =
  process.env.EXPO_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
const siteUrl = raw.replace(/\/+$/, '');

const html = readFileSync(file, 'utf8');
if (!siteUrl) {
  console.warn('[postbuild-web] 公開 URL がわからないので、シェア用カードの画像は相対パスのままです（X では表示されません）。');
}
writeFileSync(file, html.replaceAll('%SITE_URL%', siteUrl));
console.log(`[postbuild-web] SITE_URL = ${siteUrl || '(なし)'}`);
