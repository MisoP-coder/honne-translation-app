import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { sepia } from '../theme/tone';

const W = 60;
const H = 74;

/** 画面上部に固定されたカラメルの容器。ここから真下にカラメルが落ちる */
export function Dropper({ x, y, sepiaAmount = 0 }: { x: number; y: number; sepiaAmount?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const c = (hex: string) => sepia(hex, sepiaAmount);
  return (
    <View pointerEvents="none" style={[styles.root, { left: x - W / 2, top: y - H + 4 }]}>
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id={`bottle${uid}`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={c('#6B3208')} />
            <Stop offset="0.3" stopColor={c('#C9772A')} />
            <Stop offset="0.6" stopColor={c('#9A4C12')} />
            <Stop offset="1" stopColor={c('#552606')} />
          </LinearGradient>
          <LinearGradient id={`cap${uid}`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={c('#B22222')} />
            <Stop offset="0.35" stopColor={c('#FF6B5A')} />
            <Stop offset="1" stopColor={c('#8B1A1A')} />
          </LinearGradient>
        </Defs>
        {/* 逆さまのボトル：上が底、下が注ぎ口 */}
        <Rect x={6} y={2} width={W - 12} height={44} rx={12} fill={`url(#bottle${uid})`} />
        <Ellipse cx={18} cy={20} rx={4} ry={13} fill="#FFFFFF" opacity={0.35} />
        <Path d={`M 14 44 L ${W - 14} 44 L ${W / 2 + 7} 58 L ${W / 2 - 7} 58 Z`} fill={`url(#cap${uid})`} />
        <Path d={`M ${W / 2 - 5} 58 L ${W / 2 + 5} 58 L ${W / 2 + 2} 70 L ${W / 2 - 2} 70 Z`} fill={`url(#cap${uid})`} />
      </Svg>
      <Text style={[styles.label, { color: c('#FFF3DC') }]}>CARAMEL</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', width: W, height: H },
  label: {
    position: 'absolute',
    top: 18,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
