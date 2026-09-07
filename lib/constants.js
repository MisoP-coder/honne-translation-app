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
