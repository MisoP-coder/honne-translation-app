import { Linking } from 'react-native';

import { titleFor } from '../game/titles';

export const GAME_TITLE = '極限！カラメル・ジャスト・ミート';
export const HASHTAG = '#カラメルジャストミート';
const X_INTENT_URL = 'https://x.com/intent/tweet';

export function buildShareText(combo: number): string {
  return `【${GAME_TITLE}】プリンの頂点にカラメルを${combo}連続で乗せた！ 称号：${titleFor(combo)} ${HASHTAG}`;
}

/** X の投稿画面を開く URL（アプリが入っていればユニバーサルリンクでアプリが開く） */
export function buildXShareUrl(text: string): string {
  return `${X_INTENT_URL}?text=${encodeURIComponent(text)}`;
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
