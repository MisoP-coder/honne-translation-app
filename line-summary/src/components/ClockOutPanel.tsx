import { useEffect, useRef } from 'react';
import { Animated, Easing, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { lineTitleFor } from '../game/engine';
import { type ShareResult, shareUrl } from '../share';
import { GameButton } from '../shared/components/GameButton';
import { OutlinedText } from '../shared/components/OutlinedText';
import { emojiText, lineColors } from '../theme';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

interface Props {
  score: number;
  clearBonus: number;
  caught: number;
  fakesDodged: number;
  maxCombo: number;
  lives: number;
  feverCount: number;
  quickReads: number;
  rares: number;
  bestScore: number;
  isNewRecord: boolean;
  onRetry: () => void;
  onTitle: () => void;
}

/** 18:00 まで耐えきった：定時退社の画面 */
export function ClockOutPanel(p: Props) {
  const stamp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 「退勤」のハンコが、ドンッと押される
    const anim = Animated.sequence([
      Animated.delay(250),
      Animated.timing(stamp, { toValue: 1, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [stamp]);

  const stampScale = stamp.interpolate({ inputRange: [0, 1], outputRange: [3, 1] });
  const share: ShareResult = {
    cleared: true,
    score: p.score,
    caught: p.caught,
    fakesDodged: p.fakesDodged,
    clock: '18:00',
    feverCount: p.feverCount,
  };
  const url = shareUrl(share);

  return (
    <View style={styles.root} testID="clock-out">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.clock}>18:00</Text>
        <OutlinedText fill="#FFE600" shadow="#D0002A" outlineWidth={4} depth={6} style={styles.title}>
          定時退社！
        </OutlinedText>
        <Text style={[emojiText, styles.sub]}>上司の長文LINEを、今日も読まずに要約しきった🎉</Text>

        <View style={styles.card}>
          <Animated.View style={[styles.stamp, { opacity: stamp, transform: [{ scale: stampScale }, { rotate: '-14deg' }] }]}>
            <Text style={styles.stampText}>退勤</Text>
          </Animated.View>
          {p.isNewRecord && <Text style={styles.newRecord}>★ NEW RECORD ★</Text>}
          <Row label="スコア" value={String(p.score)} testID="clear-score" />
          <Row label="　うち定時ボーナス" value={`+${p.clearBonus}`} />
          <Row label="要約した結論" value={`${p.caught} 件`} />
          <Row label="見抜いたひっかけ" value={`${p.fakesDodged} 件`} />
          <Row label="即読（×2以上）" value={`${p.quickReads} 回`} />
          <Row label="神要約タイム" value={`${p.feverCount} 回`} />
          <Row label="レアLINE" value={`${p.rares} 件`} />
          <Row label="最高コンボ" value={String(p.maxCombo)} />
          <Row label="ハイスコア" value={String(Math.max(p.score, p.bestScore))} />
          <Text style={styles.rank}>称号：{lineTitleFor(p.score)}</Text>
        </View>

        <View style={styles.buttons}>
          <GameButton testID="clear-retry" label="明日も出社する" onPress={p.onRetry} style={styles.retry} />
          <GameButton
            testID="clear-share"
            label="𝕏 で定時退社を自慢する"
            variant="x"
            href={url}
            onPress={() => void Linking.openURL(url).catch(() => {})}
          />
          <GameButton testID="clear-title" label="タイトルへ" variant="secondary" onPress={p.onTitle} />
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.key}>{label}</Text>
      <Text style={styles.value} testID={testID}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: lineColors.green, zIndex: 10 },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24, paddingHorizontal: 20 },
  clock: { fontSize: 44, fontWeight: '900', color: '#FFFFFF', fontVariant: ['tabular-nums'], letterSpacing: 2 },
  title: { fontSize: 50, lineHeight: 64, fontWeight: '900', fontStyle: 'italic', textAlign: 'center' },
  sub: { marginTop: 4, fontSize: 14, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  card: {
    marginTop: 16,
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 3,
    borderColor: lineColors.greenDeep,
  },
  stamp: {
    position: 'absolute',
    right: 14,
    top: 10,
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: '#D0002A',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stampText: { fontSize: 24, fontWeight: '900', color: '#D0002A' },
  newRecord: { color: '#D0002A', fontSize: 15, fontWeight: '900', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, paddingRight: 70 },
  key: { fontSize: 14, fontWeight: '700', color: lineColors.text },
  value: { fontSize: 17, fontWeight: '900', color: lineColors.text, fontVariant: ['tabular-nums'] },
  rank: { marginTop: 8, fontSize: 15, fontWeight: '900', color: '#B86E00' },
  buttons: { marginTop: 18, gap: 10, alignItems: 'center' },
  retry: { backgroundColor: '#D0002A' },
});
