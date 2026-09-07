import './globals.css';

import { SITE_URL, SHARE_TEXT } from '@/lib/constants';

const TITLE = '言いにくいことの翻訳';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: SHARE_TEXT,
  // SNS でリンクを共有したときに、タイトルと説明文が表示されるようにする
  openGraph: {
    type: 'website',
    siteName: TITLE,
    title: TITLE,
    description: SHARE_TEXT,
    url: SITE_URL,
    locale: 'ja_JP',
  },
  twitter: {
    card: 'summary',
    title: TITLE,
    description: SHARE_TEXT,
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
