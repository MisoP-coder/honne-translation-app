import { randomRange } from './rng';

/**
 * 極限！カラメル・ジャスト・ミート のゲームエンジン。
 *
 * 描画（React Native）から完全に切り離した純粋関数の集まり。
 * - createGame: 新しいゲームを作る
 * - step:       経過時間 dt 秒ぶん世界を進める（揺れ・落下・判定）
 * - tapDrop:    タップでカラメルを1滴落とす
 * 座標はすべて画面ピクセル（左上原点、y は下向き）。
 */

export type Judge = 'perfect' | 'good' | 'miss';
export type GameStatus = 'playing' | 'sliding' | 'over';

export interface GameConfig {
  width: number;
  height: number;
  /** カラメルを落とす位置（画面中央の真上） */
  dropperX: number;
  dropStartY: number;
  dropRadius: number;
  /** プリン頂点（カラメルが着地する面）の y */
  puddingTopY: number;
  puddingTopHalfWidth: number;
  puddingBottomHalfWidth: number;
  puddingHeight: number;
  /** この距離以内なら JUST MEET!（パーフェクト） */
  perfectRange: number;
  /** この距離以内ならセーフ（グッド）。超えると滑り落ちる */
  goodRange: number;
  /** 落下の重力加速度 (px/s^2) */
  gravity: number;
  /** 揺れの最大振れ幅 (px) */
  amplitude: number;
  /** 滑り落ちる演出の長さ（秒） */
  slideDuration: number;
}

export interface Wobble {
  freqs: [number, number, number];
  phases: [number, number, number];
  weights: [number, number, number];
  /** 振れ幅をゆっくり変化させる（不規則さを出す）ための周波数と位相 */
  ampFreq: number;
  ampPhase: number;
}

export interface Drop {
  x: number;
  y: number;
  vy: number;
}

export interface JudgeEvent {
  /** 演出のトリガー用に毎回増える ID */
  id: number;
  judge: Judge;
  /** プリン頂点の中心からのズレ (px)。正なら右にズレた */
  offset: number;
  points: number;
  combo: number;
}

export interface Slide {
  /** 着地時のプリン中心からの相対位置 */
  relX: number;
  /** 着地時の画面上の x（プリンにかすりもしなかった場合はここから真下に落ちる） */
  worldX: number;
  dir: -1 | 1;
  /** 0〜1 の進行度 */
  progress: number;
}

export interface GameState {
  status: GameStatus;
  time: number;
  /** 揺れの位相。速度倍率を掛けて積算するので速度が変わっても揺れが飛ばない */
  phase: number;
  wobble: Wobble;
  /** プリン中心の画面中央からのズレ (px) */
  puddingOffset: number;
  /** プリンの横方向の速度 (px/s)。ぷるぷる変形の演出に使う */
  puddingVelocity: number;
  drop: Drop | null;
  /** 現在の連続成功数（ミスで終了するので最終的な「〇〇連続」と同じ） */
  combo: number;
  score: number;
  perfectCount: number;
  lastJudge: JudgeEvent | null;
  slide: Slide | null;
  rngState: number;
}

export const POINTS = { perfect: 300, good: 100 } as const;
export const COMBO_BONUS = 10;
export const MAX_SPEED = 2.6;
const FALL_TIME = 0.6;
const DROP_INITIAL_VY = 0;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function createConfig(width: number, height: number): GameConfig {
  const puddingTopHalfWidth = clamp(width * 0.13, 36, 70);
  const puddingBottomHalfWidth = puddingTopHalfWidth * 1.45;
  const puddingHeight = puddingTopHalfWidth * 1.5;
  const plateY = height * 0.78;
  const puddingTopY = plateY - puddingHeight;
  const dropStartY = height * 0.16;
  const distance = puddingTopY - dropStartY;
  return {
    width,
    height,
    dropperX: width / 2,
    dropStartY,
    dropRadius: puddingTopHalfWidth * 0.22,
    puddingTopY,
    puddingTopHalfWidth,
    puddingBottomHalfWidth,
    puddingHeight,
    perfectRange: puddingTopHalfWidth * 0.22,
    goodRange: puddingTopHalfWidth * 0.75,
    gravity: (2 * distance) / (FALL_TIME * FALL_TIME),
    amplitude: Math.max(0, Math.min(width * 0.28, width / 2 - puddingBottomHalfWidth - 12)),
    slideDuration: 0.9,
  };
}

export function createGame(seed: number): GameState {
  let s = seed >>> 0;
  const pick = (min: number, max: number) => {
    const r = randomRange(s, min, max);
    s = r.state;
    return r.value;
  };
  // 互いに割り切れない周波数を重ねて「不規則なぷるぷる」を作る
  const wobble: Wobble = {
    freqs: [pick(1.5, 2.1), pick(2.8, 3.6), pick(5.2, 6.2)],
    phases: [pick(0, Math.PI * 2), pick(0, Math.PI * 2), pick(0, Math.PI * 2)],
    weights: [1, pick(0.45, 0.7), pick(0.15, 0.3)],
    ampFreq: pick(0.3, 0.5),
    ampPhase: pick(0, Math.PI * 2),
  };
  return {
    status: 'playing',
    time: 0,
    phase: 0,
    wobble,
    puddingOffset: 0,
    puddingVelocity: 0,
    drop: null,
    combo: 0,
    score: 0,
    perfectCount: 0,
    lastJudge: null,
    slide: null,
    rngState: s,
  };
}

/** 位相から揺れの量（-1〜1 程度）を求める */
export function wobbleAt(wobble: Wobble, phase: number): number {
  let sum = 0;
  let total = 0;
  for (let i = 0; i < 3; i++) {
    sum += wobble.weights[i] * Math.sin(wobble.freqs[i] * phase + wobble.phases[i]);
    total += wobble.weights[i];
  }
  const ampMod = 0.75 + 0.25 * Math.sin(wobble.ampFreq * phase + wobble.ampPhase);
  return (sum / total) * ampMod;
}

/** 連続成功数に応じて揺れが速くなる */
export function speedFor(combo: number): number {
  return Math.min(1 + combo * 0.05, MAX_SPEED);
}

export function judgeOffset(offset: number, config: GameConfig): Judge {
  const d = Math.abs(offset);
  if (d <= config.perfectRange) return 'perfect';
  if (d <= config.goodRange) return 'good';
  return 'miss';
}

export function pointsFor(judge: Judge, comboBefore: number): number {
  if (judge === 'miss') return 0;
  return POINTS[judge] + comboBefore * COMBO_BONUS;
}

export function puddingCenterX(state: GameState, config: GameConfig): number {
  return config.width / 2 + state.puddingOffset;
}

/** タップ：落下中でなければカラメルを1滴落とす */
export function tapDrop(state: GameState, config: GameConfig): GameState {
  if (state.status !== 'playing' || state.drop) return state;
  return {
    ...state,
    drop: { x: config.dropperX, y: config.dropStartY, vy: DROP_INITIAL_VY },
  };
}

function land(state: GameState, config: GameConfig, drop: Drop, offsetAtLanding: number): GameState {
  const relX = drop.x - (config.width / 2 + offsetAtLanding);
  const judge = judgeOffset(relX, config);
  const nextId = (state.lastJudge?.id ?? 0) + 1;
  if (judge === 'miss') {
    return {
      ...state,
      drop: null,
      status: 'sliding',
      slide: { relX, worldX: drop.x, dir: relX >= 0 ? 1 : -1, progress: 0 },
      lastJudge: { id: nextId, judge, offset: relX, points: 0, combo: state.combo },
    };
  }
  const points = pointsFor(judge, state.combo);
  const combo = state.combo + 1;
  return {
    ...state,
    drop: null,
    combo,
    score: state.score + points,
    perfectCount: state.perfectCount + (judge === 'perfect' ? 1 : 0),
    lastJudge: { id: nextId, judge, offset: relX, points, combo },
  };
}

/** dt 秒ぶんゲームを進める */
export function step(state: GameState, config: GameConfig, dt: number): GameState {
  if (state.status === 'over' || dt <= 0) return state;

  if (state.status === 'sliding') {
    const progress = Math.min(1, (state.slide?.progress ?? 0) + dt / config.slideDuration);
    const slide = state.slide ? { ...state.slide, progress } : null;
    // 滑り落ちている間もプリンは揺れ続ける（ちょっと煽る）
    const moved = advanceWobble(state, config, dt);
    return {
      ...moved,
      slide,
      status: progress >= 1 ? 'over' : 'sliding',
    };
  }

  const speed = speedFor(state.combo);

  if (state.drop) {
    const drop = state.drop;
    // 等加速度運動の式をそのまま使い、フレームレートで落下時間が変わらないようにする
    const vy = drop.vy + config.gravity * dt;
    const nextY = drop.y + drop.vy * dt + 0.5 * config.gravity * dt * dt;
    if (nextY >= config.puddingTopY) {
      // 着地した瞬間の位相でプリンの位置を求めて判定する（フレームレートに依存しない）
      const dist = config.puddingTopY - drop.y;
      const frac = clamp(fallFraction(drop.vy, config.gravity, dist, dt), 0, 1);
      const landingPhase = state.phase + dt * frac * speed;
      const landingOffset = wobbleAt(state.wobble, landingPhase) * config.amplitude;
      const moved = advanceWobble(state, config, dt);
      return land(moved, config, { ...drop, y: config.puddingTopY }, landingOffset);
    }
    const moved = advanceWobble(state, config, dt);
    return { ...moved, drop: { ...drop, y: nextY, vy } };
  }

  return advanceWobble(state, config, dt);
}

/** 落下距離 dist に到達するまでの時間が dt の何割か */
function fallFraction(v0: number, g: number, dist: number, dt: number): number {
  if (dist <= 0) return 0;
  // dist = v0 t + 1/2 g t^2 を t について解く
  const t = g > 0 ? (-v0 + Math.sqrt(v0 * v0 + 2 * g * dist)) / g : dist / Math.max(v0, 1e-6);
  return t / dt;
}

function advanceWobble(state: GameState, config: GameConfig, dt: number): GameState {
  const phase = state.phase + dt * speedFor(state.combo);
  const puddingOffset = wobbleAt(state.wobble, phase) * config.amplitude;
  return {
    ...state,
    time: state.time + dt,
    phase,
    puddingOffset,
    puddingVelocity: (puddingOffset - state.puddingOffset) / dt,
  };
}
