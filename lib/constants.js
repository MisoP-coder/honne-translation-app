/**
 * 誰に伝えるか。プロフィールごとに1つ選ぶ。
 * 相手が変わると、聞くべき情報・連絡手段・文面の作り方がすべて変わるため、
 * 質問セットからプロンプトまでこのキーで切り替える。
 */
export const TARGET_TYPES = [
  { key: 'boss', label: '職場の上司', namePlaceholder: '例:田中部長' },
  { key: 'teacher', label: '園・学校の先生', namePlaceholder: '例:田中先生' },
];

export const DEFAULT_TARGET_TYPE = 'boss';

export function targetType(profile) {
  const key = profile?.target_type;
  return TARGET_TYPES.some((t) => t.key === key) ? key : DEFAULT_TARGET_TYPE;
}

export function targetLabel(type) {
  return TARGET_TYPES.find((t) => t.key === type)?.label ?? '相手';
}

/** 質問。type が 'text' のものは自由入力、省略時は選択式 */
const BOSS_QUESTIONS = [
  { key: 'reaction', label: '反応のタイプ', options: ['感情的', '冷静'], default: '冷静' },
  { key: 'order', label: '聞きたい順番', options: ['結論から', '経緯から'], default: '結論から' },
  {
    key: 'channel',
    label: '好む連絡手段',
    options: ['対面・電話', 'チャット・メール'],
    default: 'チャット・メール',
  },
  {
    key: 'detail',
    label: '確認の細かさ',
    options: ['細かく確認したい', '任せてほしい'],
    default: '任せてほしい',
  },
  { key: 'mistake', label: 'ミスへの反応', options: ['厳しめ', '寛容め'], default: '寛容め' },
];

const TEACHER_QUESTIONS = [
  {
    key: 'facility',
    label: '施設の種別',
    options: ['保育園・幼稚園', '小学校', '中学校・高校', '学童・習い事'],
    default: '小学校',
  },
  {
    key: 'role',
    label: '相手の立場',
    options: ['担任', '担任以外の先生', '園長・校長・主任'],
    default: '担任',
  },
  { key: 'grade', label: '子どもの学年', type: 'text', placeholder: '例:年中 / 小2' },
  {
    key: 'method',
    label: '普段の連絡手段',
    options: ['連絡帳', '口頭', '電話', 'メール・アプリ'],
    default: '連絡帳',
  },
  {
    key: 'impression',
    label: '先生の印象',
    options: ['話しやすい', 'ふつう', '話しにくい', 'まだ分からない'],
    default: 'ふつう',
  },
];

const QUESTIONS = { boss: BOSS_QUESTIONS, teacher: TEACHER_QUESTIONS };

export function questionsFor(type) {
  return QUESTIONS[type] ?? BOSS_QUESTIONS;
}

/** 自由記述欄の見出しと例。相手によって書いてほしいことが違う */
export const NOTE_FIELD = {
  boss: {
    label: '地雷ワード・NGな言い方(任意)',
    placeholder: '例:「できません」という言い方をすると特に不機嫌になる',
  },
  teacher: {
    label: '過去に気をつけたこと(任意)',
    placeholder: '例:前回まとめて何件も伝えたら、返事が事務的になった',
  },
};

export const OUTCOMES = ['うまくいった', '様子見', 'こじれた'];

/** 今回どの手段で伝えるか。相手の普段の手段とは別に、相談ごとに選ぶ */
const CHANNELS_BY_TARGET = {
  boss: ['対面', '電話', 'メール', 'チャット'],
  teacher: ['連絡帳', '口頭', '電話', 'メール・アプリ'],
};

export function channelsFor(type) {
  return CHANNELS_BY_TARGET[type] ?? CHANNELS_BY_TARGET.boss;
}

/** 先生に伝える場面。文面の慎重さがシーンによって大きく変わるため、相談ごとに選ぶ */
export const SCENE_TYPES = [
  '体調・欠席の連絡',
  '持ち物・提出物',
  '学習・宿題の相談',
  '友だち関係・トラブル',
  'いじめ・安全面',
  '先生の対応への相談',
  '行事・スケジュール',
  'その他',
];

/** 事実確認を優先し、断定を避ける必要があるシーン */
export const SENSITIVE_SCENES = ['友だち関係・トラブル', 'いじめ・安全面', '先生の対応への相談'];

/**
 * 相談欄に出す例文。
 * 「何をどう書けばいいか分からない」で手が止まるのを防ぐのが目的なので、
 * そのまま書き写せるくらい具体的な一文にしている。
 */
const BOSS_EXAMPLE = '例:納期に3日遅れそうと今日中に伝える必要がある';

const SCENE_EXAMPLES = {
  '体調・欠席の連絡': '例:熱は下がったが、念のため明日も休ませたい',
  '持ち物・提出物': '例:持ち物の連絡が配布物と食い違っていて子どもが困っている',
  '学習・宿題の相談': '例:宿題に毎晩2時間かかっていて、寝る時間が遅くなっている',
  '友だち関係・トラブル': '例:休み時間に嫌なことを言われたと子どもが話している',
  'いじめ・安全面': '例:登下校中に持ち物を隠されることが続いていると子どもが話している',
  '先生の対応への相談': '例:みんなの前で強く注意されたことを子どもが気にしている',
  '行事・スケジュール': '例:運動会の振替休日と家族の予定が重なってしまった',
  その他: '例:家庭の事情で送り迎えの時間を変えたい',
};

export function situationPlaceholder(profile, scene) {
  if (targetType(profile) !== 'teacher') return BOSS_EXAMPLE;
  return SCENE_EXAMPLES[scene] ?? SCENE_EXAMPLES['その他'];
}

/** 各手段が、上司プロフィールのどちらの好みに当たるか */
const CHANNEL_GROUP = {
  対面: '対面・電話',
  電話: '対面・電話',
  メール: 'チャット・メール',
  チャット: 'チャット・メール',
};

/** 相手の普段の手段と違う場合に出す注意文。合っていれば空文字 */
export function channelMismatchNote(profile, channel) {
  const type = targetType(profile);
  const traits = normalizeTraits(profile?.traits, type);
  if (type === 'teacher') {
    return traits.method && traits.method !== channel ? traits.method : '';
  }
  const group = CHANNEL_GROUP[channel] ?? '';
  return group && group !== traits.channel ? traits.channel : '';
}

/** 相手の普段の手段に合わせた初期値。多くの場合はこれで当たる */
export function defaultChannel(profile) {
  const type = targetType(profile);
  const traits = normalizeTraits(profile?.traits, type);
  const list = channelsFor(type);
  if (type === 'teacher') {
    return list.includes(traits.method) ? traits.method : list[0];
  }
  return traits.channel === '対面・電話' ? '対面' : 'メール';
}

/** 上司一覧に出す1行の要約 */
export function traitsSummary(profile) {
  const type = targetType(profile);
  const t = normalizeTraits(profile?.traits, type);
  if (type === 'teacher') {
    return [t.facility, t.grade, t.method].filter(Boolean).join(' ・ ');
  }
  return [t.reaction, t.order, t.channel].filter(Boolean).join(' ・ ');
}

/** 結果画面のリスク表示の見出し。相手によって言葉を変える */
export const RISK_LABELS = {
  boss: { trust: '信頼', tone: '温度感' },
  teacher: { trust: '関係性', tone: '受け取られ方' },
};

export function riskLabels(type) {
  return RISK_LABELS[type] ?? RISK_LABELS.boss;
}

export function loadingMessages(type) {
  const who = type === 'teacher' ? '先生のタイプ' : '上司のタイプ';
  return [`${who}を確認中…`, '言い回しの候補を作成中…', '関係性への影響を予測中…'];
}

/**
 * 1人あたりの1日の上限。
 * 無料枠のための制限ではなく、連打や不具合で原価が暴走する事故を防ぐためのもの。
 */
export const DAILY_LIMIT = 20;

/**
 * アプリ全体の1日の上限。
 * 1人あたりの上限だけでは「利用者数 × 20回」に上限が無く、人が増えるほど
 * 請求が伸びてしまうため、全体にも蓋をする。
 *
 * 1回あたりの原価はおよそ2.1円(claude-sonnet-5、150円/$換算)なので、
 *   100回 × 2.1円 ≒ 210円/日 ≒ 月6,300円が最大
 * になる。予算に合わせてこの数字だけを変えればよい。
 */
export const GLOBAL_DAILY_LIMIT = 100;

/** 無料公開の期限。告知やアプリ内の表示に使う */
export const FREE_UNTIL = '2026年9月30日';

/** 実績データを判断の主軸にするために必要な件数 */
export const RECORDS_THRESHOLD = 2;

/** 質問セットから既定値を組み立てる。選択式は先頭、自由入力は空文字 */
export function emptyTraits(type = DEFAULT_TARGET_TYPE) {
  const out = {};
  for (const q of questionsFor(type)) {
    out[q.key] = q.type === 'text' ? '' : (q.default ?? q.options[0]);
  }
  return out;
}

/** DB から取り出した traits に欠けているキーを既定値で埋める */
export function normalizeTraits(traits, type = DEFAULT_TARGET_TYPE) {
  return { ...emptyTraits(type), ...(traits || {}) };
}

/** 公開URL。シェアリンクと OGP の既定値に使う */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://honne.misop-craft.com';

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

/**
 * 法務ページに載せる運営者情報。
 * 公開前に必ず実際の値へ書き換えること(未記入だとページに注意書きが出ます)。
 */
export const OPERATOR = {
  name: 'Miso-P',
  contact: 'misop.craft@gmail.com',
};

/** 法務ページの最終更新日 */
export const LEGAL_UPDATED_AT = '2026年9月8日';
