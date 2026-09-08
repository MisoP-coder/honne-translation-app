import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/supabase/env';

/**
 * リクエストごとに Supabase のセッション(アクセストークン)を更新し、
 * 未ログインのユーザーを /login にリダイレクトします。
 */
export async function proxy(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // getUser() を呼ぶことでトークンが検証・更新される(getSession() では更新されない)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  // / は未ログインなら紹介ページを出すため、リダイレクトの対象から外す
  const isPublicRoute =
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/terms');
  // API は HTML へのリダイレクトではなく、ルート側で 401 の JSON を返させる
  const isApiRoute = pathname.startsWith('/api');

  if (!user && !isPublicRoute && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
