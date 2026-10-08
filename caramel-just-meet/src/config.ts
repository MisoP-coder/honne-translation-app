/**
 * 公開時の設定。EXPO_PUBLIC_ で始まる環境変数は、ビルドのときにアプリに埋め込まれる
 * （ブラウザから見える値なので、秘密の鍵は入れないこと）。
 * 設定方法は README の「公開する」を参照。
 */
export const config = {
  /** Supabase のプロジェクト URL（例: https://xxxx.supabase.co）。空ならサンプルのランキングになる */
  supabaseUrl: (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, ''),
  /** Supabase の公開キー（anon / publishable）。RLS とサーバー側の関数で守られている前提の公開鍵 */
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  /** 公開サイトの URL（X のシェアに付ける）。空ならブラウザでは今のページの URL を使う */
  siteUrl: (process.env.EXPO_PUBLIC_SITE_URL ?? '').replace(/\/+$/, ''),
};

export function hasSupabase(): boolean {
  // 本番は https。開発用に、手元で動かす Supabase（http://127.0.0.1:54321 など）も許す
  const okUrl = /^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(config.supabaseUrl);
  return okUrl && config.supabaseAnonKey.length > 0;
}
