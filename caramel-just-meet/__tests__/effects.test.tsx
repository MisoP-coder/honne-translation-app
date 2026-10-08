import { render, screen } from '@testing-library/react-native';

import { ComboPopup, comboLabel, comboStyle } from '../src/components/ComboPopup';
import { PuddingArt, puddingMetrics } from '../src/components/PuddingArt';
import { RAY_COUNT, rayPolygons, TitleBackdrop } from '../src/components/TitleBackdrop';
import { createConfig, createGame, type GameState, step, tapDrop } from '../src/game/engine';
import {
  burstCount,
  clearParticles,
  createParticleSystem,
  MAX_PARTICLES,
  paletteFor,
  ringCount,
  spawnBurst,
  stepParticles,
} from '../src/game/particles';
import { sepiaAmountFor } from '../src/screens/GameScreen';
import { sepia } from '../src/theme/tone';

describe('キラキラ（パーティクル）', () => {
  it('ミスでは出ず、JUST MEET は GOOD より派手', () => {
    expect(burstCount('miss', 10)).toBe(0);
    expect(burstCount('perfect', 0)).toBeGreaterThan(burstCount('good', 0));
    expect(ringCount('perfect', 0)).toBeGreaterThan(ringCount('good', 0));
  });

  it('コンボが増えるほど数・リング・色数が増える（上限あり）', () => {
    expect(burstCount('perfect', 10)).toBeGreaterThan(burstCount('perfect', 1));
    expect(burstCount('perfect', 1000)).toBe(burstCount('perfect', 30));
    expect(ringCount('perfect', 15)).toBeGreaterThan(ringCount('perfect', 5));
    expect(ringCount('perfect', 5)).toBeGreaterThan(ringCount('perfect', 1));
    expect(paletteFor(10).length).toBeGreaterThan(paletteFor(0).length);
  });

  it('飛び散って、重力で落ちて、寿命で消える', () => {
    let fx = spawnBurst(createParticleSystem(1), 100, 200, 'perfect', 3);
    expect(fx.particles).toHaveLength(burstCount('perfect', 3) + ringCount('perfect', 3));
    const stars = fx.particles.filter((p) => p.kind !== 'ring');
    // 上向き（y が減る方向）に飛ぶ
    expect(stars.every((p) => p.vy < 0)).toBe(true);
    const before = new Map(fx.particles.map((p) => [p.id, p]));
    fx = stepParticles(fx, 1 / 60);
    for (const p of fx.particles) {
      const b = before.get(p.id)!;
      if (p.kind === 'ring') expect(p.size).toBeGreaterThan(b.size);
      else expect(p.vy).toBeGreaterThan(b.vy * (1 - 1.6 / 60) - 1e-9);
    }
    for (let i = 0; i < 120; i++) fx = stepParticles(fx, 1 / 60);
    expect(fx.particles).toHaveLength(0);
  });

  it('同じシードなら同じ飛び方、出しすぎない', () => {
    const a = spawnBurst(createParticleSystem(9), 0, 0, 'perfect', 8);
    const b = spawnBurst(createParticleSystem(9), 0, 0, 'perfect', 8);
    expect(a.particles).toEqual(b.particles);
    let fx = createParticleSystem(2);
    for (let i = 0; i < 10; i++) fx = spawnBurst(fx, 0, 0, 'perfect', 30);
    expect(fx.particles.length).toBeLessThanOrEqual(MAX_PARTICLES);
    expect(new Set(fx.particles.map((p) => p.id)).size).toBe(fx.particles.length);
    expect(clearParticles(fx).particles).toHaveLength(0);
  });
});

describe('COMBO 表示', () => {
  it('2コンボ以上で大きく表示し、はみ出さない大きさにする', async () => {
    const event = { id: 1, judge: 'perfect' as const, offset: 0, points: 300, combo: 21 };
    await render(<ComboPopup event={event} y={200} width={390} time={0} />);
    expect(screen.getByTestId('combo-popup')).toHaveTextContent('21 COMBO!!');
    const { fontSize } = comboStyle(21, 390 - 64);
    expect(fontSize * comboLabel(21).length * 0.72 + 18).toBeLessThanOrEqual(390 - 64 + 1e-6);
  });

  it('1コンボ目やミスでは出さない', async () => {
    await render(<ComboPopup event={{ id: 1, judge: 'perfect', offset: 0, points: 300, combo: 1 }} y={0} width={390} time={0} />);
    expect(screen.queryByTestId('combo-popup')).toBeNull();
    await render(<ComboPopup event={{ id: 2, judge: 'miss', offset: 99, points: 0, combo: 5 }} y={0} width={390} time={0} />);
    expect(screen.queryByTestId('combo-popup')).toBeNull();
  });

  it('コンボ数で色と大きさが変わる', () => {
    expect(comboStyle(12).fill).not.toBe(comboStyle(3).fill);
    expect(comboStyle(25).rainbow).toBe(true);
    expect(comboStyle(12).rainbow).toBe(false);
    expect(comboStyle(12).fontSize).toBeGreaterThan(comboStyle(3).fontSize);
  });
});

describe('ゲームオーバーのセピア化', () => {
  it('amount 0 なら元の色のまま、1 なら彩度がなくなり茶色っぽくなる', () => {
    expect(sepia('#FF0000', 0)).toBe('#FF0000');
    const red = sepia('#FF0000', 1);
    const blue = sepia('#0000FF', 1);
    const parse = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    for (const [r, g, b] of [parse(red), parse(blue), parse(sepia('#FFFFFF', 1))]) {
      expect(r).toBeGreaterThanOrEqual(g);
      expect(g).toBeGreaterThanOrEqual(b);
    }
    // 白は暗めの紙の色になる（まぶしい黄色にならない）
    const [wr, wg, wb] = parse(sepia('#FFFFFF', 1));
    expect(wr).toBeLessThan(235);
    expect(wr - wb).toBeGreaterThan(40);
    expect(wg).toBeLessThan(wr);
  });

  it('滑り始めると一気に色が抜け、ゲームオーバーで完全なセピアになる', () => {
    const base = createConfig(390, 700);
    const config = { ...base, amplitude: 0, dropperX: base.dropperX + base.goodRange + 5 };
    let s: GameState = tapDrop(createGame(1), config);
    expect(sepiaAmountFor(s)).toBe(0);
    while (s.status === 'playing') s = step(s, config, 1 / 60);
    expect(s.status).toBe('sliding');
    const first = sepiaAmountFor(s);
    for (let i = 0; i < 10; i++) s = step(s, config, 1 / 60);
    expect(sepiaAmountFor(s)).toBeGreaterThan(first);
    while (s.status === 'sliding') s = step(s, config, 1 / 60);
    expect(sepiaAmountFor(s)).toBe(1);
  });
});

describe('SVG プリン', () => {
  it('カラメルを乗せるほど頂上が盛り上がる', () => {
    const shape = { topHalf: 50, bottomHalf: 72, height: 75 };
    const a = puddingMetrics({ ...shape, caramelCount: 0 });
    const b = puddingMetrics({ ...shape, caramelCount: 10 });
    expect(b.dome).toBeGreaterThan(a.dome);
    expect(b.bottomY - b.topY).toBe(shape.height);
    expect(a.width).toBeGreaterThan(shape.bottomHalf * 2);
  });

  it('描画できる', async () => {
    await render(<PuddingArt testID="art" topHalf={50} bottomHalf={72} height={75} caramelCount={5} sepiaAmount={0.5} />);
    expect(screen.getByTestId('art')).toBeTruthy();
  });
});

describe('タイトル画面の背景', () => {
  it('放射線は 1 本おきに色を付け、中心から外へ伸びる', () => {
    const rays = rayPolygons(100, 100, 50);
    expect(rays).toHaveLength(RAY_COUNT / 2);
    for (const r of rays) {
      const [c, ...edge] = r.split(' ').map((p) => p.split(',').map(Number));
      expect(c).toEqual([100, 100]);
      for (const [x, y] of edge) expect(Math.hypot(x - 100, y - 100)).toBeCloseTo(50, 0);
    }
  });

  it('描画できる（大きさが決まるまでは何も描かない）', async () => {
    const view = await render(<TitleBackdrop width={0} height={0} />);
    expect(screen.queryByTestId('title-backdrop')).toBeNull();
    await view.rerender(<TitleBackdrop width={390} height={844} />);
    expect(screen.getByTestId('title-backdrop')).toBeTruthy();
  });
});
