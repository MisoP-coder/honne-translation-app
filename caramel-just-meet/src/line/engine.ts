/**
 * 「要約の達人」のゲームの中身（画面に依存しない純粋な関数だけ）。
 * 画面は step() を毎フレーム呼び、返ってきた状態を描くだけにする。
 * 乱数の内部状態も状態に持たせているので、同じシードなら同じ展開になる（テストしやすい）。
 */
import { nextRandom } from '../game/rng';
import {
  CONCLUSION_WORDS,
  GUCHI_WORDS,
  OJISAN_TEXTS,
  PRAISE_MIN_COMBO,
  PRAISES,
  RAGE_BLOCK_TEXT,
} from './texts';

/** word：結論単語（キャッチ）／ojisan・guchi：ゴミテキスト（よける）／phone：ブチギレ中の即死ブロック */
export type ItemKind = 'word' | 'ojisan' | 'guchi' | 'phone';

export interface FallingItem {
  id: number;
  kind: ItemKind;
  text: string;
  /** 中心の座標 */
  x: number;
  y: number;
  w: number;
  h: number;
  /** 落ちる速さ（px/秒）。ブチギレ中は、おじさん構文だけこの 2 倍で落ちる */
  vy: number;
}

/** キャッチした場所に浮かぶ「+120」 */
export interface Floater {
  id: number;
  x: number;
  y: number;
  text: string;
  age: number;
}

export type LineEvent =
  | { type: 'catch'; id: number; combo: number; points: number; praise: string | null }
  | { type: 'hit'; id: number; lives: number }
  | { type: 'rage-start' }
  | { type: 'rage-end' }
  | { type: 'gameover'; reason: GameOverReason };

export type GameOverReason = 'lives' | 'phone';

export interface LineConfig {
  width: number;
  height: number;
  basketWidth: number;
  basketHeight: number;
  /** 要約カゴの上端の y */
  basketTop: number;
}

export interface LineState {
  status: 'playing' | 'over';
  time: number;
  score: number;
  combo: number;
  maxCombo: number;
  caught: number;
  lives: number;
  /** 上司のイライラ度（0〜100） */
  mood: number;
  /** ブチギレの残り秒数。0 なら通常モード */
  rage: number;
  rageCount: number;
  basketX: number;
  items: FallingItem[];
  floaters: Floater[];
  nextId: number;
  spawnTimer: number;
  phoneTimer: number;
  rng: number;
  /** 直前の step で起きたこと（音や演出のきっかけに使う） */
  events: LineEvent[];
  lastCatchAt: number;
  lastHitAt: number;
  /** 直近のほめ言葉（コンボ演出用。id が変わったら新しく出す） */
  lastPraise: { id: number; text: string; combo: number } | null;
  overReason: GameOverReason | null;
}

export const MAX_LIVES = 3;
/** ゴミテキストをスルーしたときに上がるイライラ度 */
export const MOOD_PER_PASS = 5;
/** 結論単語をキャッチしたときに下がるイライラ度 */
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
/** 降ってくるものが結論単語である確率 */
export const WORD_RATE = 0.38;
/** 1 回キャッチしたときの点（＋コンボごとに上乗せ） */
export const BASE_POINTS = 100;
export const COMBO_BONUS = 10;
const FLOATER_SECONDS = 0.9;

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
    lives: MAX_LIVES,
    mood: 0,
    rage: 0,
    rageCount: 0,
    basketX: config ? config.width / 2 : 0,
    items: [],
    floaters: [],
    nextId: 1,
    spawnTimer: 0.6,
    phoneTimer: 0,
    rng: seed >>> 0,
    events: [],
    lastCatchAt: -1,
    lastHitAt: -1,
    lastPraise: null,
    overReason: null,
  };
}

/** 要約カゴを x（中心）に動かす。画面からはみ出さないようにする */
export function moveBasket(state: LineState, config: LineConfig, x: number): LineState {
  const half = config.basketWidth / 2;
  const clamped = Math.min(config.width - half, Math.max(half, x));
  if (clamped === state.basketX) return state;
  return { ...state, basketX: clamped };
}

/** 経過時間に応じた落ちる速さ（画面の高さに比例。だんだん速くなる） */
export function fallSpeed(time: number, height: number): number {
  return height * (0.17 + Math.min(time, 90) * 0.0024);
}

/** 次のテキストが降ってくるまでの秒数（だんだん短くなる） */
export function spawnInterval(time: number): number {
  return Math.max(0.5, 1.1 - time * 0.006);
}

/**
 * 文字列の見た目の幅（全角 1 文字 = 1）。
 * 絵文字は少し広めに、半角英数字は狭めに数える。
 * 絵文字をつなぐ記号（異体字セレクタ・ZWJ・肌色）は幅を持たない。
 */
export function textWidth(text: string): number {
  let w = 0;
  for (const ch of Array.from(text)) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0xfe0f || code === 0x200d || (code >= 0x1f3fb && code <= 0x1f3ff) || code === 0x2640 || code === 0x2642) {
      continue;
    }
    if (code < 0x80) w += 0.6;
    else if (code >= 0x1f000) w += 1.25;
    else w += 1;
  }
  return w;
}

/** おじさん構文の吹き出しの文字の大きさ（画面の描画と当たり判定で共通） */
export const OJISAN_FONT_SIZE = 12;
export const OJISAN_LINE_HEIGHT = 17;
export const OJISAN_PADDING_X = 10;
export const OJISAN_PADDING_Y = 8;
export const WORD_FONT_SIZE = 18;
export const GUCHI_FONT_SIZE = 15;
export const PHONE_HEIGHT = 78;

/** テキストの種類ごとの大きさ（吹き出しの幅と高さ） */
export function measureItem(kind: ItemKind, text: string, fieldWidth: number): { w: number; h: number } {
  switch (kind) {
    case 'word':
      return { w: Math.ceil(textWidth(text) * WORD_FONT_SIZE + 30), h: 42 };
    case 'guchi':
      return { w: Math.ceil(textWidth(text) * GUCHI_FONT_SIZE + 26), h: 36 };
    case 'phone':
      return { w: Math.round(Math.min(fieldWidth * 0.86, 340)), h: PHONE_HEIGHT };
    case 'ojisan': {
      const w = Math.round(Math.min(fieldWidth * 0.64, 250));
      const perLine = Math.max(4, Math.floor((w - OJISAN_PADDING_X * 2) / OJISAN_FONT_SIZE));
      // 折り返しの位置ずれに備えて 1 割ほど余裕を見る
      const lines = Math.max(1, Math.ceil((textWidth(text) * 1.1) / perLine));
      return { w, h: lines * OJISAN_LINE_HEIGHT + OJISAN_PADDING_Y * 2 };
    }
  }
}

function pick<T>(list: readonly T[], rng: number): { value: T; rng: number } {
  const r = nextRandom(rng);
  return { value: list[Math.floor(r.value * list.length) % list.length], rng: r.state };
}

function spawn(state: LineState, config: LineConfig, kind: ItemKind | null): LineState {
  let rng = state.rng;
  let chosen: ItemKind;
  if (kind) {
    chosen = kind;
  } else {
    const r = nextRandom(rng);
    rng = r.state;
    if (r.value < WORD_RATE) chosen = 'word';
    else if (r.value < WORD_RATE + (1 - WORD_RATE) * 0.68) chosen = 'ojisan';
    else chosen = 'guchi';
  }
  const list: readonly string[] =
    chosen === 'word' ? CONCLUSION_WORDS : chosen === 'ojisan' ? OJISAN_TEXTS : chosen === 'guchi' ? GUCHI_WORDS : [RAGE_BLOCK_TEXT];
  const t = pick(list, rng);
  rng = t.rng;
  const { w, h } = measureItem(chosen, t.value, config.width);
  const rx = nextRandom(rng);
  rng = rx.state;
  const x = w / 2 + rx.value * Math.max(0, config.width - w);
  const rv = nextRandom(rng);
  rng = rv.state;
  const base = fallSpeed(state.time, config.height);
  const vy =
    chosen === 'word' ? base * 0.9 : chosen === 'phone' ? base * 1.25 : base * (0.85 + rv.value * 0.3);
  const item: FallingItem = { id: state.nextId, kind: chosen, text: t.value, x, y: -h / 2, w, h, vy };
  return { ...state, rng, nextId: state.nextId + 1, items: [...state.items, item] };
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

const isJunk = (kind: ItemKind) => kind === 'ojisan' || kind === 'guchi';

/** 1 フレームぶん進める */
export function step(prev: LineState, config: LineConfig, dt: number): LineState {
  if (prev.status === 'over') return prev.events.length ? { ...prev, events: [] } : prev;
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
  let rng = s.rng;
  let lastPraise = s.lastPraise;

  for (const it of items) {
    const mul = s.rage > 0 && isJunk(it.kind) ? RAGE_SPEED_MULTIPLIER : 1;
    const moved: FallingItem = { ...it, y: it.y + it.vy * mul * dt };
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
        floaters.push({ id: moved.id, x: moved.x, y: config.basketTop - 10, text: `+${points}`, age: 0 });
        events.push({ type: 'catch', id: moved.id, combo: s.combo, points, praise });
      } else if (moved.kind === 'phone') {
        s.lives = 0;
        s.lastHitAt = s.time;
        s.status = 'over';
        s.overReason = 'phone';
      } else {
        s.lives = Math.max(0, s.lives - 1);
        s.combo = 0;
        s.lastHitAt = s.time;
        events.push({ type: 'hit', id: moved.id, lives: s.lives });
        if (s.lives === 0) {
          s.status = 'over';
          s.overReason = 'lives';
        }
      }
      continue;
    }
    if (moved.y - moved.h / 2 > config.height) {
      // 画面の下に消えた
      if (moved.kind === 'word') {
        s.combo = 0;
      } else if (isJunk(moved.kind) && s.rage === 0 && s.status === 'playing') {
        // 既読スルーされて上司がイライラする
        s.mood = Math.min(MOOD_MAX, s.mood + MOOD_PER_PASS);
        if (s.mood >= MOOD_MAX) {
          s.rage = RAGE_SECONDS;
          s.rageCount += 1;
          s.phoneTimer = RAGE_FIRST_PHONE;
          events.push({ type: 'rage-start' });
        }
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

  // 次のテキストを降らせる
  let next: LineState = s;
  next.spawnTimer -= dt;
  if (next.spawnTimer <= 0) {
    next = spawn(next, config, null);
    next.spawnTimer = spawnInterval(next.time);
  }
  if (next.rage > 0) {
    next.phoneTimer -= dt;
    if (next.phoneTimer <= 0) {
      next = spawn(next, config, 'phone');
      next.phoneTimer = RAGE_PHONE_INTERVAL;
    }
  }
  next.events = events;
  return next;
}

/** スコアに応じた称号（ゲームオーバー画面に出す） */
export function lineTitleFor(score: number): string {
  if (score >= 12000) return '伝説の要約神';
  if (score >= 7000) return '社長室直通の要約マン';
  if (score >= 4000) return '定時退社の申し子';
  if (score >= 2000) return '既読の達人';
  if (score >= 800) return '行間読み見習い';
  return '長文に溺れし者';
}
