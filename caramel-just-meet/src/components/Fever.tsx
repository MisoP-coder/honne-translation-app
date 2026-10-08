import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

import { rainbowColor } from './ComboPopup';

/** 集中線を出すコンボ数 */
export const SPEED_LINES_COMBO = 10;
/** 虹色フィーバーになるコンボ数 */
export const RAINBOW_COMBO = 20;
const LINE_COUNT = 36;

/**
 * 全体の明るさの脈動は 1 秒に 3 回未満に抑える。
 * それより速い全画面の点滅は、光に敏感な人の発作を招くおそれがあるため。
 * （色相はいくら速く回しても明るさはほぼ一定なので、こちらは派手に回す）
 */
export const PULSE_HZ = 2.4;

export type FeverLevel = 0 | 1 | 2;

export function feverLevel(combo: number, playing: boolean): FeverLevel {
  if (!playing) return 0;
  if (combo >= RAINBOW_COMBO) return 2;
  if (combo >= SPEED_LINES_COMBO) return 1;
  return 0;
}

/** 中心から放射状に伸びる集中線の三角形の頂点 */
export function speedLinePolygons(
  cx: number,
  cy: number,
  radius: number,
  rotationDeg: number,
  count = LINE_COUNT,
): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    // 線ごとに太さを少し変えて手描きっぽく
    const half = ((Math.PI * 2) / count) * (0.16 + ((i * 7) % 5) * 0.05);
    const a = (rotationDeg * Math.PI) / 180 + (i * Math.PI * 2) / count;
    const inner = radius * (0.18 + ((i * 3) % 4) * 0.04);
    const p = (ang: number, r: number) => `${(cx + Math.cos(ang) * r).toFixed(1)},${(cy + Math.sin(ang) * r).toFixed(1)}`;
    out.push(`${p(a, inner)} ${p(a - half, radius)} ${p(a + half, radius)}`);
  }
  return out;
}

interface Props {
  width: number;
  height: number;
  /** プリンの中心（集中線と後光の中心） */
  cx: number;
  cy: number;
  level: FeverLevel;
  time: number;
}

/** コンボ中の背景演出（プリンより奥に描く） */
export const Fever = memo(function Fever({ width, height, cx, cy, level, time }: Props) {
  if (level === 0) return null;
  const radius = Math.hypot(width, height);
  const rainbow = level === 2;
  // 集中線はゆっくり回し、虹色のときは速く回す
  const rotation = time * (rainbow ? 70 : 18);
  const pulse = 0.5 + 0.5 * Math.sin(time * Math.PI * 2 * PULSE_HZ);
  const lines = speedLinePolygons(cx, cy, radius, rotation);

  return (
    <Svg testID={rainbow ? 'fever-rainbow' : 'fever-lines'} width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="feverHalo" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={rainbowColor(time, 40, 75)} stopOpacity={0.95} />
          <Stop offset="0.45" stopColor={rainbowColor(time, 120, 60)} stopOpacity={0.6} />
          <Stop offset="1" stopColor={rainbowColor(time, 220, 55)} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {rainbow && (
        <Rect x={0} y={0} width={width} height={height} fill={rainbowColor(time, 0, 55)} opacity={0.22 + pulse * 0.14} />
      )}
      {lines.map((points, i) => (
        <Polygon
          key={i}
          points={points}
          fill={rainbow ? rainbowColor(time, (i * 360) / LINE_COUNT, 55) : '#5A2A06'}
          opacity={rainbow ? 0.45 : 0.13}
        />
      ))}
      {rainbow && <Circle cx={cx} cy={cy} r={130 + pulse * 30} fill="url(#feverHalo)" />}
    </Svg>
  );
});
