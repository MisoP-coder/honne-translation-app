/**
 * 環境変数から Supabase の接続情報を取り出す。
 *
 * コピペで紛れ込みやすい前後の空白・改行と、末尾のスラッシュを取り除く。
 * 末尾に「/」が付いていると実際のリクエスト URL が
 * https://xxx.supabase.co//auth/v1/... のように「//」になり、
 * "Invalid path specified in request URL" で失敗するため。
 */
export function getSupabaseUrl() {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
}

export function getSupabaseAnonKey() {
  return (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
}
