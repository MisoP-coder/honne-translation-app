'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';
import { theme, primaryBtn } from '@/lib/theme';

/**
 * 紹介ページの「はじめる」ボタン。
 * メールアドレスを聞かずに匿名のセッションを作って、そのままアプリへ送る。
 *
 * 匿名ログインは Supabase 側で有効にしていないと失敗するので、
 * そのときは通常の登録画面へ案内する(入り口が閉じないようにする)。
 */
export default function StartAnonymously({ label = '登録せずにはじめる', note = null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const cta = {
    ...primaryBtn,
    display: 'block',
    width: '100%',
    textAlign: 'center',
    textDecoration: 'none',
    padding: '15px 16px',
    fontSize: 15,
  };

  const start = async () => {
    if (pending) return;
    setPending(true);
    setFailed(false);
    try {
      const { error } = await createClient().auth.signInAnonymously();
      if (error) throw error;
      router.replace('/');
      router.refresh();
    } catch {
      setFailed(true);
      setPending(false);
    }
  };

  // 匿名ログインが使えないときは、説明文も一緒に差し替える。
  // ボタンだけ替えると「入力はありません」が残って食い違う
  if (failed) {
    return (
      <>
        <Link href="/login" style={cta}>
          無料ではじめる
        </Link>
        <p
          style={{
            fontSize: 11,
            color: theme.danger,
            textAlign: 'center',
            margin: '8px 0 0',
            lineHeight: 1.7,
          }}
        >
          すぐに始める準備が整いませんでした。
          <br />
          メールアドレスの登録からお進みください。
        </p>
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={pending}
        style={{ ...cta, opacity: pending ? 0.6 : 1, cursor: pending ? 'default' : 'pointer' }}
      >
        {pending ? '準備しています…' : label}
      </button>
      {note && (
        <p
          style={{
            fontSize: 11,
            color: theme.inkMuted,
            textAlign: 'center',
            margin: '8px 0 0',
            lineHeight: 1.7,
          }}
        >
          {note}
        </p>
      )}
    </>
  );
}
