import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { OutlinedText } from '../../components/OutlinedText';
import { type GameOverReason, lineTitleFor } from '../engine';
import { emojiText, lineColors } from '../theme';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

interface Props {
  reason: GameOverReason;
  score: number;
  maxCombo: number;
  caught: number;
  bestScore: number;
  isNewRecord: boolean;
  onRetry: () => void;
  onTitle: () => void;
}

export function gameOverMessage(reason: GameOverReason): string {
  return reason === 'phone'
    ? '「今すぐ電話しろ‼️」を受け止めてしまった…'
    : 'おじさん構文を3回まともに読んでしまった…';
}

/** ゲームオーバー：上司からの着信画面（拒否＝もう一回、応答＝タイトルへ） */
export function IncomingCall({ reason, score, maxCombo, caught, bestScore, isNewRecord, onRetry, onTitle }: Props) {
  const ring = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anims = [
      Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER })),
      // 着信のバイブのように、ブルブル震えては止まる
      Animated.loop(
        Animated.sequence([
          ...[1, -1, 1, -1, 1, -1, 0].map((v) =>
            Animated.timing(shake, { toValue: v, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
          ),
          Animated.delay(650),
        ]),
      ),
      Animated.spring(appear, { toValue: 1, friction: 6, tension: 80, useNativeDriver: USE_NATIVE_DRIVER }),
    ];
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [ring, shake, appear]);

  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });
  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] });
  const slideUp = appear.interpolate({ inputRange: [0, 1], outputRange: [60, 0] });

  return (
    <View style={styles.root} testID="incoming-call">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.status}>音声通話 ・ 着信中…</Text>
        <View style={styles.avatarWrap}>
          <Animated.View style={[styles.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />
          <Animated.View style={[styles.avatar, { transform: [{ translateX: shakeX }] }]}>
            <Text style={[emojiText, styles.avatarFace]}>👴</Text>
          </Animated.View>
        </View>
        <Text style={styles.caller}>上司（部長）</Text>
        <Text style={[emojiText, styles.callerSub]}>📞 着信中… 出るまで鳴らし続けます😡</Text>

        <Animated.View style={[styles.card, { opacity: appear, transform: [{ translateY: slideUp }] }]}>
          <OutlinedText fill="#FFFFFF" shadow="#8A0016" outlineWidth={2} depth={3} style={styles.gameOver}>
            GAME OVER
          </OutlinedText>
          <Text style={[emojiText, styles.reason]} testID="gameover-reason">
            {gameOverMessage(reason)}
          </Text>
          {isNewRecord && <Text style={styles.newRecord}>★ NEW RECORD ★</Text>}
          <View style={styles.row}>
            <Text style={styles.key}>スコア</Text>
            <Text style={styles.value} testID="line-result-score">
              {score}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.key}>要約した結論</Text>
            <Text style={styles.value}>{caught} 個</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.key}>最高コンボ</Text>
            <Text style={styles.value}>{maxCombo}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.key}>ハイスコア</Text>
            <Text style={styles.value}>{Math.max(score, bestScore)}</Text>
          </View>
          <Text style={styles.title} testID="line-result-title">
            称号：{lineTitleFor(score)}
          </Text>
        </Animated.View>

        <View style={styles.buttons}>
          <CallButton testID="line-retry" color={lineColors.danger} icon="📵" label={'拒否して\nもう一回'} onPress={onRetry} />
          <CallButton testID="line-to-title" color={lineColors.green} icon="📞" label={'応答して\nタイトルへ'} onPress={onTitle} />
        </View>
      </ScrollView>
    </View>
  );
}

function CallButton({ color, icon, label, onPress, testID }: { color: string; icon: string; label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label.replace('\n', '')} onPress={onPress} style={styles.callButton}>
      {({ pressed }) => (
        <>
          <View style={[styles.callCircle, { backgroundColor: color, opacity: pressed ? 0.7 : 1 }]}>
            <Text style={[emojiText, styles.callIcon]}>{icon}</Text>
          </View>
          <Text style={styles.callLabel}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: '#101820', zIndex: 10 },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24, paddingHorizontal: 20 },
  status: { color: '#9FB3C8', fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  avatarWrap: { marginTop: 18, width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 110, height: 110, borderRadius: 55, borderWidth: 4, borderColor: lineColors.green },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#3A4A5A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarFace: { fontSize: 62, lineHeight: 76 },
  caller: { marginTop: 12, color: '#FFFFFF', fontSize: 28, fontWeight: '900' },
  callerSub: { marginTop: 4, color: '#C8D6E5', fontSize: 13, fontWeight: '700' },
  card: {
    marginTop: 18,
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  gameOver: { fontSize: 30, fontWeight: '900', fontStyle: 'italic', letterSpacing: 2 },
  reason: { marginTop: 6, color: '#FFB3BF', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  newRecord: { marginTop: 6, color: '#FFE600', fontSize: 16, fontWeight: '900' },
  row: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 6 },
  key: { color: '#C8D6E5', fontSize: 14, fontWeight: '700' },
  value: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },
  title: { marginTop: 10, color: '#FFE600', fontSize: 15, fontWeight: '900' },
  buttons: { marginTop: 22, flexDirection: 'row', gap: 56 },
  callButton: { alignItems: 'center' },
  callCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  callIcon: { fontSize: 32, lineHeight: 42 },
  callLabel: { marginTop: 6, color: '#FFFFFF', fontSize: 13, fontWeight: '800', textAlign: 'center', lineHeight: 18 },
});
