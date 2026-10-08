import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet } from 'react-native';

import type { JudgeEvent } from '../game/engine';
import { OutlinedText } from './OutlinedText';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** 太字イタリックの英数字1文字あたりの幅（フォントサイズに対する比率の目安） */
const CHAR_WIDTH = 0.72;
/** 縁取りと立体の影のぶん、文字の外側に必要な幅 */
const DECORATION = 18;

export interface ComboLook {
  fill: string;
  shadow: string;
  fontSize: number;
  /** 虹色に光らせるか（20コンボ以上） */
  rainbow: boolean;
}

/** コンボ数に応じた色と大きさ。画面からはみ出さない大きさに抑える */
export function comboStyle(combo: number, maxWidth = Infinity): ComboLook {
  const fitting = (maxWidth - DECORATION) / (comboLabel(combo).length * CHAR_WIDTH);
  const fontSize = Math.min(38 + Math.min(combo, 30) * 1.2, fitting);
  if (combo >= 20) return { fill: '#FFFFFF', shadow: '#5A0040', fontSize, rainbow: true };
  if (combo >= 10) return { fill: '#FFE600', shadow: '#D0002A', fontSize, rainbow: false };
  if (combo >= 5) return { fill: '#FF8A1A', shadow: '#6A1500', fontSize, rainbow: false };
  return { fill: '#FFFFFF', shadow: '#E8572A', fontSize, rainbow: false };
}

export function comboLabel(combo: number): string {
  return `${combo} COMBO!!`;
}

/** 「ドーン！」の強さ（0〜1）。コンボが増えるほど大きく、激しく跳ねる */
export function impactFor(combo: number): number {
  return Math.min(Math.max(combo - 2, 0), 28) / 28;
}

/** 虹色（時間で色相が回る） */
export function rainbowColor(time: number, offset = 0, lightness = 60): string {
  const hue = Math.round((time * 540 + offset) % 360);
  return `hsl(${hue}, 100%, ${lightness}%)`;
}

interface Props {
  event: JudgeEvent | null;
  /** 表示する位置（中央の y） */
  y: number;
  /** 画面の幅（文字がはみ出さないように使う） */
  width: number;
  /** 経過時間（虹色の色相を回すのに使う） */
  time: number;
}

/**
 * 連続成功時に画面中央に「〇〇 COMBO!!」を出す。
 * 画面の奥から手前に向かって「ドーン！」と拡大し、バウンドして着地、
 * 最後はこちらに飛んでくるように拡大しながら消える。
 */
export function ComboPopup({ event, y, width, time }: Props) {
  const zoom = useRef(new Animated.Value(0)).current;
  const drop = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const show = event !== null && event.judge !== 'miss' && event.combo >= 2;

  useEffect(() => {
    if (!show || !event) return;
    const impact = impactFor(event.combo);
    const peak = 1.35 + impact * 0.7;
    zoom.setValue(0);
    drop.setValue(-60 - impact * 80);
    opacity.setValue(1);
    // 落下のバウンドは拡大縮小と並行して進める（バウンドが長引いても拡大の流れを止めない）
    const anim = Animated.parallel([
      // ドーン！と落ちてバウンド
      Animated.spring(drop, {
        toValue: 0,
        friction: 3.2 - impact * 1.2,
        tension: 190,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.sequence([
        // 手前にグワッと迫ってから…
        Animated.timing(zoom, {
          toValue: peak,
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        // …跳ね返りは大きく、でも長引かせない（はみ出したままにならないように）
        Animated.spring(zoom, {
          toValue: 1,
          friction: 5.2 - impact * 1.4,
          tension: 220,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.delay(480),
        // こちらに飛んでくるように拡大しながら消える
        Animated.parallel([
          Animated.timing(zoom, { toValue: 2.4, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: USE_NATIVE_DRIVER }),
        ]),
      ]),
    ]);
    anim.start();
    return () => anim.stop();
  }, [event?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!show || !event) return null;
  // 傾けても収まるよう左右に余白をとる（拡大中の一瞬ははみ出してもよい）
  const look = comboStyle(event.combo, width - 64);
  const rotate = zoom.interpolate({
    inputRange: [0, 1, 2.4],
    outputRange: ['-24deg', '-7deg', '-2deg'],
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.root,
        {
          top: y - look.fontSize,
          opacity,
          transform: [{ translateY: drop }, { scale: zoom }, { rotate }],
        },
      ]}
    >
      <OutlinedText
        testID="combo-popup"
        numberOfLines={1}
        fill={look.rainbow ? rainbowColor(time, 0, 62) : look.fill}
        shadow={look.rainbow ? rainbowColor(time, 180, 30) : look.shadow}
        outlineWidth={4}
        depth={6}
        style={{ ...styles.text, fontSize: look.fontSize }}
      >
        {comboLabel(event.combo)}
      </OutlinedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  text: { fontWeight: '900', fontStyle: 'italic', letterSpacing: 1 },
});
