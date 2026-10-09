// Web 版のビルド（npx expo export -p web）のあとに実行する。
//
// 1. シェア用カードの画像 URL は「https:// から始まる完全な URL」でないと X に表示されないので、
//    dist/index.html の %SITE_URL% を公開先の URL に置き換える。
//      1) EXPO_PUBLIC_SITE_URL（自分で設定した URL。独自ドメインを使うとき）
//      2) VERCEL_PROJECT_PRODUCTION_URL（Vercel が自動で入れる本番の URL）
//      3) CF_PAGES_URL（Cloudflare Pages が自動で入れる URL。デプロイごとに変わるので、本番では 1 を設定すること）
// 2. Google AdSense のパブリッシャー ID（EXPO_PUBLIC_ADSENSE_CLIENT）があれば、
//    サイトの確認用のタグと広告の読み込みスクリプトを <head> に入れ、ads.txt を作る。
import { readFileSync, writeFileSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
const file = new URL('index.html', dist);
const raw =
  process.env.EXPO_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
  process.env.CF_PAGES_URL ||
  '';
const siteUrl = raw.replace(/\/+$/, '');

let html = readFileSync(file, 'utf8');
if (!siteUrl) {
  console.warn('[postbuild-web] 公開 URL がわからないので、シェア用カードの画像は相対パスのままです（X では表示されません）。');
}
html = html.replaceAll('%SITE_URL%', siteUrl);
console.log(`[postbuild-web] SITE_URL = ${siteUrl || '(なし)'}`);

const client = (process.env.EXPO_PUBLIC_ADSENSE_CLIENT ?? '').trim();
if (/^ca-pub-\d{10,20}$/.test(client)) {
  const tags = [
    `<meta name="google-adsense-account" content="${client}">`,
    `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}" crossorigin="anonymous"></script>`,
  ].join('\n    ');
  html = html.replace('</head>', `    ${tags}\n  </head>`);
  // ads.txt：このサイトで広告を売ってよい相手を宣言する（f08c47fec0942fa0 は Google の固定の ID）
  writeFileSync(new URL('ads.txt', dist), `google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`);
  console.log(`[postbuild-web] AdSense = ${client}（ads.txt を作成）`);
} else if (client) {
  console.warn(`[postbuild-web] EXPO_PUBLIC_ADSENSE_CLIENT の形が正しくないので、広告は入れません: ${client}`);
} else {
  console.log('[postbuild-web] AdSense の設定なし（広告は出しません）');
}

writeFileSync(file, html);
