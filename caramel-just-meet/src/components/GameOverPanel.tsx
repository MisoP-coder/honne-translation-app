import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';

import { titleFor } from '../game/titles';
import { colors } from '../theme/colors';
import { useJitter } from '../hooks/useJitter';
import { GameButton } from './GameButton';
import { OutlinedText } from './OutlinedText';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

interface Props {
  score: number;
  combo: number;
  perfectCount: number;
  bestScore: number;
  isNewRecord: boolean;
  onShare: () => void;
  onRetry: () => void;
  onRanking: () => void;
  onTitle: () => void;
}

export function GameOverPanel({
  score,
  combo,
  perfectCount,
  bestScore,
  isNewRecord,
  onShare,
  onRetry,
  onRanking,
  onTitle,
}: Props) {
  const enter = useRef(new Animated.Value(0)).current;
  const jitter = useJitter(true, 3.5, 220);

  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1,
      friction: 6,
      tension: 70,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [enter]);

  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [300, 0] });

  return (
    <View style={styles.backdrop} testID="game-over">
      <Animated.View style={[styles.card, { opacity: enter, transform: [{ translateY }] }]}>
        {/* 絶望感：ガタガタ震える GAME OVER */}
        <Animated.View style={{ transform: jitter }}>
          <OutlinedText fill="#E60012" shadow="#2A0000" outlineWidth={3} depth={5} style={styles.heading}>
            GAME OVER
          </OutlinedText>
        </Animated.View>
        <Text style={styles.sub}>カラメルが滑り落ちた…</Text>

        <View style={styles.resultRow}>
          <View style={styles.resultBox}>
            <Text style={styles.resultLabel}>連続</Text>
            <Text style={styles.resultValue} testID="result-combo">
              {combo}
            </Text>
          </View>
          <View style={styles.resultBox}>
            <Text style={styles.resultLabel}>スコア</Text>
            <Text style={styles.resultValue} testID="result-score">
              {score}
            </Text>
          </View>
        </View>
        <Text style={styles.detail}>
          JUST MEET {perfectCount}回 ／ ハイスコア {bestScore}
        </Text>
        {isNewRecord && <Text style={styles.newRecord}>★ NEW RECORD ★</Text>}

        <Text style={styles.titleLabel}>称号</Text>
        <Text style={styles.title} testID="result-title">
          {titleFor(combo)}
        </Text>

        <View style={styles.buttons}>
          <GameButton testID="share-x" label="𝕏 でシェア" variant="x" onPress={onShare} />
          <GameButton testID="retry" label="もう一回" onPress={onRetry} />
          <GameButton testID="to-ranking" label="世界ランキング" variant="secondary" onPress={onRanking} />
          <GameButton testID="to-title" label="タイトルへ" variant="secondary" onPress={onTitle} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(60,30,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  heading: { fontSize: 38, fontWeight: '900', fontStyle: 'italic', letterSpacing: 2 },
  sub: { fontSize: 14, color: colors.textSub, marginTop: 2 },
  resultRow: { flexDirection: 'row', gap: 16, marginTop: 16 },
  resultBox: {
    minWidth: 110,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingVertical: 10,
  },
  resultLabel: { fontSize: 13, color: colors.textSub, fontWeight: '700' },
  resultValue: { fontSize: 32, color: colors.text, fontWeight: '900' },
  detail: { marginTop: 10, fontSize: 13, color: colors.textSub },
  newRecord: { marginTop: 6, fontSize: 16, fontWeight: '900', color: colors.accent },
  titleLabel: { marginTop: 14, fontSize: 13, color: colors.textSub, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '900', color: colors.text, textAlign: 'center' },
  buttons: { marginTop: 18, gap: 10, alignItems: 'center' },
});
