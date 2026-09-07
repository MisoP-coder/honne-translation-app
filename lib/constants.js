export const TRAIT_QUESTIONS = [
  { key: 'reaction', label: '反応のタイプ', options: ['感情的', '冷静'] },
  { key: 'order', label: '聞きたい順番', options: ['結論から', '経緯から'] },
  { key: 'channel', label: '好む連絡手段', options: ['対面・電話', 'チャット・メール'] },
  { key: 'detail', label: '確認の細かさ', options: ['細かく確認したい', '任せてほしい'] },
  { key: 'mistake', label: 'ミスへの反応', options: ['厳しめ', '寛容め'] },
];

export const OUTCOMES = ['うまくいった', '様子見', 'こじれた'];

export const LOADING_MESSAGES = [
  '上司のタイプを確認中…',
  '言い回しの候補を作成中…',
  '関係性への影響を予測中…',
];

/** 実績データを判断の主軸にするために必要な件数 */
export const RECORDS_THRESHOLD = 3;

export function emptyTraits() {
  return {
    reaction: '冷静',
    order: '結論から',
    channel: 'チャット・メール',
    detail: '任せてほしい',
    mistake: '寛容め',
  };
}

/** DB から取り出した traits に欠けているキーを既定値で埋める */
export function normalizeTraits(traits) {
  return { ...emptyTraits(), ...(traits || {}) };
}

/** 公開URL。シェアリンクと OGP の既定値に使う */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://honne-translation-app.vercel.app';

/** シェア時に添える説明文。OGP の description にも使う */
export const SHARE_TEXT =
  '「これ、どう伝えよう…」と悩む上司への報告。相手のタイプに合わせた言い方を3つ提案してくれるアプリです。';

/** シェア先。url と text を渡すとリンクを組み立てる */
export const SHARE_TARGETS = [
  {
    key: 'x',
    label: 'X',
    // X は text と url を別々に受け取る
    build: (url, text) =>
      `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    key: 'facebook',
    label: 'Facebook',
    // Facebook は本文を受け付けないため、説明は OGP(app/layout.jsx)から読まれる
    build: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    key: 'line',
    label: 'LINE',
    build: (url, text) =>
      `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
];
