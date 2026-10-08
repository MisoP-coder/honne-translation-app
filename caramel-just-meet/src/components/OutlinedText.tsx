import type { ReactNode } from 'react';
import { StyleSheet, Text, type TextStyle, View } from 'react-native';

/**
 * 太い縁取り＋立体的な影（押し出し）付きの文字。パチンコ・バカゲー風の文字に使う。
 * スマホの Text には縁取りの機能がないので、同じ文字を少しずつずらして重ねて描く。
 *   1. 影：右下方向に depth 段ぶん重ねて、立体的に押し出したように見せる
 *   2. 縁取り：上下左右斜めの 8 方向にずらした文字
 *   3. 本体
 */

interface Props {
  children: ReactNode;
  /** fontSize・fontWeight・textAlign など（color は fill で指定） */
  style?: TextStyle;
  fill: string;
  outline?: string;
  outlineWidth?: number;
  /** 立体の影の色と段数 */
  shadow?: string;
  depth?: number;
  numberOfLines?: number;
  testID?: string;
}

const DIRECTIONS: readonly [number, number][] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

export function OutlinedText({
  children,
  style,
  fill,
  outline = '#000000',
  outlineWidth = 3,
  shadow = '#000000',
  depth = 4,
  numberOfLines,
  testID,
}: Props) {
  const layer = (key: string, dx: number, dy: number, color: string) => (
    <Text
      key={key}
      // 縁取り・影用の重ねた文字は読み上げない（本体の 1 つだけ読ませる）
      accessible={false}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      numberOfLines={numberOfLines}
      style={[style, styles.layer, { left: dx, top: dy, right: -dx, bottom: -dy, color }]}
    >
      {children}
    </Text>
  );

  const layers: ReactNode[] = [];
  // 影（奥から順に）。縁取りの太さぶん外側から押し出す
  for (let i = depth; i >= 1; i--) {
    for (const [dx, dy] of DIRECTIONS) {
      if (dx < 0 || dy < 0) continue;
      layers.push(layer(`s${i}-${dx}${dy}`, dx * outlineWidth + i, dy * outlineWidth + i, shadow));
    }
  }
  for (const [dx, dy] of DIRECTIONS) {
    layers.push(layer(`o${dx}${dy}`, dx * outlineWidth, dy * outlineWidth, outline));
  }

  return (
    <View pointerEvents="none">
      {layers}
      <Text testID={testID} numberOfLines={numberOfLines} style={[style, { color: fill }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', textShadowRadius: 0 },
});
