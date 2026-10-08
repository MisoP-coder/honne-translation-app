import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';

import { sepia } from '../theme/tone';

interface Props {
  x: number;
  y: number;
  radius: number;
  /** 滑り落ちるときの傾き（度） */
  tilt?: number;
  /** 落下中は少し縦に伸ばす */
  stretch?: number;
  sepiaAmount?: number;
  testID?: string;
}

/** しずくの高さ（半径に対する倍率） */
const HEIGHT_RATIO = 2.9;

/** 立体感のあるカラメルの一滴。(x, y) はしずくの丸い部分の中心 */
export function CaramelDrop({ x, y, radius: r, tilt = 0, stretch = 1, sepiaAmount = 0, testID }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const c = (hex: string) => sepia(hex, sepiaAmount);
  const w = r * 2 + 2;
  const h = r * HEIGHT_RATIO + 2;
  const cx = w / 2;
  const cy = h - r - 1;
  // 先のとがったしずく形：上の先端から丸い底へ
  const d = [
    `M ${cx} 1`,
    `C ${cx + r * 0.25} ${h * 0.32} ${cx + r} ${cy - r * 0.75} ${cx + r} ${cy}`,
    `A ${r} ${r} 0 0 1 ${cx - r} ${cy}`,
    `C ${cx - r} ${cy - r * 0.75} ${cx - r * 0.25} ${h * 0.32} ${cx} 1`,
    'Z',
  ].join(' ');

  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - w / 2,
        top: y - cy,
        width: w,
        height: h,
        transformOrigin: `${cx}px ${cy}px`,
        transform: [{ rotate: `${tilt}deg` }, { scaleY: stretch }, { scaleX: 1 / Math.sqrt(stretch) }],
      }}
    >
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id={`drop${uid}`} cx="38%" cy="70%" r="65%">
            <Stop offset="0" stopColor={c('#D98436')} />
            <Stop offset="0.45" stopColor={c('#9A4C12')} />
            <Stop offset="1" stopColor={c('#4A2205')} />
          </RadialGradient>
        </Defs>
        <Path d={d} fill={`url(#drop${uid})`} stroke={c('#3E1C04')} strokeWidth={0.8} />
        {/* ツヤ */}
        <Ellipse cx={cx - r * 0.4} cy={cy - r * 0.25} rx={r * 0.22} ry={r * 0.42} fill="#FFFFFF" opacity={0.7} />
        <Ellipse cx={cx - r * 0.1} cy={h * 0.35} rx={r * 0.08} ry={r * 0.22} fill="#FFFFFF" opacity={0.45} />
        {/* 底の照り返し */}
        <Ellipse cx={cx + r * 0.35} cy={cy + r * 0.55} rx={r * 0.3} ry={r * 0.12} fill={c('#F0A050')} opacity={0.55} />
      </Svg>
    </View>
  );
}
