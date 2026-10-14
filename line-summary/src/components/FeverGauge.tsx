import { StyleSheet, Text, View } from 'react-native';

import { FEVER_SECONDS } from '../game/engine';
import { emojiText } from '../theme';
import { rainbowColor } from './PraisePopup';

interface Props {
  /** 神要約ゲージ（0〜100） */
  fever: number;
  /** 神要約タイムの残り秒数（0 なら通常） */
  feverTime: number;
  time: number;
}

/** 画面上部の「神要約ゲージ」。満タンで神要約タイム */
export function FeverGauge({ fever, feverTime, time }: Props) {
  const active = feverTime > 0;
  const fill = active ? (feverTime / FEVER_SECONDS) * 100 : Math.min(100, Math.max(0, fever));
  const ready = !active && fever >= 100;
  return (
    <View style={[styles.root, active && styles.rootActive]} testID="fever-gauge">
      <Text style={[emojiText, styles.label, active && styles.labelActive]} numberOfLines={1}>
        {active ? `✨神要約タイム！ あと ${feverTime.toFixed(1)} 秒` : ready ? '✨神要約ゲージ MAX！ブチギレ明けに発動' : '✨神要約ゲージ'}
      </Text>
      <View style={styles.track}>
        <View
          testID="fever-fill"
          style={[styles.fill, { width: `${fill}%`, backgroundColor: active ? rainbowColor(time, 40, 55) : '#FFD23F' }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 10,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(20,30,60,0.55)',
  },
  rootActive: { backgroundColor: 'rgba(120,70,0,0.85)' },
  label: { fontSize: 11, lineHeight: 16, fontWeight: '900', color: '#FFE9A0', flexShrink: 1 },
  labelActive: { color: '#FFFFFF' },
  track: {
    flex: 1,
    minWidth: 60,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 4 },
});
