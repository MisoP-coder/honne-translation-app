import { useId } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

import { sepia } from '../theme/tone';

/**
 * 無駄にクオリティが高いプリン（SVG）。
 * 平たくて背の低いカスタードプリンに、ツヤツヤのカラメルがかかり、お皿にカラメルがたまっている。
 * 正面にはかわいい顔。少し上から見下ろした角度で描く（頂上の面が楕円に見える）。
 * お皿の層と、プリン本体の層を分けて描く（本体だけを「ぶるん！」と弾ませるため）。
 */

export interface PuddingShape {
  /** 頂上の半幅（カラメルが乗る面。判定の幅と同じ） */
  topHalf: number;
  /** 底の半幅 */
  bottomHalf: number;
  height: number;
  /** 乗せたカラメルの数。カラメルが厚くなり、たれとお皿のカラメルだまりが大きくなる */
  caramelCount: number;
}

export interface PuddingMetrics {
  width: number;
  height: number;
  /** SVG 内でのプリン頂上面（カラメルの着地面）の y */
  topY: number;
  /** SVG 内でのプリン底面（手前のいちばん下）の y */
  bottomY: number;
  plateHalf: number;
  plateHeight: number;
  /** 頂上面の中心から、カラメルのいちばん上までの高さ */
  dome: number;
}

/** 頂上の楕円の縦の半径（見下ろす角度の深さ） */
const topRy = (topHalf: number) => topHalf * 0.2;
const grow = (caramelCount: number) => Math.min(caramelCount, 15) / 15;

export function puddingMetrics({ topHalf, bottomHalf, height, caramelCount }: PuddingShape): PuddingMetrics {
  // カラメルが厚くなるほど、頂上のカラメルの面が少し持ち上がる
  const dome = topRy(topHalf) + grow(caramelCount) * 4 + 2;
  const plateHalf = bottomHalf * 1.5;
  const plateHeight = Math.max(16, bottomHalf * 0.34);
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

/** カラメルのたれ（頂上の手前の縁に沿った角度 θ（度）と、高さに対する長さ） */
const DRIPS = [
  { at: 168, len: 0.1 },
  { at: 145, len: 0.2 },
  { at: 122, len: 0.08 },
  { at: 104, len: 0.14 },
  { at: 76, len: 0.22 },
  { at: 58, len: 0.09 },
  { at: 34, len: 0.17 },
  { at: 12, len: 0.11 },
];

/** カスタードの細かい気泡（毎回同じ位置。プリン中心からの比率） */
const PORES = [
  [-0.62, 0.3], [-0.4, 0.62], [-0.15, 0.42], [0.1, 0.78], [0.33, 0.35], [0.55, 0.66],
  [-0.75, 0.75], [0.7, 0.45], [-0.05, 0.88], [0.22, 0.55], [-0.48, 0.18], [0.45, 0.85],
] as const;

function bodyPath(cx: number, y0: number, y1: number, T: number, B: number, H: number, ry: number) {
  const br = B * 0.14;
  const yb = y1 - ry * 0.75; // 底の左右の角（奥にあるので手前より少し上）
  return [
    `M ${cx - T} ${y0}`,
    // 側面はほぼまっすぐ、ほんの少しだけふくらませる
    `C ${cx - T - (B - T) * 0.4} ${y0 + H * 0.35} ${cx - B + (B - T) * 0.05} ${yb - H * 0.35} ${cx - B} ${yb - br}`,
    `Q ${cx - B} ${yb} ${cx - B + br * 1.1} ${yb + ry * 0.3}`,
    // 底の手前の縁は下にふくらむ（見下ろしているので楕円になる）
    `C ${cx - B * 0.5} ${y1 + ry * 0.3} ${cx + B * 0.5} ${y1 + ry * 0.3} ${cx + B - br * 1.1} ${yb + ry * 0.3}`,
    `Q ${cx + B} ${yb} ${cx + B} ${yb - br}`,
    `C ${cx + B - (B - T) * 0.05} ${yb - H * 0.35} ${cx + T + (B - T) * 0.4} ${y0 + H * 0.35} ${cx + T} ${y0}`,
    // 頂上の奥側の縁
    `A ${T} ${ry} 0 0 0 ${cx - T} ${y0}`,
    'Z',
  ].join(' ');
}

/** 頂上の縁からたれるカラメル（縁は少しギザギザ） */
function caramelSheetPath(cx: number, y0: number, T: number, H: number, ry: number, count: number) {
  const g = 0.4 + 0.6 * grow(count);
  const band = T * 0.09 + grow(count) * T * 0.06;
  const edge = T + 1.5;
  const parts = [`M ${cx - edge} ${y0}`, `A ${edge} ${ry} 0 0 0 ${cx + edge} ${y0}`];
  // 右から左へ、手前の縁に沿ってたれを作る
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const deg = (i / steps) * 180;
    const th = (deg * Math.PI) / 180;
    let drip = 0;
    for (const d of DRIPS) {
      const k = (deg - d.at) / 5.5;
      drip += d.len * H * g * Math.exp(-k * k);
    }
    // 縁のギザギザ
    const jag = Math.sin(deg * 0.9) * 0.8 + Math.sin(deg * 2.3) * 0.6;
    parts.push(`L ${(cx + edge * Math.cos(th)).toFixed(2)} ${(y0 + ry * Math.sin(th) + band + drip + jag).toFixed(2)}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

/** 顔の表情。shock はゲームオーバー時 */
export type FaceMood = 'normal' | 'shock';

interface FaceProps {
  fx: number;
  fy: number;
  T: number;
  mood: FaceMood;
  c: (hex: string) => string;
}

/** かわいい顔：ツヤのある黒目、ほっぺ、にっこり口。(fx, fy) は両目の中間 */
function Face({ fx, fy, T, mood, c }: FaceProps) {
  const eyeGap = T * 0.34;
  const eyeR = T * 0.075;
  const ink = c('#3B1F0E');
  const stroke = Math.max(2, T * 0.035);
  if (mood === 'shock') {
    // 白目をむいた小さい目と、ぐにゃぐにゃの口
    const w = T * 0.16;
    const mouthY = fy + T * 0.18;
    return (
      <G>
        <Circle cx={fx - eyeGap} cy={fy} r={eyeR * 1.15} fill="#FFFFFF" stroke={ink} strokeWidth={stroke * 0.7} />
        <Circle cx={fx + eyeGap} cy={fy} r={eyeR * 1.15} fill="#FFFFFF" stroke={ink} strokeWidth={stroke * 0.7} />
        <Circle cx={fx - eyeGap} cy={fy} r={eyeR * 0.32} fill={ink} />
        <Circle cx={fx + eyeGap} cy={fy} r={eyeR * 0.32} fill={ink} />
        <Path
          d={`M ${fx - w} ${mouthY} q ${w / 4} ${-w / 3} ${w / 2} 0 t ${w / 2} 0 t ${w / 2} 0 t ${w / 2} 0`}
          stroke={ink}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
        />
      </G>
    );
  }
  return (
    <G>
      {/* ほっぺ */}
      <Ellipse cx={fx - T * 0.52} cy={fy + T * 0.15} rx={T * 0.11} ry={T * 0.07} fill={c('#F49A90')} opacity={0.7} />
      <Ellipse cx={fx + T * 0.52} cy={fy + T * 0.15} rx={T * 0.11} ry={T * 0.07} fill={c('#F49A90')} opacity={0.7} />
      {/* ツヤのある目 */}
      <Circle cx={fx - eyeGap} cy={fy} r={eyeR} fill={ink} />
      <Circle cx={fx + eyeGap} cy={fy} r={eyeR} fill={ink} />
      <Circle cx={fx - eyeGap + eyeR * 0.3} cy={fy - eyeR * 0.35} r={eyeR * 0.32} fill="#FFFFFF" />
      <Circle cx={fx + eyeGap + eyeR * 0.3} cy={fy - eyeR * 0.35} r={eyeR * 0.32} fill="#FFFFFF" />
      {/* にっこり */}
      <Path
        d={`M ${fx - T * 0.12} ${fy + T * 0.07} Q ${fx} ${fy + T * 0.2} ${fx + T * 0.12} ${fy + T * 0.07}`}
        stroke={ink}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
      />
    </G>
  );
}

interface Props extends PuddingShape {
  /** 0〜1。ゲームオーバー時のセピア化 */
  sepiaAmount?: number;
  /** プリン本体だけに掛ける変形（ぶるん！・傾き） */
  bodyStyle?: Animated.WithAnimatedValue<ViewStyle>;
  /** 顔のずれ（慣性で遅れて動く） */
  faceOffset?: { x: number; y: number };
  faceMood?: FaceMood;
  testID?: string;
}

export function PuddingArt({
  topHalf: T,
  bottomHalf: B,
  height: H,
  caramelCount,
  sepiaAmount = 0,
  bodyStyle,
  faceOffset = { x: 0, y: 0 },
  faceMood = 'normal',
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
  const ry = topRy(T);
  const g = grow(caramelCount);
  const lift = g * 4;
  const body = bodyPath(cx, y0, y1, T, B, H, ry);

  return (
    <View testID={testID} pointerEvents="none" style={{ width: m.width, height: m.height }}>
      {/* お皿とカラメルだまり */}
      <Svg width={m.width} height={m.height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={id('shadow')} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={c('#3A2205')} stopOpacity={0.35} />
            <Stop offset="1" stopColor={c('#3A2205')} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id={id('plate')} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c('#FFFFFF')} />
            <Stop offset="0.55" stopColor={c('#F6F3EE')} />
            <Stop offset="1" stopColor={c('#D9D2C6')} />
          </LinearGradient>
          <RadialGradient id={id('pool')} cx="50%" cy="40%" r="60%">
            <Stop offset="0" stopColor={c('#8E3E0C')} />
            <Stop offset="0.6" stopColor={c('#C2671E')} />
            <Stop offset="1" stopColor={c('#E39A45')} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={cx} cy={y1 + ph * 0.6} rx={P} ry={ph * 0.65} fill={`url(#${id('shadow')})`} />
        {/* お皿：縁と、一段くぼんだ内側 */}
        <Ellipse cx={cx} cy={y1 + ph * 0.05} rx={P * 0.97} ry={ph * 0.62} fill={`url(#${id('plate')})`} stroke={c('#D3CABC')} strokeWidth={1.5} />
        <Ellipse cx={cx} cy={y1 - ph * 0.02} rx={P * 0.8} ry={ph * 0.44} fill={c('#EFEBE4')} />
        <Ellipse cx={cx} cy={y1 - ph * 0.06} rx={P * 0.77} ry={ph * 0.4} fill={c('#FBF9F6')} />
        {/* お皿にたまったカラメル（乗せるほど広がる） */}
        <Ellipse
          cx={cx}
          cy={y1 - ry * 0.35}
          rx={B * (1.12 + g * 0.22)}
          ry={ry * (1.25 + g * 0.35)}
          fill={`url(#${id('pool')})`}
        />
        <Ellipse cx={cx - B * 0.55} cy={y1 - ry * 0.05} rx={B * 0.28} ry={ry * 0.22} fill="#FFFFFF" opacity={0.35} />
      </Svg>

      {/* プリン本体（底を支点に変形する） */}
      <Animated.View
        style={[
          { position: 'absolute', left: 0, top: 0, width: m.width, height: y1 + 2, transformOrigin: 'bottom' },
          bodyStyle,
        ]}
      >
        <Svg width={m.width} height={y1 + 2}>
          <Defs>
            <LinearGradient id={id('bodyH')} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={c('#E2B04E')} />
              <Stop offset="0.16" stopColor={c('#F8DC85')} />
              <Stop offset="0.34" stopColor={c('#FFEDAE')} />
              <Stop offset="0.6" stopColor={c('#FAE08E')} />
              <Stop offset="0.86" stopColor={c('#F0C867')} />
              <Stop offset="1" stopColor={c('#D6A044')} />
            </LinearGradient>
            <LinearGradient id={id('bodyV')} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c('#B8661E')} stopOpacity={0.25} />
              <Stop offset="0.25" stopColor="#FFFFFF" stopOpacity={0.12} />
              <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="1" stopColor={c('#C8913A')} stopOpacity={0.45} />
            </LinearGradient>
            <LinearGradient id={id('caramel')} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c('#E08A34')} />
              <Stop offset="0.35" stopColor={c('#C2621B')} />
              <Stop offset="1" stopColor={c('#8A3A0C')} />
            </LinearGradient>
            <RadialGradient id={id('top')} cx="50%" cy="55%" r="60%">
              <Stop offset="0" stopColor={c('#C9681F')} />
              <Stop offset="0.7" stopColor={c('#A84C14')} />
              <Stop offset="1" stopColor={c('#7E340A')} />
            </RadialGradient>
            <LinearGradient id={id('gloss')} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="0.3" stopColor="#FFFFFF" stopOpacity={0.75} />
              <Stop offset="0.7" stopColor="#FFFFFF" stopOpacity={0.55} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
          </Defs>

          <Path d={body} fill={`url(#${id('bodyH')})`} />
          <Path d={body} fill={`url(#${id('bodyV')})`} />
          {/* カスタードの気泡 */}
          {PORES.map(([px, py], i) => (
            <Circle
              key={i}
              cx={cx + px * (T + (B - T) * py)}
              cy={y0 + H * py}
              r={1 + (i % 3) * 0.5}
              fill={c('#E3B254')}
              opacity={0.18}
            />
          ))}
          {/* 側面のツヤ */}
          <Path
            d={`M ${cx - T * 0.8} ${y0 + H * 0.28} Q ${cx - (T + B) * 0.46} ${y0 + H * 0.55} ${cx - B * 0.84} ${y1 - H * 0.22}`}
            stroke="#FFFFFF"
            strokeOpacity={0.6}
            strokeWidth={T * 0.11}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d={`M ${cx - T * 0.6} ${y0 + H * 0.32} Q ${cx - (T + B) * 0.33} ${y0 + H * 0.55} ${cx - B * 0.66} ${y1 - H * 0.3}`}
            stroke="#FFFFFF"
            strokeOpacity={0.3}
            strokeWidth={T * 0.04}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d={`M ${cx + T * 0.9} ${y0 + H * 0.3} Q ${cx + (T + B) * 0.5} ${y0 + H * 0.6} ${cx + B * 0.9} ${y1 - H * 0.25}`}
            stroke={c('#FFF4D0')}
            strokeOpacity={0.45}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />

          {/* 縁からたれるカラメル */}
          <Path d={caramelSheetPath(cx, y0, T, H, ry, caramelCount)} fill={`url(#${id('caramel')})`} />
          {/* 頂上のカラメルの面 */}
          <Ellipse cx={cx} cy={y0 - lift} rx={T + 1.5} ry={ry} fill={`url(#${id('top')})`} />
          {/* ツヤ：手前の縁の照り返しと、頂上の映り込み */}
          <Path
            d={`M ${cx - T * 0.85} ${y0 + ry * 0.45} A ${T * 0.9} ${ry * 0.9} 0 0 0 ${cx + T * 0.7} ${y0 + ry * 0.55}`}
            stroke={`url(#${id('gloss')})`}
            strokeWidth={Math.max(1.5, T * 0.045)}
            strokeLinecap="round"
            fill="none"
          />
          <Ellipse cx={cx - T * 0.25} cy={y0 - lift - ry * 0.25} rx={T * 0.45} ry={ry * 0.32} fill="#FFFFFF" opacity={0.28} />
          <Circle cx={cx - T * 0.55} cy={y0 - lift + ry * 0.1} r={T * 0.035} fill="#FFFFFF" opacity={0.9} />
          <Circle cx={cx + T * 0.42} cy={y0 - lift - ry * 0.2} r={T * 0.025} fill="#FFFFFF" opacity={0.7} />

          {/* 正面の顔 */}
          <Face fx={cx + faceOffset.x} fy={y0 + H * 0.56 + faceOffset.y} T={T} mood={faceMood} c={c} />
        </Svg>
      </Animated.View>
    </View>
  );
}
