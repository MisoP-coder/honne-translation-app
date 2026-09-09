/**
 * Supabase から返る英語のエラーメッセージを、日本語の案内文に置き換えます。
 * ログイン画面とパスワード再設定画面の両方から使います。
 */
export function translateAuthError(error) {
  const message = String(error?.message || '');
  const lower = message.toLowerCase();

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
  if (message.includes('New password should be different')) {
    return '今までと違うパスワードを入力してください。';
  }
  // 再設定リンクの期限切れ・使用済み、もしくは別のブラウザで開いた場合
  if (
    lower.includes('auth session missing') ||
    lower.includes('session_not_found') ||
    lower.includes('session from session_id claim in jwt does not exist')
  ) {
    return 'リンクの有効期限が切れているようです。お手数ですが、もう一度メールを送るところからやり直してください。';
  }
  if (lower.includes('email rate limit') || lower.includes('over_email_send_rate_limit')) {
    return 'メールの送信が集中しています。10分ほどおいてから、もう一度お試しください。';
  }
  if (lower.includes('for security purposes, you can only request this after')) {
    return '続けて送信はできません。1分ほどおいてから、もう一度お試しください。';
  }
  if (lower.includes('rate limit')) {
    return '試行回数が多すぎます。少し時間をおいてからお試しください。';
  }
  if (message.includes('Invalid path') || message.includes('requested path is invalid')) {
    return '接続先の設定が正しくないようです(NEXT_PUBLIC_SUPABASE_URL を確認してください)。';
  }
  return message || 'うまくいきませんでした。もう一度お試しください。';
}
