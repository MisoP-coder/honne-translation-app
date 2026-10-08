import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text } from 'react-native';

import type { JudgeEvent } from '../game/engine';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** 太字イタリックの英数字1文字あたりの幅（フォントサイズに対する比率の目安） */
const CHAR_WIDTH = 0.72;

/** コンボ数に応じた色と大きさ。画面からはみ出さない大きさに抑える */
export function comboStyle(
  combo: number,
  maxWidth = Infinity,
): { color: string; outline: string; fontSize: number } {
  const fitting = maxWidth / (comboLabel(combo).length * CHAR_WIDTH);
  const fontSize = Math.min(36 + Math.min(combo, 30) * 1.2, fitting);
  if (combo >= 20) return { color: '#FF3DB8', outline: '#3A0030', fontSize };
  if (combo >= 10) return { color: '#FFD700', outline: '#7A1F00', fontSize };
  if (combo >= 5) return { color: '#FF7A1A', outline: '#5A1A00', fontSize };
  return { color: '#FFFFFF', outline: '#8A4512', fontSize };
}

export function comboLabel(combo: number): string {
  return `${combo} COMBO!!`;
}

interface Props {
  event: JudgeEvent | null;
  /** 表示する位置（中央の y） */
  y: number;
  /** 画面の幅（文字がはみ出さないように使う） */
  width: number;
}

/** 連続成功時に画面中央に大きく「〇〇 COMBO!!」をポップに出す */
export function ComboPopup({ event, y, width }: Props) {
  const pop = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const show = event !== null && event.judge !== 'miss' && event.combo >= 2;

  useEffect(() => {
    if (!show) return;
    pop.setValue(0);
    opacity.setValue(1);
    const anim = Animated.parallel([
      Animated.spring(pop, { toValue: 1, friction: 3.5, tension: 180, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.sequence([
        Animated.delay(650),
        Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    ]);
    anim.start();
    return () => anim.stop();
  }, [event?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!show || !event) return null;
  // 傾けて拡大しても収まるよう、左右に余白をとる
  const s = comboStyle(event.combo, width - 80);
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const rotate = pop.interpolate({ inputRange: [0, 1], outputRange: ['-14deg', '-6deg'] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.root, { top: y - s.fontSize, opacity, transform: [{ scale }, { rotate }] }]}
    >
      <Text
        testID="combo-popup"
        numberOfLines={1}
        style={[
          styles.text,
          { fontSize: s.fontSize, color: s.color, textShadowColor: s.outline },
        ]}
      >
        {comboLabel(event.combo)}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  text: {
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 1,
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 1,
  },
});
