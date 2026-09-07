'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';
import { theme, FONT_HEAD, primaryBtn, card, inputStyle } from '@/lib/theme';

const MODES = [
  { key: 'signin', label: 'ログイン' },
  { key: 'signup', label: '新規登録' },
  { key: 'magic', label: 'メールリンク' },
];

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const needsPassword = mode !== 'magic';

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
        setNotice('確認メールを送りました。メール内のリンクを開くと登録が完了します。');
        return;
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (otpError) throw otpError;
      setNotice('ログイン用のリンクをメールで送りました。');
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="ht-shell" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <h1 style={{ fontFamily: FONT_HEAD, fontSize: 24, fontWeight: 700, margin: '0 0 6px' }}>
        言いにくいことの翻訳
      </h1>
      <p style={{ fontSize: 13, color: theme.inkMuted, margin: '0 0 24px' }}>
        上司ごとの傾向と、これまでの結果を覚えておくためにログインします。
      </p>

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
              onClick={() => {
                setMode(m.key);
                setError(null);
                setNotice(null);
              }}
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

        {error && <p style={{ color: theme.danger, fontSize: 13, margin: 0 }}>{error}</p>}
        {notice && <p style={{ color: theme.safe, fontSize: 13, margin: 0 }}>{notice}</p>}

        <button type="submit" disabled={pending} style={{ ...primaryBtn, opacity: pending ? 0.6 : 1 }}>
          {pending ? '送信中…' : MODES.find((m) => m.key === mode).label}
        </button>
      </form>

      <p style={{ fontSize: 12, color: theme.inkMuted, marginTop: 16, lineHeight: 1.7 }}>
        入力した内容は、あなたのアカウントからのみ見られます。
      </p>
    </div>
  );
}

function translateAuthError(error) {
  const message = String(error?.message || '');
  if (message.includes('Invalid login credentials')) {
    return 'メールアドレスまたはパスワードが違います。';
  }
  if (message.includes('User already registered')) {
    return 'このメールアドレスは登録済みです。「ログイン」からお進みください。';
  }
  if (message.includes('Email not confirmed')) {
    return 'メールの確認が済んでいません。届いたメールのリンクを開いてください。';
  }
  if (message.includes('Password should be')) {
    return 'パスワードは8文字以上にしてください。';
  }
  if (message.toLowerCase().includes('rate limit')) {
    return '試行回数が多すぎます。少し時間をおいてからお試しください。';
  }
  return message || 'うまくいきませんでした。もう一度お試しください。';
}
