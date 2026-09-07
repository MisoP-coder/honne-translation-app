import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { getSupabaseUrl, getSupabaseAnonKey } from './env';

/**
 * サーバーコンポーネント / Route Handler 用の Supabase クライアント。
 * Cookie に保存されたセッションを読み書きします。
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // サーバーコンポーネントからは Cookie を書けない。
          // セッション更新は proxy.js が担当するため、ここでは無視して良い。
        }
      },
    },
  });
}
