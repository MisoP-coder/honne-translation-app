import { StyleSheet, Text, View } from 'react-native';

import { OutlinedText } from '../shared/components/OutlinedText';
import { RAGE_SECONDS } from '../game/engine';
import { emojiText } from '../theme';

/**
 * 赤い明滅の周期（秒）。光の点滅は 1 秒に 3 回を超えると発作を起こしやすいので、
 * 1 秒に 2.5 回に抑える（それでも十分に激しい）。
 */
export const RAGE_FLASH_PERIOD = 0.4;
/** カットインが画面に出ている秒数 */
export const CUT_IN_SECONDS = 1.7;

/** ブチギレ中の赤い明滅の濃さ（0〜1）。reduceMotion なら点滅させずに一定の赤にする */
export function rageFlashOpacity(elapsed: number, reduceMotion = false): number {
  if (reduceMotion) return 0.28;
  const phase = (elapsed % RAGE_FLASH_PERIOD) / RAGE_FLASH_PERIOD;
  return phase < 0.5 ? 0.5 : 0.14;
}

/** カットインの横位置（画面幅に対する割合）。右から飛び込み、止まり、左へ抜ける */
export function cutInOffset(elapsed: number): number | null {
  if (elapsed < 0 || elapsed > CUT_IN_SECONDS) return null;
  if (elapsed < 0.22) {
    const p = elapsed / 0.22;
    return 1 - (1 - (1 - p) ** 3);
  }
  if (elapsed < CUT_IN_SECONDS - 0.25) return 0;
  const p = (elapsed - (CUT_IN_SECONDS - 0.25)) / 0.25;
  return -(p ** 2);
}

interface Props {
  /** ブチギレの残り秒数 */
  rage: number;
  width: number;
  height: number;
  reduceMotion?: boolean;
}

/** ブチギレ中：画面全体の赤い明滅と、「上司がブチギレた‼️」のカットイン */
export function RageOverlay({ rage, width, height, reduceMotion = false }: Props) {
  if (rage <= 0) return null;
  const elapsed = RAGE_SECONDS - rage;
  const offset = cutInOffset(elapsed);
  // カットインが出ている間は文字をガタガタ揺らす
  const jitter = reduceMotion ? 0 : Math.sin(elapsed * 90) * 3;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="rage-overlay">
      <View style={[StyleSheet.absoluteFill, styles.flash, { opacity: rageFlashOpacity(elapsed, reduceMotion) }]} />
      {/* 画面のふちを赤く */}
      <View style={[StyleSheet.absoluteFill, styles.edge]} />
      {offset !== null && (
        <View
          testID="rage-cut-in"
          style={[
            styles.band,
            { top: height * 0.34, transform: [{ translateX: offset * width }, { rotate: '-6deg' }, { translateY: jitter }] },
          ]}
        >
          <Text style={[emojiText, styles.emoji]}>😡</Text>
          <OutlinedText fill="#FFE600" shadow="#5A0010" outlineWidth={3} depth={4} style={styles.cutText}>
            上司がブチギレた
          </OutlinedText>
          <Text style={[emojiText, styles.emoji]}>‼️</Text>
        </View>
      )}
      {offset !== null && (
        <View style={[styles.subBand, { top: height * 0.34 + 74, transform: [{ translateX: -offset * width }, { rotate: '-6deg' }] }]}>
          <Text style={styles.subText}>落下スピード2倍！「今すぐ電話しろ」は当たると即終了！</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flash: { backgroundColor: '#FF0022' },
  edge: { borderWidth: 6, borderColor: '#FF1E3C' },
  band: {
    position: 'absolute',
    left: -20,
    right: -20,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#14000A',
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#FFE600',
  },
  cutText: { fontSize: 34, lineHeight: 44, fontWeight: '900', fontStyle: 'italic' },
  emoji: { fontSize: 32, lineHeight: 42 },
  subBand: {
    position: 'absolute',
    left: -20,
    right: -20,
    paddingVertical: 4,
    backgroundColor: '#FFE600',
    alignItems: 'center',
  },
  subText: { fontSize: 12, fontWeight: '900', color: '#8A0016' },
});
