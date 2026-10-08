import { StyleSheet, View } from 'react-native';

import type { GameConfig } from '../game/engine';
import { colors } from '../theme/colors';

interface Props {
  config: GameConfig;
  /** プリン中心の x */
  centerX: number;
  /** 横方向の速度。ぷるぷる変形（傾き・つぶれ）に使う */
  velocity: number;
  /** 乗せたカラメルの数。頂上のカラメルが少しずつ厚くなる */
  caramelCount: number;
}

/** 揺れても頂点の位置がズレて見えないよう、変形は控えめにしている */
const MAX_LEAN_DEG = 4;
const MAX_SQUASH = 0.06;

export function Pudding({ config, centerX, velocity, caramelCount }: Props) {
  const { puddingTopY, puddingTopHalfWidth: topHalf, puddingBottomHalfWidth: bottomHalf } = config;
  const height = config.puddingHeight;
  const capHeight = topHalf * 0.32 + Math.min(caramelCount, 15) * 1.4;
  const speedRatio = config.amplitude > 0 ? velocity / (config.amplitude * 4) : 0;
  const lean = Math.max(-1, Math.min(1, speedRatio)) * MAX_LEAN_DEG;
  const squash = Math.min(Math.abs(speedRatio), 1) * MAX_SQUASH;
  const plateHalf = bottomHalf * 1.35;

  return (
    <View
      testID="pudding"
      pointerEvents="none"
      style={[
        styles.root,
        {
          left: centerX - plateHalf,
          top: puddingTopY - capHeight / 2,
          width: plateHalf * 2,
          height: height + capHeight / 2 + 16,
        },
      ]}
    >
      {/* お皿 */}
      <View
        style={[
          styles.plate,
          { width: plateHalf * 2, height: 18, top: capHeight / 2 + height - 8, borderRadius: plateHalf },
        ]}
      />
      <View
        style={{
          position: 'absolute',
          left: plateHalf - bottomHalf,
          top: 0,
          width: bottomHalf * 2,
          height: height + capHeight / 2,
          transform: [{ skewX: `${-lean}deg` }, { scaleX: 1 + squash }, { scaleY: 1 - squash }],
        }}
      >
        {/* プリン本体（台形） */}
        <View
          style={[
            styles.body,
            {
              top: capHeight / 2,
              width: bottomHalf * 2,
              borderLeftWidth: bottomHalf - topHalf,
              borderRightWidth: bottomHalf - topHalf,
              borderBottomWidth: height,
            },
          ]}
        />
        {/* ハイライト */}
        <View
          style={[
            styles.highlight,
            {
              left: bottomHalf - topHalf * 0.75,
              top: capHeight / 2 + height * 0.2,
              width: topHalf * 0.18,
              height: height * 0.55,
            },
          ]}
        />
        {/* 頂上のカラメル */}
        <View
          testID="caramel-cap"
          style={[
            styles.cap,
            {
              left: bottomHalf - topHalf - 2,
              width: topHalf * 2 + 4,
              height: capHeight,
              borderRadius: topHalf,
            },
          ]}
        />
        {caramelCount > 0 && (
          <View
            style={[
              styles.drip,
              {
                left: bottomHalf - topHalf * 0.55,
                top: capHeight * 0.6,
                height: Math.min(6 + caramelCount * 1.5, height * 0.45),
              },
            ]}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute' },
  plate: {
    position: 'absolute',
    left: 0,
    backgroundColor: colors.plate,
    borderWidth: 2,
    borderColor: colors.plateShadow,
  },
  body: {
    position: 'absolute',
    left: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.pudding,
  },
  highlight: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderRadius: 999,
  },
  cap: {
    position: 'absolute',
    top: 0,
    backgroundColor: colors.caramel,
  },
  drip: {
    position: 'absolute',
    width: 8,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: colors.caramel,
  },
});
