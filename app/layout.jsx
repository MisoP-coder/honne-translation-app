import './globals.css';

export const metadata = {
  title: '言いにくいことの翻訳',
  description:
    '上司に言いにくい報告・相談を、相手のタイプと過去の実績に合わせた言い方に翻訳するアプリ',
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
