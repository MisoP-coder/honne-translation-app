import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text } from 'react-native';

import type { JudgeEvent } from '../game/engine';
import { colors } from '../theme/colors';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

const LABELS = {
  perfect: 'JUST MEET!!',
  good: 'GOOD',
  miss: 'ずるっ…',
} as const;

interface Props {
  event: JudgeEvent | null;
  x: number;
  y: number;
}

/** 判定が出るたびにポンッと飛び出して消える文字 */
export function JudgePopup({ event, x, y }: Props) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!event) return;
    scale.setValue(0.3);
    opacity.setValue(1);
    rise.setValue(0);
    const anim = Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(rise, { toValue: -40, duration: 700, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.sequence([
        Animated.delay(450),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    ]);
    anim.start();
    return () => anim.stop();
  }, [event?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!event) return null;
  const color = colors[event.judge];
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.root,
        { left: x - 120, top: y - 90, opacity, transform: [{ translateY: rise }, { scale }] },
      ]}
    >
      <Text testID="judge-label" style={[styles.label, { color }]}>
        {LABELS[event.judge]}
      </Text>
      {event.judge !== 'miss' && (
        <Text style={[styles.points, { color }]}>+{event.points}</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', width: 240, alignItems: 'center' },
  label: {
    fontSize: 30,
    fontWeight: '900',
    textShadowColor: '#FFFFFF',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 0 },
  },
  points: { fontSize: 16, fontWeight: '800' },
});
