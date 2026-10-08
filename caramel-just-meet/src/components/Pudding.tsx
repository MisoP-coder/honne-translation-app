import { useEffect, useRef } from 'react';
import { Animated, Platform, View } from 'react-native';

import type { GameConfig } from '../game/engine';
import { PuddingArt, puddingMetrics } from './PuddingArt';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export interface BounceTrigger {
  /** 変わるたびに弾む */
  id: number;
  /** 1 で最大（JUST MEET）、小さいほど控えめ */
  strength: number;
}

interface Props {
  config: GameConfig;
  /** プリン中心の x */
  centerX: number;
  /** 横方向の速度。ぷるぷる変形（傾き・つぶれ）に使う */
  velocity: number;
  /** 乗せたカラメルの数 */
  caramelCount: number;
  bounce: BounceTrigger | null;
  sepiaAmount: number;
}

/** 揺れても頂点の位置がズレて見えないよう、揺れによる変形は控えめにしている */
const MAX_LEAN_DEG = 4;
const MAX_SQUASH = 0.06;

export function Pudding({ config, centerX, velocity, caramelCount, bounce, sepiaAmount }: Props) {
  const shape = {
    topHalf: config.puddingTopHalfWidth,
    bottomHalf: config.puddingBottomHalfWidth,
    height: config.puddingHeight,
    caramelCount,
  };
  const m = puddingMetrics(shape);
  const speedRatio = config.amplitude > 0 ? velocity / (config.amplitude * 4) : 0;
  const lean = Math.max(-1, Math.min(1, speedRatio)) * MAX_LEAN_DEG;
  const squash = Math.min(Math.abs(speedRatio), 1) * MAX_SQUASH;

  // 「ぶるん！」：1（ぺしゃんこ）から 0 へ、行き過ぎながら戻るバネ
  const boing = useRef(new Animated.Value(0)).current;
  const strength = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!bounce) return;
    strength.setValue(bounce.strength);
    boing.setValue(1);
    const anim = Animated.spring(boing, {
      toValue: 0,
      friction: 2.6,
      tension: 140,
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    anim.start();
    return () => anim.stop();
  }, [bounce?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const amount = Animated.multiply(boing, strength);
  const scaleY = amount.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [1.22, 1, 0.66],
    extrapolate: 'clamp',
  });
  const scaleX = amount.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0.86, 1, 1.28],
    extrapolate: 'clamp',
  });

  return (
    <View
      testID="pudding"
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: centerX - m.width / 2,
        top: config.puddingTopY - m.topY,
      }}
    >
      <PuddingArt
        {...shape}
        sepiaAmount={sepiaAmount}
        bodyStyle={{
          transform: [
            { scaleX },
            { scaleY },
            { skewX: `${-lean}deg` },
            { scaleX: 1 + squash },
            { scaleY: 1 - squash },
          ],
        }}
      />
    </View>
  );
}
