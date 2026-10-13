/**
 * 「要約の達人」のゲームの中身（画面に依存しない純粋な関数だけ）。
 * 画面は step() を毎フレーム、tapAt() をタップのたびに呼び、返ってきた状態を描くだけにする。
 * 乱数の内部状態も状態に持たせているので、同じシードなら同じ展開になる（テストしやすい）。
 *
 * 遊び方：
 * - 上司の長文 LINE（吹き出し）が降ってくる。タップすると「要約」できる。
 *   - 本物の結論が入っていた → 結論の単語が飛び出して落ちてくるので、要約カゴでキャッチ
 *   - ひっかけ（結論の単語のあとで打ち消している）→ ライフ −1
 *   - 結論なし → 上司のイライラ度が上がる
 * - 吹き出しや愚痴がカゴに当たると、全文まともに読まされてライフ −1
 * - 9:00 に始まり、18:00（約 60 秒）まで耐えれば「定時退社」でクリア
 */
import { nextRandom } from './rng';
import {
  CONCLUSION_WORDS,
  FAKE_TEXTS,
  GUCHI_WORDS,
  OJISAN_TEXTS,
  PRAISE_MIN_COMBO,
  PRAISES,
  RAGE_BLOCK_TEXT,
  REAL_TEXTS,
} from './texts';

/** bubble：上司の長文 LINE／guchi：短い愚痴（よけるだけ）／phone：ブチギレ中の即死ブロック／word：要約して出てきた結論 */
export type ItemKind = 'bubble' | 'guchi' | 'phone' | 'word';
/** 吹き出しの中身。real：本物の結論あり／fake：ひっかけ／none：結論なし */
export type BubbleType = 'real' | 'fake' | 'none';

export interface FallingItem {
  id: number;
  kind: ItemKind;
  /** 表示する文字。吹き出しでは結論の単語を {明日休み} のように波かっこで囲む */
  text: string;
  /** 中心の座標 */
  x: number;
  y: number;
  w: number;
  h: number;
  /** 落ちる速さ（px/秒） */
  vy: number;
  bubble?: BubbleType;
  /** 出てきた時刻（飛び出す演出に使う） */
  born: number;
}

/** キャッチした場所に浮かぶ「+120」など */
export interface Floater {
  id: number;
  x: number;
  y: number;
  text: string;
  tone: 'good' | 'bad';
  age: number;
}

/** 吹き出しを要約したときの演出 */
export interface Burst {
  id: number;
  x: number;
  y: number;
  type: BubbleType;
  age: number;
}

export type GameOverReason = 'lives' | 'phone';

export type LineEvent =
  | { type: 'summarize'; id: number; result: BubbleType }
  | { type: 'catch'; id: number; combo: number; points: number; praise: string | null }
  | { type: 'hit'; id: number; lives: number }
  | { type: 'overlook'; id: number }
  | { type: 'fake-dodged'; id: number }
  | { type: 'rage-start' }
  | { type: 'rage-end' }
  | { type: 'clear' }
  | { type: 'gameover'; reason: GameOverReason };

export interface LineConfig {
  width: number;
  height: number;
  basketWidth: number;
  basketHeight: number;
  /** 要約カゴの上端の y */
  basketTop: number;
}

export interface LineState {
  /** playing：業務中／clear：18:00 まで耐えて定時退社／over：力尽きた（残業確定） */
  status: 'playing' | 'clear' | 'over';
  time: number;
  score: number;
  combo: number;
  maxCombo: number;
  /** キャッチした結論の数 */
  caught: number;
  /** 要約せずに見送ったひっかけの数（見抜いた数） */
  fakesDodged: number;
  /** ひっかけを要約してしまった数 */
  fakesTaken: number;
  lives: number;
  /** 上司のイライラ度（0〜100） */
  mood: number;
  /** ブチギレの残り秒数。0 なら通常モード */
  rage: number;
  rageCount: number;
  basketX: number;
  items: FallingItem[];
  floaters: Floater[];
  bursts: Burst[];
  nextId: number;
  spawnTimer: number;
  phoneTimer: number;
  rng: number;
  /** 直前の step / tapAt で起きたこと（音や演出のきっかけに使う） */
  events: LineEvent[];
  lastCatchAt: number;
  lastHitAt: number;
  /** 直近のほめ言葉（コンボ演出用。id が変わったら新しく出す） */
  lastPraise: { id: number; text: string; combo: number } | null;
  overReason: GameOverReason | null;
  /** 定時退社のボーナス（クリアしたときだけ） */
  clearBonus: number;
}

export const MAX_LIVES = 3;
/** 1 日の業務（9:00〜18:00）の長さ（秒） */
export const DAY_SECONDS = 60;
export const DAY_START_HOUR = 9;
export const DAY_END_HOUR = 18;
/** この時刻（秒）から「定時前ラッシュ」で一気に忙しくなる */
export const RUSH_FROM = DAY_SECONDS - 9;

/** 本物の結論が入った吹き出しを見逃した（要約せずに画面の下へ）ときに上がるイライラ度 */
export const MOOD_OVERLOOK = 20;
/** 結論のない吹き出しを要約してしまったとき（「話、ちゃんと聞いてる？」） */
export const MOOD_NONE = 10;
/** ひっかけを要約してしまったとき（ライフも減る） */
export const MOOD_FAKE = 10;
/** 飛び出した結論をキャッチし損ねたとき */
export const MOOD_WORD_DROP = 5;
/** 結論をキャッチしたときに下がるイライラ度 */
export const MOOD_PER_CATCH = 10;
export const MOOD_MAX = 100;
/** ブチギレが続く秒数 */
export const RAGE_SECONDS = 10;
/** ブチギレ中のおじさん構文の落下スピードの倍率 */
export const RAGE_SPEED_MULTIPLIER = 2;
/** ブチギレ中は得点も 2 倍（ピンチはチャンス） */
export const RAGE_SCORE_MULTIPLIER = 2;
/** ブチギレが始まってから最初の「今すぐ電話しろ」が降ってくるまで（カットインを見せる時間） */
export const RAGE_FIRST_PHONE = 1.4;
export const RAGE_PHONE_INTERVAL = 2.2;
/** 1 回キャッチしたときの点（＋コンボごとに上乗せ） */
export const BASE_POINTS = 100;
export const COMBO_BONUS = 10;
/** ひっかけを見抜いて見送ったときの点 */
export const FAKE_DODGE_POINTS = 50;
/** 定時退社のボーナス（＋残りライフ 1 つにつき） */
export const CLEAR_BONUS = 1000;
export const CLEAR_BONUS_PER_LIFE = 500;
/** 最初の数秒はひっかけを出さない（まずは要約の気持ちよさを知ってもらう） */
export const NO_FAKE_UNTIL = 8;
/** タップの当たり判定を、吹き出しの外側にこれだけ広げる（指は太いので） */
export const TAP_SLOP = 10;
/** 飛び出した結論が、カゴのほうへ横に吸い寄せられる速さ（px/秒）。追いかけてゴミに突っ込まなくていいように */
export const WORD_HOMING = 300;
/** 飛び出した結論の落ちる速さ（吹き出しの何倍か） */
export const WORD_FALL = 2.4;
const FLOATER_SECONDS = 0.9;
const BURST_SECONDS = 0.6;

export function createLineConfig(width: number, height: number): LineConfig {
  const basketWidth = Math.round(Math.min(150, Math.max(100, width * 0.3)));
  const basketHeight = 50;
  return { width, height, basketWidth, basketHeight, basketTop: height - basketHeight - 24 };
}

export function createLineGame(seed: number, config?: LineConfig): LineState {
  return {
    status: 'playing',
    time: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    caught: 0,
    fakesDodged: 0,
    fakesTaken: 0,
    lives: MAX_LIVES,
    mood: 0,
    rage: 0,
    rageCount: 0,
    basketX: config ? config.width / 2 : 0,
    items: [],
    floaters: [],
    bursts: [],
    nextId: 1,
    spawnTimer: 0.4,
    phoneTimer: 0,
    rng: seed >>> 0,
    events: [],
    lastCatchAt: -1,
    lastHitAt: -1,
    lastPraise: null,
    overReason: null,
    clearBonus: 0,
  };
}

/** 経過秒を「10:30」のような時刻にする（9:00〜18:00） */
export function clockLabel(time: number): string {
  const t = Math.min(Math.max(time, 0), DAY_SECONDS);
  const minutes = Math.floor((t / DAY_SECONDS) * (DAY_END_HOUR - DAY_START_HOUR) * 60);
  const h = DAY_START_HOUR + Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** 要約カゴを x（中心）に動かす。画面からはみ出さないようにする */
export function moveBasket(state: LineState, config: LineConfig, x: number): LineState {
  const half = config.basketWidth / 2;
  const clamped = Math.min(config.width - half, Math.max(half, x));
  if (clamped === state.basketX) return state;
  return { ...state, basketX: clamped };
}

/** 経過時間に応じた落ちる速さ（画面の高さに比例。読む時間を残しつつ、だんだん速く） */
export function fallSpeed(time: number, height: number): number {
  const t = Math.min(time, DAY_SECONDS);
  return height * (0.16 + t * 0.002 + (t >= RUSH_FROM ? 0.04 : 0));
}

/** 次の吹き出しが降ってくるまでの秒数（だんだん短く、定時前ラッシュでさらに短く） */
export function spawnInterval(time: number): number {
  if (time >= RUSH_FROM) return 0.95;
  return Math.max(1.1, 2.0 - time * 0.018);
}

/**
 * 文字列の見た目の幅（全角 1 文字 = 1）。
 * 絵文字は少し広めに、半角英数字は狭めに数える。
 * 絵文字をつなぐ記号（異体字セレクタ・ZWJ・肌色）と、結論の目印の波かっこは幅を持たない。
 */
export function textWidth(text: string): number {
  let w = 0;
  for (const ch of Array.from(text)) {
    const code = ch.codePointAt(0) ?? 0;
    if (
      code === 0xfe0f ||
      code === 0x200d ||
      (code >= 0x1f3fb && code <= 0x1f3ff) ||
      code === 0x2640 ||
      code === 0x2642 ||
      ch === '{' ||
      ch === '}'
    ) {
      continue;
    }
    if (code < 0x80) w += 0.6;
    else if (code >= 0x1f000) w += 1.25;
    else w += 1;
  }
  return w;
}

/** 吹き出しの文字を、ふつうの部分と結論の部分（波かっこの中）に分ける */
export function splitConclusion(text: string): { text: string; conclusion: boolean }[] {
  const out: { text: string; conclusion: boolean }[] = [];
  const re = /\{([^}]*)\}/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), conclusion: false });
    out.push({ text: m[1], conclusion: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), conclusion: false });
  return out;
}

/** 吹き出しに入っている結論の単語（なければ null） */
export function conclusionOf(text: string): string | null {
  return splitConclusion(text).find((p) => p.conclusion)?.text ?? null;
}

/** おじさん構文の吹き出しの文字の大きさ（画面の描画と当たり判定で共通） */
export const BUBBLE_FONT_SIZE = 13;
export const BUBBLE_LINE_HEIGHT = 18;
export const BUBBLE_PADDING_X = 10;
export const BUBBLE_PADDING_Y = 8;
export const WORD_FONT_SIZE = 18;
export const GUCHI_FONT_SIZE = 15;
export const PHONE_HEIGHT = 92;
/** よけるための、カゴの左右に残す余裕（px） */
export const DODGE_MARGIN = 14;

/** ゴミがよけられる幅のうち、いちばん広い隙間（カゴの幅＋余裕）を残せる最大の幅 */
export function maxBlockWidth(fieldWidth: number, basketWidth: number): number {
  return Math.max(40, fieldWidth - basketWidth - DODGE_MARGIN * 2);
}

/**
 * テキストの種類ごとの大きさ（吹き出しの幅と高さ）。
 * ゴミはどれも、横にカゴが通れる隙間が残る幅までにする（よけられないゴミを作らない）。
 */
export function measureItem(
  kind: ItemKind,
  text: string,
  fieldWidth: number,
  basketWidth = 100,
): { w: number; h: number } {
  const cap = maxBlockWidth(fieldWidth, basketWidth);
  switch (kind) {
    case 'word':
      return { w: Math.ceil(textWidth(text) * WORD_FONT_SIZE + 30), h: 42 };
    case 'guchi':
      return { w: Math.min(cap, Math.ceil(textWidth(text) * GUCHI_FONT_SIZE + 26)), h: 36 };
    case 'phone':
      return { w: Math.round(Math.min(fieldWidth * 0.86, 340, cap)), h: PHONE_HEIGHT };
    case 'bubble': {
      const w = Math.round(Math.min(fieldWidth * 0.6, 240, cap));
      const perLine = Math.max(4, Math.floor((w - BUBBLE_PADDING_X * 2) / BUBBLE_FONT_SIZE));
      // 折り返しの位置ずれ（と結論の蛍光ペンの太さ）に備えて 1 割 5 分ほど余裕を見る
      const lines = Math.max(1, Math.ceil((textWidth(text) * 1.15) / perLine));
      return { w, h: lines * BUBBLE_LINE_HEIGHT + BUBBLE_PADDING_Y * 2 };
    }
  }
}

function pick<T>(list: readonly T[], rng: number): { value: T; rng: number } {
  const r = nextRandom(rng);
  return { value: list[Math.floor(r.value * list.length) % list.length], rng: r.state };
}

const blocks = (kind: ItemKind) => kind !== 'word';
const isJunk = (kind: ItemKind) => kind === 'bubble' || kind === 'guchi';

/**
 * 降ってくる途中のゴミの並びに、カゴが通れる隙間（カゴの幅＋左右の余裕）が残っているか。
 * top〜bottom の高さにかかっているゴミ（カゴの高さぶん上下に広げて見る）の横の範囲を調べる。
 */
export function hasDodgeGap(
  items: readonly Pick<FallingItem, 'kind' | 'x' | 'y' | 'w' | 'h'>[],
  config: LineConfig,
  top: number,
  bottom: number,
): boolean {
  const band = config.basketHeight;
  const spans = items
    .filter((it) => blocks(it.kind) && it.y - it.h / 2 < bottom + band && it.y + it.h / 2 > top - band)
    .map((it) => [it.x - it.w / 2, it.x + it.w / 2] as const)
    .sort((a, b) => a[0] - b[0]);
  const need = config.basketWidth + DODGE_MARGIN * 2;
  let edge = 0;
  for (const [l, r] of spans) {
    if (l - edge >= need) return true;
    edge = Math.max(edge, r);
  }
  return config.width - edge >= need;
}

/** 置き場所を探す回数。見つからなければ、そのときは降らせない */
const PLACE_TRIES = 8;

type SpawnKind = { kind: 'bubble'; bubble: BubbleType } | { kind: 'guchi' } | { kind: 'phone' };

/** 次に降らせるものを選ぶ（本物 40%・ひっかけ 20%・結論なし 25%・愚痴 15%。最初はひっかけなし） */
function chooseSpawn(time: number, rng: number): { spawn: SpawnKind; rng: number } {
  const r = nextRandom(rng);
  const fake = time < NO_FAKE_UNTIL ? 0 : 0.2;
  const real = 0.4;
  const none = 0.25 + (0.2 - fake) / 2;
  let v = r.value;
  if (v < real) return { spawn: { kind: 'bubble', bubble: 'real' }, rng: r.state };
  v -= real;
  if (v < fake) return { spawn: { kind: 'bubble', bubble: 'fake' }, rng: r.state };
  v -= fake;
  if (v < none) return { spawn: { kind: 'bubble', bubble: 'none' }, rng: r.state };
  return { spawn: { kind: 'guchi' }, rng: r.state };
}

function textsFor(spawn: SpawnKind): readonly string[] {
  if (spawn.kind === 'guchi') return GUCHI_WORDS;
  if (spawn.kind === 'phone') return [RAGE_BLOCK_TEXT];
  return spawn.bubble === 'real' ? REAL_TEXTS : spawn.bubble === 'fake' ? FAKE_TEXTS : OJISAN_TEXTS;
}

function spawn(state: LineState, config: LineConfig, forced: SpawnKind | null): LineState | null {
  let rng = state.rng;
  let what: SpawnKind;
  if (forced) {
    what = forced;
  } else {
    const c = chooseSpawn(state.time, rng);
    what = c.spawn;
    rng = c.rng;
  }
  const t = pick(textsFor(what), rng);
  rng = t.rng;
  const { w, h } = measureItem(what.kind, t.value, config.width, config.basketWidth);
  // ゴミの速さは step で毎フレームそろえる（ここで入れるのは最初の値）
  const vy = fallSpeed(state.time, config.height);
  for (let i = 0; i < PLACE_TRIES; i++) {
    const rx = nextRandom(rng);
    rng = rx.state;
    // 幅の広いもの（特大ブロックや、ほかのゴミと並ぶとき）は、左右どちらかの端に寄せると隙間ができる
    const edge = what.kind === 'phone' || i >= PLACE_TRIES - 2;
    const x = edge
      ? rx.value < 0.5
        ? w / 2
        : config.width - w / 2
      : w / 2 + rx.value * Math.max(0, config.width - w);
    const item: FallingItem = {
      id: state.nextId,
      kind: what.kind,
      text: t.value,
      x,
      y: -h / 2,
      w,
      h,
      vy,
      bubble: what.kind === 'bubble' ? what.bubble : undefined,
      born: state.time,
    };
    if (hasDodgeGap([...state.items, item], config, -h, 0)) {
      return { ...state, rng, nextId: state.nextId + 1, items: [...state.items, item] };
    }
  }
  return null;
}

function overlaps(item: FallingItem, config: LineConfig, basketX: number): boolean {
  // ゴミは見た目より少し小さく判定する（かすっただけで当たると理不尽なので）
  const inset = item.kind === 'word' ? 0 : Math.min(10, item.w * 0.08);
  const left = item.x - item.w / 2 + inset;
  const right = item.x + item.w / 2 - inset;
  const top = item.y - item.h / 2;
  const bottom = item.y + item.h / 2 - (item.kind === 'word' ? 0 : 4);
  const bLeft = basketX - config.basketWidth / 2;
  const bRight = basketX + config.basketWidth / 2;
  const bTop = config.basketTop;
  const bBottom = config.basketTop + config.basketHeight;
  return right > bLeft && left < bRight && bottom > bTop && top < bBottom;
}

/** イライラ度を上げる。100% になったらブチギレ（ブチギレ中は動かない） */
function addMood(s: LineState, amount: number, events: LineEvent[]): void {
  if (s.rage > 0 || s.status !== 'playing') return;
  s.mood = Math.min(MOOD_MAX, Math.max(0, s.mood + amount));
  if (s.mood >= MOOD_MAX) {
    s.rage = RAGE_SECONDS;
    s.rageCount += 1;
    s.phoneTimer = RAGE_FIRST_PHONE;
    events.push({ type: 'rage-start' });
  }
}

function loseLife(s: LineState, events: LineEvent[], id: number): void {
  s.lives = Math.max(0, s.lives - 1);
  s.combo = 0;
  s.lastHitAt = s.time;
  events.push({ type: 'hit', id, lives: s.lives });
  if (s.lives === 0) {
    s.status = 'over';
    s.overReason = 'lives';
  }
}

/**
 * 画面の (x, y) をタップした。いちばん手前の吹き出しを要約する。
 * 吹き出し以外（愚痴・電話ブロック・何もないところ）をタップしても何も起きない。
 */
export function tapAt(prev: LineState, config: LineConfig, x: number, y: number): LineState {
  if (prev.status !== 'playing') return prev;
  let target: FallingItem | null = null;
  for (let i = prev.items.length - 1; i >= 0; i--) {
    const it = prev.items[i];
    if (it.kind !== 'bubble') continue;
    if (Math.abs(x - it.x) <= it.w / 2 + TAP_SLOP && Math.abs(y - it.y) <= it.h / 2 + TAP_SLOP) {
      target = it;
      break;
    }
  }
  if (!target) return prev;
  const s: LineState = { ...prev, events: [] };
  const events: LineEvent[] = [];
  const type = target.bubble ?? 'none';
  s.items = prev.items.filter((it) => it.id !== target.id);
  s.bursts = [...prev.bursts, { id: target.id, x: target.x, y: target.y, type, age: 0 }];
  events.push({ type: 'summarize', id: target.id, result: type });
  if (type === 'real') {
    // 結論の単語が吹き出しから飛び出して、カゴに向かって落ちてくる
    const word = conclusionOf(target.text) ?? CONCLUSION_WORDS[0];
    const { w, h } = measureItem('word', word, config.width, config.basketWidth);
    const x0 = Math.min(config.width - w / 2, Math.max(w / 2, target.x));
    s.items.push({
      id: s.nextId,
      kind: 'word',
      text: word,
      x: x0,
      y: target.y,
      w,
      h,
      vy: fallSpeed(s.time, config.height) * WORD_FALL,
      born: s.time,
    });
    s.nextId += 1;
  } else if (type === 'fake') {
    s.fakesTaken += 1;
    s.floaters = [...s.floaters, { id: target.id, x: target.x, y: target.y, text: 'ひっかけ！', tone: 'bad', age: 0 }];
    addMood(s, MOOD_FAKE, events);
    loseLife(s, events, target.id);
  } else {
    s.combo = 0;
    s.floaters = [...s.floaters, { id: target.id, x: target.x, y: target.y, text: '結論なし', tone: 'bad', age: 0 }];
    addMood(s, MOOD_NONE, events);
  }
  if (s.status === 'over') events.push({ type: 'gameover', reason: s.overReason ?? 'lives' });
  s.events = events;
  return s;
}

/** 1 フレームぶん進める */
export function step(prev: LineState, config: LineConfig, dt: number): LineState {
  if (prev.status !== 'playing') return prev.events.length ? { ...prev, events: [] } : prev;
  const s: LineState = { ...prev, time: prev.time + dt, events: [] };
  const events: LineEvent[] = [];

  // ブチギレの残り時間。耐え抜いたらゲージを 0 に戻して通常モードへ
  let items = prev.items;
  if (s.rage > 0) {
    s.rage = Math.max(0, s.rage - dt);
    if (s.rage === 0) {
      s.mood = 0;
      items = items.filter((it) => it.kind !== 'phone');
      events.push({ type: 'rage-end' });
    }
  }

  const kept: FallingItem[] = [];
  const floaters = prev.floaters
    .map((f) => ({ ...f, age: f.age + dt }))
    .filter((f) => f.age < FLOATER_SECONDS);
  s.bursts = prev.bursts.map((b) => ({ ...b, age: b.age + dt })).filter((b) => b.age < BURST_SECONDS);
  let rng = s.rng;
  let lastPraise = s.lastPraise;
  // ゴミはその瞬間の速さで全部そろって落ちる（並び方が変わらないので、降らせたときの隙間がずっと残る）
  const junkSpeed = fallSpeed(s.time, config.height);

  for (const it of items) {
    const vy = it.kind === 'word' ? it.vy : junkSpeed;
    const mul = it.kind === 'phone' || (s.rage > 0 && isJunk(it.kind)) ? RAGE_SPEED_MULTIPLIER : 1;
    let x = it.x;
    if (it.kind === 'word') {
      // カゴのほうへ吸い寄せられる
      const dx = s.basketX - it.x;
      x = it.x + Math.sign(dx) * Math.min(Math.abs(dx), WORD_HOMING * dt);
    }
    const moved: FallingItem = { ...it, x, vy, y: it.y + vy * mul * dt };
    if (s.status === 'playing' && overlaps(moved, config, s.basketX)) {
      if (moved.kind === 'word') {
        s.combo += 1;
        s.maxCombo = Math.max(s.maxCombo, s.combo);
        s.caught += 1;
        const points = (BASE_POINTS + COMBO_BONUS * (s.combo - 1)) * (s.rage > 0 ? RAGE_SCORE_MULTIPLIER : 1);
        s.score += points;
        if (s.rage === 0) s.mood = Math.max(0, s.mood - MOOD_PER_CATCH);
        s.lastCatchAt = s.time;
        let praise: string | null = null;
        if (s.combo >= PRAISE_MIN_COMBO) {
          const p = pick(PRAISES, rng);
          rng = p.rng;
          praise = p.value;
          lastPraise = { id: moved.id, text: praise, combo: s.combo };
        }
        floaters.push({ id: moved.id, x: moved.x, y: config.basketTop - 10, text: `+${points}`, tone: 'good', age: 0 });
        events.push({ type: 'catch', id: moved.id, combo: s.combo, points, praise });
      } else if (moved.kind === 'phone') {
        s.lives = 0;
        s.lastHitAt = s.time;
        s.status = 'over';
        s.overReason = 'phone';
      } else {
        // 吹き出しや愚痴がカゴに当たった＝全文まともに読まされた
        loseLife(s, events, moved.id);
      }
      continue;
    }
    if (moved.y - moved.h / 2 > config.height) {
      // 画面の下に消えた
      if (moved.kind === 'word') {
        s.combo = 0;
        addMood(s, MOOD_WORD_DROP, events);
      } else if (moved.kind === 'bubble' && moved.bubble === 'real') {
        // 結論があったのに読まずに流した
        s.combo = 0;
        floaters.push({ id: moved.id, x: moved.x, y: config.height - 30, text: '見逃し！', tone: 'bad', age: 0 });
        events.push({ type: 'overlook', id: moved.id });
        addMood(s, MOOD_OVERLOOK, events);
      } else if (moved.kind === 'bubble' && moved.bubble === 'fake') {
        // ひっかけを見抜いて見送った
        s.fakesDodged += 1;
        s.score += FAKE_DODGE_POINTS;
        floaters.push({ id: moved.id, x: moved.x, y: config.height - 30, text: `見抜いた +${FAKE_DODGE_POINTS}`, tone: 'good', age: 0 });
        events.push({ type: 'fake-dodged', id: moved.id });
      }
      continue;
    }
    kept.push(moved);
  }
  s.items = kept;
  s.floaters = floaters;
  s.rng = rng;
  s.lastPraise = lastPraise;

  if (s.status === 'over') {
    events.push({ type: 'gameover', reason: s.overReason ?? 'lives' });
    s.events = events;
    return s;
  }

  // 18:00 になったら定時退社
  if (s.time >= DAY_SECONDS) {
    s.time = DAY_SECONDS;
    s.status = 'clear';
    s.clearBonus = CLEAR_BONUS + CLEAR_BONUS_PER_LIFE * s.lives;
    s.score += s.clearBonus;
    events.push({ type: 'clear' });
    s.events = events;
    return s;
  }

  // 次の吹き出しを降らせる
  let next: LineState = s;
  next.spawnTimer -= dt;
  if (next.spawnTimer <= 0) {
    // よけられる隙間がない並びになるときは、少し待ってから降らせる
    next = spawn(next, config, null) ?? { ...next, rng: nextRandom(next.rng).state };
    next.spawnTimer = spawnInterval(next.time);
  }
  if (next.rage > 0) {
    next.phoneTimer -= dt;
    if (next.phoneTimer <= 0) {
      const spawned = spawn(next, config, { kind: 'phone' });
      next = spawned ?? next;
      next.phoneTimer = spawned ? RAGE_PHONE_INTERVAL : 0.15;
    }
  }
  next.events = events;
  return next;
}

/** スコアに応じた称号（結果画面に出す） */
export function lineTitleFor(score: number): string {
  if (score >= 9000) return '伝説の要約神';
  if (score >= 6000) return '社長室直通の要約マン';
  if (score >= 4000) return '定時退社の申し子';
  if (score >= 2500) return '既読の達人';
  if (score >= 1000) return '行間読み見習い';
  return '長文に溺れし者';
}
