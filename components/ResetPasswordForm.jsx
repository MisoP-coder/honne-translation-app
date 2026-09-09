'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { createClient } from '@/lib/supabase/client';
import { translateAuthError } from '@/lib/authErrors';
import { theme, FONT_HEAD, primaryBtn, card, inputStyle } from '@/lib/theme';

const MIN_LENGTH = 8;

export default function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  // 「セッションを確認中」の状態。リンクが切れていると done にも form にも進ませない
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);

  // 手元の Cookie を見るだけなので通信を待たずに済む。
  // 期限切れのセッションだった場合は、下の updateUser がエラーを返して気づける
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        if (!alive) return;
        if (!data?.session) setExpired(true);
      } catch {
        if (alive) setExpired(true);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (pending) return;

    if (password !== confirm) {
      setError('確認用のパスワードが一致しません。');
      return;
    }

    setPending(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setPending(false);
    }
  };

  const shell = { display: 'flex', flexDirection: 'column', justifyContent: 'center' };

  if (!ready) {
    return (
      <div className="ht-shell" style={shell}>
        <p style={{ fontSize: 13, color: theme.inkMuted, margin: 0 }}>確認しています…</p>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="ht-shell" style={shell}>
        <h1 style={{ fontFamily: FONT_HEAD, fontSize: 22, fontWeight: 700, margin: '0 0 10px' }}>
          リンクの有効期限が切れています
        </h1>
        <p style={{ fontSize: 13, color: theme.inkMuted, margin: '0 0 20px', lineHeight: 1.9 }}>
          お手数ですが、ログイン画面の「パスワードを忘れた方はこちら」から、もう一度メールをお送りください。
          メールは、リクエストしたときと同じブラウザで開いてください。
        </p>
        <Link href="/login" style={{ ...primaryBtn, textAlign: 'center', textDecoration: 'none' }}>
          ログイン画面へ
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="ht-shell" style={shell}>
        <h1 style={{ fontFamily: FONT_HEAD, fontSize: 22, fontWeight: 700, margin: '0 0 10px' }}>
          パスワードを変更しました
        </h1>
        <p style={{ fontSize: 13, color: theme.inkMuted, margin: '0 0 20px', lineHeight: 1.9 }}>
          次回からは、新しいパスワードでログインしてください。このままアプリを使えます。
        </p>
        <Link href="/" style={{ ...primaryBtn, textAlign: 'center', textDecoration: 'none' }}>
          アプリへ進む
        </Link>
      </div>
    );
  }

  return (
    <div className="ht-shell" style={shell}>
      <h1 style={{ fontFamily: FONT_HEAD, fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>
        新しいパスワード
      </h1>
      <p style={{ fontSize: 13, color: theme.inkMuted, margin: '0 0 20px', lineHeight: 1.8 }}>
        {MIN_LENGTH}文字以上で決めてください。設定するとそのままログインした状態になります。
      </p>

      <form onSubmit={submit} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label
            htmlFor="new-password"
            style={{ fontSize: 13, color: theme.inkMuted, display: 'block', marginBottom: 6 }}
          >
            新しいパスワード
          </label>
          <input
            id="new-password"
            type="password"
            required
            minLength={MIN_LENGTH}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`${MIN_LENGTH}文字以上`}
            style={inputStyle}
          />
        </div>

        <div>
          <label
            htmlFor="confirm-password"
            style={{ fontSize: 13, color: theme.inkMuted, display: 'block', marginBottom: 6 }}
          >
            確認のため、もう一度
          </label>
          <input
            id="confirm-password"
            type="password"
            required
            minLength={MIN_LENGTH}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="同じものをもう一度"
            style={inputStyle}
          />
        </div>

        {error && (
          <p style={{ color: theme.danger, fontSize: 13, margin: 0, lineHeight: 1.8 }}>{error}</p>
        )}

        <button type="submit" disabled={pending} style={{ ...primaryBtn, opacity: pending ? 0.6 : 1 }}>
          {pending ? '変更中…' : 'このパスワードにする'}
        </button>
      </form>
    </div>
  );
}
