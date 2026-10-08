import { useRef, useState } from 'react';
import { type GestureResponderEvent, StyleSheet, Text, View } from 'react-native';

import { VOLUME_STEPS } from '../audio/settings';
import { colors } from '../theme/colors';

interface Props {
  /** 0〜1 */
  value: number;
  onChange: (value: number) => void;
  /** 指を離したとき（効果音の試し鳴らしに使う） */
  onRelease?: (value: number) => void;
  disabled?: boolean;
  label: string;
  testID?: string;
}

/** 位置（0〜幅）から 0〜1 の音量（0.1 刻み）を求める */
export function volumeAt(x: number, width: number): number {
  if (width <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, x / width));
  return Math.round(ratio * VOLUME_STEPS) / VOLUME_STEPS;
}

/**
 * ゲームっぽいブロック型の音量ゲージ。タップした位置、またはなぞった位置の音量になる。
 * スクリーンリーダーでは上下のスワイプで 1 目盛りずつ変えられる。
 */
export function VolumeBar({ value, onChange, onRelease, disabled = false, label, testID }: Props) {
  const [width, setWidth] = useState(0);
  const last = useRef(value);
  const level = Math.round(value * VOLUME_STEPS);

  const set = (v: number) => {
    last.current = v;
    if (v !== value) onChange(v);
  };
  const fromEvent = (e: GestureResponderEvent) => set(volumeAt(e.nativeEvent.locationX, width));

  return (
    <View style={styles.row}>
      <View
        testID={testID}
        style={[styles.track, disabled && styles.disabled]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => !disabled}
        onMoveShouldSetResponder={() => !disabled}
        onResponderGrant={fromEvent}
        onResponderMove={fromEvent}
        onResponderRelease={() => onRelease?.(last.current)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100), text: `${Math.round(value * 100)}%` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const step = e.nativeEvent.actionName === 'increment' ? 1 : -1;
          const next = Math.min(VOLUME_STEPS, Math.max(0, level + step)) / VOLUME_STEPS;
          set(next);
          onRelease?.(next);
        }}
      >
        {Array.from({ length: VOLUME_STEPS }, (_, i) => (
          <View
            key={i}
            pointerEvents="none"
            style={[
              styles.block,
              { height: 10 + i * 1.6 },
              i < level ? styles.blockOn : styles.blockOff,
            ]}
          />
        ))}
      </View>
      <Text style={[styles.value, disabled && styles.valueDisabled]}>{Math.round(value * 100)}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: {
    flex: 1,
    height: 36,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    paddingVertical: 4,
  },
  disabled: { opacity: 0.35 },
  block: { flex: 1, borderRadius: 3 },
  blockOn: { backgroundColor: colors.accent },
  blockOff: { backgroundColor: colors.backgroundDeep },
  value: {
    width: 46,
    textAlign: 'right',
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  valueDisabled: { color: colors.textSub },
});
