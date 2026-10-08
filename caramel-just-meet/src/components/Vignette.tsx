import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

/** 画面の四隅を暗くする（ゲームオーバー時のシリアスな雰囲気づくり） */
export function Vignette({ width, height, amount }: { width: number; height: number; amount: number }) {
  if (amount <= 0) return null;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none" opacity={amount}>
      <Defs>
        <RadialGradient id="vignette" cx="50%" cy="55%" r="75%">
          <Stop offset="0.35" stopColor="#1A0E00" stopOpacity={0} />
          <Stop offset="1" stopColor="#1A0E00" stopOpacity={0.85} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#vignette)" />
    </Svg>
  );
}
