'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';
import { translateAuthError } from '@/lib/authErrors';
import { theme, FONT_HEAD, primaryBtn, card, inputStyle } from '@/lib/theme';

const MODES = [
  { key: 'signin', label: 'ログイン' },
  { key: 'signup', label: '新規登録' },
  { key: 'magic', label: 'メールリンク' },
];

const SUBMIT_LABEL = {
  signin: 'ログイン',
  signup: '新規登録',
  magic: 'メールリンク',
  reset: '再設定メールを送る',
};

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  // /auth/callback がリンクの交換に失敗したときは ?error=auth で戻ってくる。
  // 再設定リンクの期限切れが一番多いので、その場で次の行動を書いておく
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'auth') {
      setError(
        'リンクを確認できませんでした。期限が切れているか、メールを開いたブラウザが違う可能性があります。もう一度お試しください。'
      );
    }
  }, []);

  const isReset = mode === 'reset';
  const needsPassword = mode === 'signin' || mode === 'signup';

  const switchMode = (next) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);
    setNotice(null);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback`;

    try {
      if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        router.replace('/');
        router.refresh();
        return;
      }

      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          router.replace('/');
          router.refresh();
          return;
        }
        setNotice(
          '確認メールを送りました。差出人「Supabase Auth」・件名「Confirm Your Signup」の英語のメールですが、このアプリからのものです。中の「Confirm your mail」を押すと登録が完了します。'
        );
        return;
      }

      if (mode === 'reset') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${redirectTo}?next=/reset-password`,
        });
        if (resetError) throw resetError;
        // 登録の有無は伝えない(伝えると、誰が登録しているかを外から調べられてしまう)
        setNotice(
          'パスワード再設定用のリンクをメールで送りました。差出人「Supabase Auth」・件名「Reset Your Password」の英語のメールですが、このアプリからのものです。中の「Reset password」を、この画面を開いたままのブラウザで開いてください。届かない場合は迷惑メールもご確認ください。'
        );
        return;
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (otpError) throw otpError;
      setNotice(
        'ログイン用のリンクをメールで送りました。差出人「Supabase Auth」・件名「Your Magic Link」の英語のメールですが、このアプリからのものです。中の「Log In」を、この画面を開いたままのブラウザで開いてください。'
      );
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="ht-shell" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <h1 style={{ fontFamily: FONT_HEAD, fontSize: 24, fontWeight: 700, margin: '0 0 6px' }}>
        {isReset ? 'パスワードの再設定' : '言いにくいことの翻訳'}
      </h1>
      <p style={{ fontSize: 13, color: theme.inkMuted, margin: '0 0 24px', lineHeight: 1.8 }}>
        {isReset
          ? '登録したメールアドレスを入力してください。新しいパスワードを決めるためのリンクをお送りします。'
          : '上司ごとの傾向と、これまでの結果を覚えておくためにログインします。'}
      </p>

      {!isReset && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 6,
            marginBottom: 16,
          }}
        >
          {MODES.map((m) => {
            const active = mode === m.key;
            return (
              <button
                key={m.key}
                type="button"
                className="ht-toggle"
                onClick={() => switchMode(m.key)}
                style={{
                  padding: '9px 4px',
                  borderRadius: 8,
                  border: `1px solid ${active ? theme.accent : theme.border}`,
                  background: active ? theme.accentSoft : '#fff',
                  color: active ? theme.accent : theme.inkMuted,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      )}

      <form onSubmit={submit} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label
            htmlFor="email"
            style={{ fontSize: 13, color: theme.inkMuted, display: 'block', marginBottom: 6 }}
          >
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={inputStyle}
          />
        </div>

        {needsPassword && (
          <div>
            <label
              htmlFor="password"
              style={{ fontSize: 13, color: theme.inkMuted, display: 'block', marginBottom: 6 }}
            >
              パスワード
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8文字以上"
              style={inputStyle}
            />
          </div>
        )}

        {error && <p style={{ color: theme.danger, fontSize: 13, margin: 0, lineHeight: 1.8 }}>{error}</p>}
        {notice && <p style={{ color: theme.safe, fontSize: 13, margin: 0, lineHeight: 1.8 }}>{notice}</p>}

        <button type="submit" disabled={pending} style={{ ...primaryBtn, opacity: pending ? 0.6 : 1 }}>
          {pending ? '送信中…' : SUBMIT_LABEL[mode]}
        </button>

        {mode === 'signin' && (
          <button
            type="button"
            onClick={() => switchMode('reset')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: theme.accent,
              fontSize: 13,
              textAlign: 'center',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            パスワードを忘れた方はこちら
          </button>
        )}

        {isReset && (
          <button
            type="button"
            onClick={() => switchMode('signin')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: theme.inkMuted,
              fontSize: 13,
              textAlign: 'center',
              cursor: 'pointer',
            }}
          >
            ← ログインに戻る
          </button>
        )}
      </form>

      <p style={{ fontSize: 12, color: theme.inkMuted, marginTop: 16, lineHeight: 1.7 }}>
        {isReset
          ? 'パスワードを設定せずに登録した場合(メールリンクでのログイン)は、そのまま「メールリンク」からログインできます。'
          : '入力した内容は、あなたのアカウントからのみ見られます。'}
      </p>
    </div>
  );
}
