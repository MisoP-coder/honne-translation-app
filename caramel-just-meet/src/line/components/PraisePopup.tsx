import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import { impactFor, rainbowColor } from '../../components/ComboPopup';
import { OutlinedText } from '../../components/OutlinedText';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

interface Props {
  /** id が変わるたびに新しく飛び出す */
  praise: { id: number; text: string; combo: number } | null;
  y: number;
  width: number;
  time: number;
}

/** ほめ言葉の文字の大きさ。画面からはみ出さないように抑える */
export function praiseFontSize(text: string, combo: number, maxWidth: number): number {
  const wanted = 34 + Math.min(combo, 20) * 1.2;
  const fitting = (maxWidth - 24) / Math.max(1, Array.from(text).length);
  return Math.max(18, Math.min(wanted, fitting));
}

/**
 * 連続キャッチで「タイパ最高！」「有能！」が画面の奥から手前にドーン！と飛び出し、
 * バウンドして着地、最後はこちらに飛んでくるように拡大しながら消える。
 */
export function PraisePopup({ praise, y, width, time }: Props) {
  const zoom = useRef(new Animated.Value(0)).current;
  const drop = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!praise) return;
    const impact = impactFor(praise.combo + 2);
    zoom.setValue(0);
    drop.setValue(-70 - impact * 70);
    opacity.setValue(1);
    const anim = Animated.parallel([
      Animated.spring(drop, { toValue: 0, friction: 3.4 - impact, tension: 190, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.sequence([
        Animated.timing(zoom, { toValue: 1.5 + impact * 0.6, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(zoom, { toValue: 1, friction: 4.6, tension: 220, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.delay(420),
        Animated.parallel([
          Animated.timing(zoom, { toValue: 2.6, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: USE_NATIVE_DRIVER }),
        ]),
      ]),
    ]);
    anim.start();
    return () => anim.stop();
  }, [praise?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!praise) return null;
  const fontSize = praiseFontSize(praise.text, praise.combo, width - 40);
  const rainbow = praise.combo >= 10;
  const rotate = zoom.interpolate({ inputRange: [0, 1, 2.6], outputRange: ['-20deg', '-6deg', '-2deg'] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.root, { top: y - fontSize, opacity, transform: [{ translateY: drop }, { scale: zoom }, { rotate }] }]}
    >
      <OutlinedText
        testID="praise-popup"
        numberOfLines={1}
        fill={rainbow ? rainbowColor(time, 0, 62) : '#FFE600'}
        shadow={rainbow ? rainbowColor(time, 180, 30) : '#D0002A'}
        outlineWidth={4}
        depth={6}
        style={{ ...styles.text, fontSize }}
      >
        {praise.text}
      </OutlinedText>
      <View style={styles.comboRow}>
        <OutlinedText fill="#FFFFFF" shadow="#06C755" outlineWidth={3} depth={3} style={styles.combo}>
          {`${praise.combo} COMBO!!`}
        </OutlinedText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  text: { fontWeight: '900', fontStyle: 'italic', textAlign: 'center' },
  comboRow: { marginTop: 2 },
  combo: { fontSize: 20, fontWeight: '900', fontStyle: 'italic', letterSpacing: 1 },
});
