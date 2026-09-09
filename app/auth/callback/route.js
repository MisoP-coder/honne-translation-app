import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

/**
 * マジックリンク / メール確認からの戻り先。
 * URL の ?code= をセッションに交換してからアプリ本体へ送ります。
 */
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // 自サイト内のパスだけを戻り先として認める(外部サイトへの転送に使われないように)
  const requestedNext = searchParams.get('next') ?? '/';
  const next = /^\/(?!\/)/.test(requestedNext) ? requestedNext : '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
