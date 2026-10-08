import {
  COMBO_BONUS,
  createConfig,
  createGame,
  type GameConfig,
  type GameState,
  judgeOffset,
  MAX_SPEED,
  POINTS,
  speedFor,
  step,
  tapDrop,
  wobbleAt,
} from '../src/game/engine';

const WIDTH = 390;
const HEIGHT = 700;
const DT = 1 / 60;

/** 揺れを止めたテスト用の設定。プリンは常に画面中央 */
function stillConfig(dropperShift = 0): GameConfig {
  const base = createConfig(WIDTH, HEIGHT);
  return { ...base, amplitude: 0, dropperX: base.dropperX + dropperShift };
}

/** カラメルが着地して判定が出るまで進める */
function runUntilJudged(state: GameState, config: GameConfig, dt = DT): GameState {
  const startId = state.lastJudge?.id ?? 0;
  let s = state;
  for (let i = 0; i < 10_000 && (s.lastJudge?.id ?? 0) === startId; i++) s = step(s, config, dt);
  return s;
}

function dropAndJudge(state: GameState, config: GameConfig): GameState {
  return runUntilJudged(tapDrop(state, config), config);
}

describe('createConfig', () => {
  it('プリンが揺れても画面からはみ出さない', () => {
    for (const w of [320, 390, 430, 768]) {
      const c = createConfig(w, 800);
      expect(c.width / 2 - c.amplitude - c.puddingBottomHalfWidth).toBeGreaterThan(0);
      expect(c.perfectRange).toBeLessThan(c.goodRange);
      // セーフの範囲は見えているプリンの頂上と同じ（見た目より狭くしない）
      expect(c.goodRange).toBe(c.puddingTopHalfWidth);
      expect(c.dropStartY).toBeLessThan(c.puddingTopY);
    }
  });
});

describe('揺れ', () => {
  it('同じシードなら同じ揺れ方になる', () => {
    const config = createConfig(WIDTH, HEIGHT);
    let a = createGame(42);
    let b = createGame(42);
    for (let i = 0; i < 120; i++) {
      a = step(a, config, DT);
      b = step(b, config, DT);
    }
    expect(a.puddingOffset).toBe(b.puddingOffset);
    expect(createGame(1).wobble).not.toEqual(createGame(2).wobble);
  });

  it('振れ幅の範囲内で左右両方に揺れる', () => {
    const config = createConfig(WIDTH, HEIGHT);
    let s = createGame(7);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 60 * 20; i++) {
      s = step(s, config, DT);
      min = Math.min(min, s.puddingOffset);
      max = Math.max(max, s.puddingOffset);
      expect(Math.abs(wobbleAt(s.wobble, s.phase))).toBeLessThanOrEqual(1);
    }
    expect(max).toBeLessThanOrEqual(config.amplitude);
    expect(min).toBeGreaterThanOrEqual(-config.amplitude);
    expect(max).toBeGreaterThan(config.amplitude * 0.3);
    expect(min).toBeLessThan(-config.amplitude * 0.3);
  });

  it('連続数が増えるほど速くなり、上限で止まる', () => {
    expect(speedFor(0)).toBe(1);
    expect(speedFor(10)).toBeGreaterThan(speedFor(5));
    expect(speedFor(1000)).toBe(MAX_SPEED);
  });
});

describe('タップと落下', () => {
  it('タップでカラメルが真上から落ち始め、落下中の連打は無視される', () => {
    const config = createConfig(WIDTH, HEIGHT);
    const s0 = createGame(1);
    const s1 = tapDrop(s0, config);
    expect(s1.drop).toEqual({ x: config.dropperX, y: config.dropStartY, vy: 0 });
    const s2 = step(s1, config, DT);
    expect(s2.drop!.y).toBeGreaterThan(s1.drop!.y);
    expect(s2.drop!.x).toBe(config.dropperX);
    expect(tapDrop(s2, config)).toBe(s2);
  });

  it('約0.6秒でプリンの頂点に届く', () => {
    const config = stillConfig();
    let s = tapDrop(createGame(1), config);
    let t = 0;
    while (s.drop) {
      s = step(s, config, DT);
      t += DT;
    }
    expect(t).toBeGreaterThan(0.55);
    expect(t).toBeLessThan(0.65);
  });
});

describe('判定', () => {
  it('距離で perfect / good / miss を判定する', () => {
    const config = createConfig(WIDTH, HEIGHT);
    expect(judgeOffset(0, config)).toBe('perfect');
    expect(judgeOffset(-config.perfectRange, config)).toBe('perfect');
    expect(judgeOffset(config.perfectRange + 1, config)).toBe('good');
    expect(judgeOffset(-config.goodRange, config)).toBe('good');
    expect(judgeOffset(config.goodRange + 0.01, config)).toBe('miss');
  });

  it('頂点ど真ん中なら JUST MEET でスコアとコンボが増える', () => {
    const config = stillConfig();
    const s = dropAndJudge(createGame(1), config);
    expect(s.status).toBe('playing');
    expect(s.lastJudge).toMatchObject({ judge: 'perfect', points: POINTS.perfect, combo: 1 });
    expect(s.combo).toBe(1);
    expect(s.score).toBe(POINTS.perfect);
    expect(s.perfectCount).toBe(1);
    expect(s.drop).toBeNull();
  });

  it('少しズレても乗れば GOOD、連続数に応じてボーナスが付く', () => {
    const base = createConfig(WIDTH, HEIGHT);
    const config = stillConfig((base.perfectRange + base.goodRange) / 2);
    let s = dropAndJudge(createGame(1), config);
    expect(s.lastJudge?.judge).toBe('good');
    expect(s.score).toBe(POINTS.good);
    s = dropAndJudge(s, config);
    expect(s.combo).toBe(2);
    expect(s.lastJudge?.points).toBe(POINTS.good + COMBO_BONUS);
    expect(s.score).toBe(POINTS.good * 2 + COMBO_BONUS);
  });

  it('ズレすぎると滑り落ちてゲームオーバーになる', () => {
    const base = createConfig(WIDTH, HEIGHT);
    const config = stillConfig(-(base.goodRange + 5));
    const ok = dropAndJudge(createGame(1), stillConfig());
    let s = dropAndJudge(ok, config);
    expect(s.status).toBe('sliding');
    expect(s.lastJudge).toMatchObject({ judge: 'miss', points: 0 });
    expect(s.slide).toMatchObject({ dir: -1, progress: 0 });
    // 連続数とスコアはミスの直前のまま
    expect(s.combo).toBe(1);
    expect(s.score).toBe(ok.score);

    // 滑り落ちている間はタップできない
    expect(tapDrop(s, config)).toBe(s);
    let frames = 0;
    while (s.status === 'sliding') {
      s = step(s, config, DT);
      frames++;
    }
    expect(s.status).toBe('over');
    expect(frames * DT).toBeCloseTo(config.slideDuration, 1);
    // 終わったらもう動かない
    expect(step(s, config, DT)).toBe(s);
    expect(tapDrop(s, config)).toBe(s);
  });

  it('フレームレートが違っても着地判定のズレはほぼ同じ', () => {
    const config = createConfig(WIDTH, HEIGHT);
    for (const seed of [3, 11, 99]) {
      const start = tapDrop(createGame(seed), config);
      const slow = runUntilJudged(start, config, 1 / 30);
      const fast = runUntilJudged(start, config, 1 / 240);
      expect(Math.abs(slow.lastJudge!.offset - fast.lastJudge!.offset)).toBeLessThan(1);
      expect(slow.lastJudge!.judge).toBe(fast.lastJudge!.judge);
    }
  });
});
