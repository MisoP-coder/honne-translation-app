'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * ブラウザ側の Supabase クライアント。
 * anon key しか使わないため、RLS(supabase/schema.sql)が実質的な認可になります。
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
