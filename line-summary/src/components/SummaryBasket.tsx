import { StyleSheet, Text, View } from 'react-native';

import type { LineConfig } from '../game/engine';
import { emojiText, lineColors } from '../theme';

interface Props {
  config: LineConfig;
  x: number;
  /** キャッチした直後（緑に光る）・当たった直後（赤くなる） */
  flash: 'catch' | 'hit' | null;
}

/** 画面下の「要約カゴ」 */
export function SummaryBasket({ config, x, flash }: Props) {
  const scale = flash === 'catch' ? 1.08 : 1;
  return (
    <View
      testID="summary-basket"
      pointerEvents="none"
      style={[
        styles.root,
        {
          left: x - config.basketWidth / 2,
          top: config.basketTop,
          width: config.basketWidth,
          height: config.basketHeight,
          transform: [{ scaleX: scale }, { scaleY: flash === 'catch' ? 0.92 : 1 }],
        },
        flash === 'catch' && styles.catch,
        flash === 'hit' && styles.hit,
      ]}
    >
      <Text style={[emojiText, styles.icon]}>{flash === 'hit' ? '💢' : '🧺'}</Text>
      <View>
        <Text style={styles.label}>要約</Text>
        <Text style={styles.sub}>カゴ</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 14,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: lineColors.green,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderBottomWidth: 7,
    borderBottomColor: lineColors.greenDeep,
  },
  catch: { backgroundColor: '#3CF08A', borderColor: '#FFE600' },
  hit: { backgroundColor: lineColors.danger, borderBottomColor: lineColors.dangerDeep },
  icon: { fontSize: 22, lineHeight: 30 },
  label: { fontSize: 16, lineHeight: 18, fontWeight: '900', color: '#FFFFFF', letterSpacing: 2 },
  sub: { fontSize: 10, lineHeight: 12, fontWeight: '800', color: '#E8FFEE', textAlign: 'center' },
});
