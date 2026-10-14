import { Platform } from 'react-native';

import { lineTitleFor } from './game/engine';

/** 公開サイトの URL（X のシェアに付ける）。空ならブラウザでは今のページの URL を使う */
const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');

export interface ShareResult {
  cleared: boolean;
  score: number;
  caught: number;
  fakesDodged: number;
  clock: string;
  /** 神要約タイムに入った回数 */
  feverCount?: number;
}

export function shareText(r: ShareResult): string {
  const head = r.cleared
    ? `【定時退社】上司の長文LINEを ${r.caught} 件要約して、18:00 に帰れた🎉`
    : `【残業確定】${r.clock} に上司から着信…📞😡（要約 ${r.caught} 件）`;
  const fever = r.feverCount ? `／神要約タイム ${r.feverCount} 回✨` : '';
  return `${head}\nひっかけを見抜いた数：${r.fakesDodged}${fever}\nスコア ${r.score}／称号「${lineTitleFor(r.score)}」\n#要約の達人`;
}

function siteUrl(): string {
  if (SITE_URL) return SITE_URL;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}${window.location.pathname}`;
  return '';
}

/** X の投稿画面を開く URL */
export function shareUrl(r: ShareResult): string {
  const params = new URLSearchParams({ text: shareText(r) });
  const url = siteUrl();
  if (url) params.set('url', url);
  return `https://x.com/intent/post?${params.toString()}`;
}
