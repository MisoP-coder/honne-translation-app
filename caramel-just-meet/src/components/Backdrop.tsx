import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { sepia } from '../theme/tone';

interface Props {
  width: number;
  height: number;
  /** テーブルの奥の縁の y（お皿のあたり） */
  tableY: number;
  sepiaAmount: number;
}

/** 背景：ほんのり光の当たった壁と木のテーブル */
export const Backdrop = memo(function Backdrop({ width, height, tableY, sepiaAmount }: Props) {
  const c = (hex: string) => sepia(hex, sepiaAmount);
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="bdWall" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c('#FFF8EA')} />
          <Stop offset="1" stopColor={c('#FFE4B0')} />
        </LinearGradient>
        <RadialGradient id="bdSpot" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={c('#FFFFFF')} stopOpacity={0.9} />
          <Stop offset="1" stopColor={c('#FFFFFF')} stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id="bdTable" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c('#E0A868')} />
          <Stop offset="0.08" stopColor={c('#C98A4B')} />
          <Stop offset="1" stopColor={c('#8E5A2B')} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#bdWall)" />
      <Ellipse cx={width / 2} cy={tableY - 40} rx={width * 0.7} ry={height * 0.35} fill="url(#bdSpot)" />
      <Rect x={0} y={tableY} width={width} height={height - tableY} fill="url(#bdTable)" />
      {/* 木目 */}
      {[0.25, 0.5, 0.75].map((f) => (
        <Rect
          key={f}
          x={0}
          y={tableY + (height - tableY) * f}
          width={width}
          height={1.5}
          fill={c('#6E4220')}
          opacity={0.25}
        />
      ))}
    </Svg>
  );
});
