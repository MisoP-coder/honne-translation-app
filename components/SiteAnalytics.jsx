'use client';

import { Analytics } from '@vercel/analytics/next';

/**
 * 訪問者数を数えるためのもの(Vercel Web Analytics)。
 * Cookie を使わず、個人を特定しない集計だけを行う。
 *
 * URL のクエリ文字列は送る前に落としてパスだけにする。
 * ログインや再設定のリンクには一時的なトークンが載ることがあり、
 * それを集計サービスに渡す必要はないため。
 */
export default function SiteAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        try {
          const url = new URL(event.url);
          return { ...event, url: `${url.origin}${url.pathname}` };
        } catch {
          // URL として読めない場合は、そのまま送らずに捨てる
          return null;
        }
      }}
    />
  );
}
