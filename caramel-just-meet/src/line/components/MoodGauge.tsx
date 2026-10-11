import { StyleSheet, Text, View } from 'react-native';

import { MOOD_MAX, RAGE_SECONDS } from '../engine';
import { emojiText, lineColors } from '../theme';

/** イライラ度に応じた上司の顔 */
export function moodFace(mood: number, rage: boolean): string {
  if (rage) return '🤬';
  if (mood >= 80) return '😡';
  if (mood >= 60) return '😠';
  if (mood >= 40) return '😤';
  if (mood >= 20) return '😐';
  return '😊';
}

/** イライラ度に応じたゲージの色（緑 → 黄 → 橙 → 赤） */
export function moodColor(mood: number): string {
  if (mood >= 80) return '#FF1E3C';
  if (mood >= 55) return '#FF8A1A';
  if (mood >= 30) return '#FFD23F';
  return '#3FD46A';
}

interface Props {
  mood: number;
  /** ブチギレの残り秒数（0 なら通常） */
  rage: number;
  /** 0〜1 の明滅（ブチギレ中にゲージを点滅させる） */
  blink: number;
}

/** 画面上部の「上司のイライラ度」ゲージ */
export function MoodGauge({ mood, rage, blink }: Props) {
  const raging = rage > 0;
  const pct = raging ? 100 : Math.round(Math.min(MOOD_MAX, Math.max(0, mood)));
  // ブチギレ中は残り時間に合わせてゲージが減っていく（あと何秒耐えればいいか分かるように）
  const fill = raging ? (rage / RAGE_SECONDS) * 100 : pct;
  const color = raging ? (blink > 0.5 ? '#FFFFFF' : lineColors.danger) : moodColor(pct);
  return (
    <View
      style={[styles.root, raging && styles.rootRage]}
      testID="mood-gauge"
      accessibilityRole="progressbar"
      accessibilityLabel={`上司のイライラ度 ${pct}%`}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
    >
      <Text style={[emojiText, styles.face]}>{moodFace(pct, raging)}</Text>
      <View style={styles.body}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, raging && styles.labelRage]}>
            {raging ? `ブチギレ中！あと ${rage.toFixed(1)} 秒耐えろ` : '上司のイライラ度'}
          </Text>
          <Text testID="mood-value" style={[styles.value, raging && styles.labelRage]}>
            {pct}%
          </Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${fill}%`, backgroundColor: color }]} />
          {/* 目盛り（25% ごと） */}
          {[25, 50, 75].map((p) => (
            <View key={p} style={[styles.tick, { left: `${p}%` }]} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(20,30,60,0.72)',
    gap: 6,
  },
  rootRage: { backgroundColor: 'rgba(120,0,20,0.9)' },
  face: { fontSize: 26, lineHeight: 34 },
  body: { flex: 1 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  labelRage: { color: '#FFE600' },
  value: { fontSize: 15, fontWeight: '900', color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  track: {
    marginTop: 3,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  fill: { height: '100%', borderRadius: 6 },
  tick: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.45)' },
});
