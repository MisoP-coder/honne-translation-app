import './globals.css';

import { SITE_URL, SHARE_TEXT } from '@/lib/constants';

const TITLE = '言いにくいことの翻訳';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: SHARE_TEXT,
  // SNS でリンクを共有したときに、タイトル・説明文・アイキャッチが表示されるようにする
  openGraph: {
    type: 'website',
    siteName: TITLE,
    title: TITLE,
    description: SHARE_TEXT,
    url: SITE_URL,
    locale: 'ja_JP',
    images: [{ url: '/ogp.png', width: 1200, height: 630, alt: `${TITLE} のアイキャッチ` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: SHARE_TEXT,
    images: ['/ogp.png'],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
