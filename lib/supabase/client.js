'use client';

import { createBrowserClient } from '@supabase/ssr';

import { getSupabaseUrl, getSupabaseAnonKey } from './env';

/**
 * ブラウザ側の Supabase クライアント。
 * anon key しか使わないため、RLS(supabase/schema.sql)が実質的な認可になります。
 */
export function createClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
}
