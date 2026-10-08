import { render, screen } from '@testing-library/react-native';

import { impactFor, rainbowColor } from '../src/components/ComboPopup';
import {
  Fever,
  feverLevel,
  PULSE_HZ,
  RAINBOW_COMBO,
  SPEED_LINES_COMBO,
  speedLinePolygons,
} from '../src/components/Fever';
import { JudgePopup } from '../src/components/JudgePopup';
import { OutlinedText } from '../src/components/OutlinedText';
import { PuddingArt } from '../src/components/PuddingArt';
import { makeNoiseTile, TvNoise } from '../src/components/TvNoise';
import { INITIAL_FACE, stepFace } from '../src/game/face';

describe('文字の破壊力', () => {
  it('縁取りと立体の影のぶん、同じ文字を重ねて描く', async () => {
    await render(
      <OutlinedText testID="t" fill="#FFE600" outlineWidth={3} depth={4}>
        JUST MEET!!
      </OutlinedText>,
    );
    expect(screen.getByTestId('t')).toHaveTextContent('JUST MEET!!');
    // 本体1 + 縁取り8 + 影（右・下・右下の3方向 × 4段）
    expect(screen.getAllByText('JUST MEET!!', { includeHiddenElements: true })).toHaveLength(1 + 8 + 12);
  });

  it('コンボが増えるほど「ドーン！」が強くなる（上限あり）', () => {
    expect(impactFor(2)).toBe(0);
    expect(impactFor(21)).toBeGreaterThan(impactFor(12));
    expect(impactFor(12)).toBeGreaterThan(impactFor(5));
    expect(impactFor(999)).toBe(1);
  });

  it('ミスの「ずるっ…」を表示できる', async () => {
    await render(<JudgePopup event={{ id: 1, judge: 'miss', offset: 40, points: 0, combo: 3 }} x={100} y={300} />);
    expect(screen.getByTestId('judge-label')).toHaveTextContent('ずるっ…');
  });
});

describe('フィーバー背景', () => {
  it('10コンボで集中線、20コンボで虹色。プレイ中だけ', () => {
    expect(feverLevel(SPEED_LINES_COMBO - 1, true)).toBe(0);
    expect(feverLevel(SPEED_LINES_COMBO, true)).toBe(1);
    expect(feverLevel(RAINBOW_COMBO, true)).toBe(2);
    expect(feverLevel(RAINBOW_COMBO + 30, false)).toBe(0);
  });

  it('集中線は中心から放射状に伸び、時間で回る', () => {
    const a = speedLinePolygons(100, 100, 500, 0, 12);
    const b = speedLinePolygons(100, 100, 500, 15, 12);
    expect(a).toHaveLength(12);
    expect(a).not.toEqual(b);
    for (const poly of a) {
      const pts = poly.split(' ').map((p) => p.split(',').map(Number));
      const dist = pts.map(([x, y]) => Math.hypot(x - 100, y - 100));
      expect(dist[0]).toBeLessThan(dist[1]);
      expect(dist[1]).toBeCloseTo(500, 0);
    }
  });

  it('虹色は時間で色相が回る', () => {
    expect(rainbowColor(0)).not.toBe(rainbowColor(0.1));
    expect(rainbowColor(0)).toMatch(/^hsl\(\d+, 100%, 60%\)$/);
  });

  it('全画面の明滅は1秒に3回未満（光過敏への配慮）', () => {
    expect(PULSE_HZ).toBeLessThan(3);
  });

  it('レベルに応じて描き分ける', async () => {
    const props = { width: 390, height: 700, cx: 195, cy: 500, time: 1 };
    await render(<Fever {...props} level={0} />);
    expect(screen.queryByTestId('fever-lines')).toBeNull();
    await render(<Fever {...props} level={1} />);
    expect(screen.getByTestId('fever-lines')).toBeTruthy();
    await render(<Fever {...props} level={2} />);
    expect(screen.getByTestId('fever-rainbow')).toBeTruthy();
  });
});

describe('砂嵐', () => {
  it('同じシードなら同じ模様で、黒っぽい粒と白っぽい粒が混ざる', () => {
    const a = makeNoiseTile(1, 200);
    expect(a).toEqual(makeNoiseTile(1, 200));
    expect(a).not.toEqual(makeNoiseTile(2, 200));
    expect(a.some((p) => p.gray < 60)).toBe(true);
    expect(a.some((p) => p.gray > 190)).toBe(true);
    expect(a.every((p) => p.x >= 0 && p.x < 96 && p.y >= 0 && p.y < 96)).toBe(true);
  });

  it('セピア化していないときは出さない', async () => {
    await render(<TvNoise amount={0} />);
    expect(screen.queryByTestId('tv-noise')).toBeNull();
    await render(<TvNoise amount={0.5} />);
    expect(screen.getByTestId('tv-noise')).toBeTruthy();
  });
});

describe('プリンの顔', () => {
  it('プリンが急に動くと顔は慣性で逆側に置いていかれ、やがて戻る', () => {
    const dt = 1 / 60;
    // プリンが右へ急発進
    let face = stepFace(INITIAL_FACE, 0, dt, 20);
    face = stepFace(face, 300, dt, 20);
    for (let i = 0; i < 3; i++) face = stepFace(face, 300, dt, 20);
    expect(face.x).toBeLessThan(0);
    expect(face.y).toBeLessThanOrEqual(0);
    // そのまま等速で動き続けると、プルプルしながら真ん中に戻る
    let maxAfter = 0;
    for (let i = 0; i < 240; i++) {
      face = stepFace(face, 300, dt, 20);
      if (i > 180) maxAfter = Math.max(maxAfter, Math.abs(face.x));
    }
    expect(maxAfter).toBeLessThan(0.5);
  });

  it('大きく振り回されても顔はプリンからはみ出さない', () => {
    let face = INITIAL_FACE;
    for (let i = 0; i < 60; i++) face = stepFace(face, i % 2 ? 3000 : -3000, 1 / 60, 12);
    expect(Math.abs(face.x)).toBeLessThanOrEqual(12);
  });

  it('普段の顔とゲームオーバーの顔を描ける', async () => {
    const shape = { topHalf: 50, bottomHalf: 72, height: 75, caramelCount: 3 };
    await render(<PuddingArt testID="a" {...shape} faceOffset={{ x: 5, y: -1 }} />);
    expect(screen.getByTestId('a')).toBeTruthy();
    await render(<PuddingArt testID="b" {...shape} faceMood="shock" sepiaAmount={1} />);
    expect(screen.getByTestId('b')).toBeTruthy();
  });
});
