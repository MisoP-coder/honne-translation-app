import { useId } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import { sepia } from '../theme/tone';

/**
 * 無駄にクオリティが高いプリン（SVG）。
 * お皿の層と、プリン本体の層を分けて描く（本体だけを「ぶるん！」と弾ませるため）。
 */

export interface PuddingShape {
  /** 頂上の半幅 */
  topHalf: number;
  /** 底の半幅 */
  bottomHalf: number;
  height: number;
  /** 乗せたカラメルの数。カラメルが厚くなり、たれが伸びる */
  caramelCount: number;
}

export interface PuddingMetrics {
  width: number;
  height: number;
  /** SVG 内でのプリン頂上面（カラメルの着地面）の y */
  topY: number;
  /** SVG 内でのプリン底面の y */
  bottomY: number;
  plateHalf: number;
  plateHeight: number;
  dome: number;
}

export function puddingMetrics({ topHalf, bottomHalf, height, caramelCount }: PuddingShape): PuddingMetrics {
  const dome = topHalf * 0.16 + Math.min(caramelCount, 15) * 0.9;
  const plateHalf = bottomHalf * 1.35;
  const plateHeight = Math.max(14, bottomHalf * 0.3);
  const topY = dome + 6;
  const bottomY = topY + height;
  return {
    width: plateHalf * 2,
    height: bottomY + plateHeight + 6,
    topY,
    bottomY,
    plateHalf,
    plateHeight,
    dome,
  };
}

/** たれの位置（頂上の半幅に対する比率）と基本の長さ（高さに対する比率） */
const DRIPS = [
  { at: -0.62, len: 0.22 },
  { at: -0.2, len: 0.42 },
  { at: 0.28, len: 0.3 },
  { at: 0.68, len: 0.16 },
];

function bodyPath(cx: number, y0: number, y1: number, T: number, B: number, H: number) {
  const r = T * 0.16;
  const br = B * 0.12;
  return [
    `M ${cx - T} ${y0 + r}`,
    `Q ${cx - T} ${y0} ${cx - T + r} ${y0}`,
    `L ${cx + T - r} ${y0}`,
    `Q ${cx + T} ${y0} ${cx + T} ${y0 + r}`,
    // 側面は少しふくらませる
    `C ${cx + T + (B - T) * 0.15} ${y0 + H * 0.45} ${cx + B + 2} ${y1 - H * 0.3} ${cx + B} ${y1 - br}`,
    `Q ${cx + B} ${y1} ${cx + B - br} ${y1}`,
    `L ${cx - B + br} ${y1}`,
    `Q ${cx - B} ${y1} ${cx - B} ${y1 - br}`,
    `C ${cx - B - 2} ${y1 - H * 0.3} ${cx - T - (B - T) * 0.15} ${y0 + H * 0.45} ${cx - T} ${y0 + r}`,
    'Z',
  ].join(' ');
}

function caramelPath(
  cx: number,
  y0: number,
  T: number,
  H: number,
  dome: number,
  caramelCount: number,
) {
  const edge = T + 1.5;
  const depth = T * 0.14;
  const grow = 0.35 + 0.65 * (Math.min(caramelCount, 15) / 15);
  const w = T * 0.11;
  const parts = [
    `M ${cx - edge} ${y0 + depth * 0.3}`,
    `C ${cx - T * 0.95} ${y0 - dome * 1.33} ${cx + T * 0.95} ${y0 - dome * 1.33} ${cx + edge} ${y0 + depth * 0.3}`,
    `L ${cx + edge} ${y0 + depth}`,
  ];
  // 右から左へ、たれを作りながら下の縁をなぞる
  for (const d of [...DRIPS].sort((a, b) => b.at - a.at)) {
    const x = cx + d.at * T;
    const bottom = y0 + depth + d.len * H * grow;
    parts.push(
      `L ${x + w} ${y0 + depth}`,
      `C ${x + w} ${bottom - w * 1.4} ${x + w * 1.05} ${bottom} ${x} ${bottom}`,
      `C ${x - w * 1.05} ${bottom} ${x - w} ${bottom - w * 1.4} ${x - w} ${y0 + depth}`,
    );
  }
  parts.push(`L ${cx - edge} ${y0 + depth}`, 'Z');
  return parts.join(' ');
}

interface Props extends PuddingShape {
  /** 0〜1。ゲームオーバー時のセピア化 */
  sepiaAmount?: number;
  /** プリン本体だけに掛ける変形（ぶるん！・傾き） */
  bodyStyle?: Animated.WithAnimatedValue<ViewStyle>;
  testID?: string;
}

export function PuddingArt({
  topHalf: T,
  bottomHalf: B,
  height: H,
  caramelCount,
  sepiaAmount = 0,
  bodyStyle,
  testID,
}: Props) {
  // Web では SVG の id がページ全体で共有されるので、インスタンスごとに変える
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (name: string) => `${name}${uid}`;
  const c = (hex: string) => sepia(hex, sepiaAmount);
  const m = puddingMetrics({ topHalf: T, bottomHalf: B, height: H, caramelCount });
  const cx = m.width / 2;
  const y0 = m.topY;
  const y1 = m.bottomY;
  const P = m.plateHalf;
  const ph = m.plateHeight;

  return (
    <View testID={testID} pointerEvents="none" style={{ width: m.width, height: m.height }}>
      {/* お皿 */}
      <Svg width={m.width} height={m.height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={id('shadow')} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={c('#3A2205')} stopOpacity={0.4} />
            <Stop offset="1" stopColor={c('#3A2205')} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id={id('plate')} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c('#FFFFFF')} />
            <Stop offset="0.6" stopColor={c('#F4F0EA')} />
            <Stop offset="1" stopColor={c('#D8CFC1')} />
          </LinearGradient>
        </Defs>
        <Ellipse cx={cx} cy={y1 + ph * 0.55} rx={P} ry={ph * 0.6} fill={`url(#${id('shadow')})`} />
        <Ellipse
          cx={cx}
          cy={y1 + ph * 0.1}
          rx={P * 0.97}
          ry={ph * 0.5}
          fill={`url(#${id('plate')})`}
          stroke={c('#D3C8B8')}
          strokeWidth={1.5}
        />
        <Ellipse cx={cx} cy={y1 + ph * 0.02} rx={P * 0.78} ry={ph * 0.3} fill={c('#EDE6DB')} />
        {/* プリンが落とす影 */}
        <Ellipse cx={cx + B * 0.06} cy={y1} rx={B * 1.08} ry={ph * 0.28} fill={c('#7A4A10')} opacity={0.28} />
      </Svg>

      {/* プリン本体（底を支点に変形する） */}
      <Animated.View
        style={[
          { position: 'absolute', left: 0, top: 0, width: m.width, height: y1 + 1, transformOrigin: 'bottom' },
          bodyStyle,
        ]}
      >
        <Svg width={m.width} height={y1 + 1}>
          <Defs>
            <LinearGradient id={id('bodyH')} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={c('#D98A22')} />
              <Stop offset="0.16" stopColor={c('#FFCF5A')} />
              <Stop offset="0.3" stopColor={c('#FFEBA6')} />
              <Stop offset="0.55" stopColor={c('#FFD45E')} />
              <Stop offset="0.84" stopColor={c('#F0AE3A')} />
              <Stop offset="1" stopColor={c('#C97A1B')} />
            </LinearGradient>
            <LinearGradient id={id('bodyV')} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.3} />
              <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="1" stopColor={c('#A85E0C')} stopOpacity={0.45} />
            </LinearGradient>
            <LinearGradient id={id('caramel')} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c('#B8661E')} />
              <Stop offset="0.45" stopColor={c('#8A4512')} />
              <Stop offset="1" stopColor={c('#552606')} />
            </LinearGradient>
            <RadialGradient id={id('gloss')} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.85} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
          </Defs>

          <Path d={bodyPath(cx, y0, y1, T, B, H)} fill={`url(#${id('bodyH')})`} />
          <Path d={bodyPath(cx, y0, y1, T, B, H)} fill={`url(#${id('bodyV')})`} />
          {/* 側面のツヤ */}
          <Path
            d={`M ${cx - T * 0.7} ${y0 + H * 0.24} Q ${cx - (T + B) * 0.42} ${y0 + H * 0.55} ${cx - B * 0.74} ${y1 - H * 0.14}`}
            stroke="#FFFFFF"
            strokeOpacity={0.55}
            strokeWidth={T * 0.1}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d={`M ${cx + T * 0.82} ${y0 + H * 0.3} Q ${cx + (T + B) * 0.47} ${y0 + H * 0.6} ${cx + B * 0.86} ${y1 - H * 0.2}`}
            stroke={c('#FFF2C0')}
            strokeOpacity={0.35}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />

          {/* カラメル（たれ付き） */}
          <Path d={caramelPath(cx, y0, T, H, m.dome, caramelCount)} fill={`url(#${id('caramel')})`} />
          {/* 頂点のツヤ */}
          <Ellipse
            cx={cx - T * 0.28}
            cy={y0 - m.dome * 0.45}
            rx={T * 0.42}
            ry={Math.max(2.5, m.dome * 0.42)}
            fill={`url(#${id('gloss')})`}
          />
          <Circle cx={cx - T * 0.52} cy={y0 - m.dome * 0.15} r={T * 0.05} fill="#FFFFFF" opacity={0.9} />
          <Circle cx={cx + T * 0.45} cy={y0 - m.dome * 0.2} r={T * 0.03} fill="#FFFFFF" opacity={0.6} />
        </Svg>
      </Animated.View>
    </View>
  );
}
