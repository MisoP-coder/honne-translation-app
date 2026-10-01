import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

/**
 * マジックリンク / メール確認 / メールアドレスの登録からの戻り先。
 *
 * リンクの形は設定によって2通りある。
 *   - ?code=...                  … PKCE。セッションに交換する
 *   - ?token_hash=...&type=...   … 確認トークン。verifyOtp で確認する
 * どちらで来ても受けられるようにしておく。
 */
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  // 自サイト内のパスだけを戻り先として認める(外部サイトへの転送に使われないように)
  const requestedNext = searchParams.get('next') ?? '/';
  const next = /^\/(?!\/)/.test(requestedNext) ? requestedNext : '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  } else if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
