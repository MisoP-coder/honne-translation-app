import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';

import type { Judge, JudgeEvent } from '../game/engine';
import { useJitter } from '../hooks/useJitter';
import { OutlinedText } from './OutlinedText';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

const LABELS = {
  perfect: 'JUST MEET!!',
  good: 'GOOD!',
  miss: 'ずるっ…',
} as const;

/** 判定ごとの文字の色（本体・立体の影） */
export const JUDGE_COLORS: Record<Judge, { fill: string; shadow: string; size: number }> = {
  perfect: { fill: '#FFE600', shadow: '#D0002A', size: 40 },
  good: { fill: '#7CFF4F', shadow: '#0A6B00', size: 34 },
  miss: { fill: '#F2F2F2', shadow: '#3A3A3A', size: 44 },
};

interface Props {
  event: JudgeEvent | null;
  x: number;
  y: number;
}

/**
 * 判定の文字。成功はポンッと飛び出して消え、
 * ミスの「ずるっ…」はその場に残ってガタガタ震え続ける。
 */
export function JudgePopup({ event, x, y }: Props) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const isMiss = event?.judge === 'miss';
  const jitter = useJitter(isMiss, 5, 200);

  useEffect(() => {
    if (!event) return;
    scale.setValue(isMiss ? 2.4 : 0.3);
    opacity.setValue(1);
    rise.setValue(0);
    const anim = isMiss
      ? // ミス：上からドスンと落ちてきて、そのまま居座る
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: USE_NATIVE_DRIVER })
      : Animated.parallel([
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
  const c = JUDGE_COLORS[event.judge];
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.root,
        {
          left: x - 160,
          top: y - (isMiss ? 130 : 100),
          opacity,
          transform: [{ translateY: rise }, { scale }, ...(isMiss ? jitter : [])],
        },
      ]}
    >
      <OutlinedText
        testID="judge-label"
        fill={c.fill}
        shadow={c.shadow}
        outlineWidth={3}
        depth={4}
        style={{ ...styles.label, fontSize: c.size }}
      >
        {LABELS[event.judge]}
      </OutlinedText>
      {!isMiss && (
        <OutlinedText fill="#FFFFFF" shadow={c.shadow} outlineWidth={2} depth={2} style={styles.points}>
          +{event.points}
        </OutlinedText>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', width: 320, alignItems: 'center' },
  label: { fontWeight: '900', fontStyle: 'italic', textAlign: 'center' },
  points: { fontSize: 20, fontWeight: '900', textAlign: 'center' },
});
