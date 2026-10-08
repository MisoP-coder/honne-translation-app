import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform } from 'react-native';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** ガタガタ震えるときの位置と傾き（x, y, 角度）。不規則に見えるよう手で並べている */
const KEYS: readonly [number, number, number][] = [
  [0, 0, 0],
  [-1, 0.6, -1],
  [0.8, -0.9, 1.2],
  [-0.4, 1, 0.4],
  [1, 0.3, -1.4],
  [-0.9, -0.7, 0.9],
  [0.5, 0.9, -0.6],
  [-0.7, -0.2, 1],
  [0, 0, 0],
];

/**
 * 文字をガタガタと激しく震わせる transform を返す。
 * amplitude は px、active が false のときは止まる。
 */
export function useJitter(active: boolean, amplitude = 4, period = 260) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      t.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: period,
        easing: Easing.linear,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, period, t]);

  const inputRange = KEYS.map((_, i) => i / (KEYS.length - 1));
  return [
    { translateX: t.interpolate({ inputRange, outputRange: KEYS.map(([x]) => x * amplitude) }) },
    { translateY: t.interpolate({ inputRange, outputRange: KEYS.map(([, y]) => y * amplitude) }) },
    { rotate: t.interpolate({ inputRange, outputRange: KEYS.map(([, , r]) => `${r * amplitude * 0.8}deg`) }) },
  ];
}
