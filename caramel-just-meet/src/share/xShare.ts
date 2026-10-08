import { Linking, Platform } from 'react-native';

import { config } from '../config';
import { titleFor } from '../game/titles';

export const GAME_TITLE = '極限！カラメル・ジャスト・ミート';
export const HASHTAG = '#カラメルジャストミート';
const X_INTENT_URL = 'https://x.com/intent/tweet';

export function buildShareText(combo: number): string {
  return `【${GAME_TITLE}】プリンの頂点にカラメルを${combo}連続で乗せた！ 称号：${titleFor(combo)} ${HASHTAG}`;
}

/**
 * シェアに付けるゲームの URL。設定（EXPO_PUBLIC_SITE_URL）があればそれ、
 * なければブラウザ版では今開いているページ。どちらもなければ付けない。
 */
export function gameUrl(): string {
  if (config.siteUrl) return config.siteUrl;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && /^https?:/.test(window.location?.protocol ?? '')) {
    return `${window.location.origin}${window.location.pathname}`;
  }
  return '';
}

/** X の投稿画面を開く URL（アプリが入っていればユニバーサルリンクでアプリが開く） */
export function buildXShareUrl(text: string, url: string = gameUrl()): string {
  const params = [`text=${encodeURIComponent(text)}`];
  // URL を付けると、投稿にゲームのカード（OGP 画像）が出て、見た人がそのまま遊べる
  if (url) params.push(`url=${encodeURIComponent(url)}`);
  return `${X_INTENT_URL}?${params.join('&')}`;
}

/** X のシェア画面を開く。開けなかったら false を返す */
export async function shareToX(combo: number): Promise<boolean> {
  try {
    await Linking.openURL(buildXShareUrl(buildShareText(combo)));
    return true;
  } catch {
    return false;
  }
}
