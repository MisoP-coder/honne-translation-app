import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

import { GameButton } from '../components/GameButton';
import { titleFor } from '../game/titles';
import type { HighScore } from '../storage/highScore';
import { colors } from '../theme/colors';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

interface Props {
  highScore: HighScore;
  onStart: () => void;
  onRanking: () => void;
}

export function TitleScreen({ highScore, onStart, onRanking }: Props) {
  const wobble = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wobble, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(wobble, { toValue: -1, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(wobble, { toValue: 0, duration: 380, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [wobble]);

  const translateX = wobble.interpolate({ inputRange: [-1, 1], outputRange: [-14, 14] });
  const skewX = wobble.interpolate({ inputRange: [-1, 1], outputRange: ['6deg', '-6deg'] });

  return (
    <View style={styles.root}>
      <Text style={styles.kicker}>極限！</Text>
      <Text style={styles.title}>カラメル・{'\n'}ジャスト・ミート</Text>

      <Animated.View style={[styles.pudding, { transform: [{ translateX }, { skewX }] }]}>
        <View style={styles.cap} />
        <View style={styles.body} />
        <View style={styles.plate} />
      </Animated.View>

      <Text style={styles.howto}>
        ぷるぷる揺れるプリンの頂点に{'\n'}タップでカラメルを落とせ！{'\n'}ズレたら即ゲームオーバー
      </Text>

      <View style={styles.best}>
        <Text style={styles.bestText} testID="title-best">
          ハイスコア {highScore.bestScore} ／ 最高 {highScore.bestCombo} 連続
        </Text>
        {highScore.bestCombo > 0 && (
          <Text style={styles.bestTitle}>称号：{titleFor(highScore.bestCombo)}</Text>
        )}
      </View>

      <View style={styles.buttons}>
        <GameButton testID="start" label="スタート" onPress={onStart} />
        <GameButton testID="open-ranking" label="世界ランキング" variant="secondary" onPress={onRanking} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  kicker: { fontSize: 22, fontWeight: '900', color: colors.accent, letterSpacing: 4 },
  title: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '900',
    color: colors.caramel,
    textAlign: 'center',
  },
  pudding: { marginTop: 28, marginBottom: 20, alignItems: 'center' },
  cap: { width: 92, height: 22, borderRadius: 46, backgroundColor: colors.caramel, marginBottom: -11, zIndex: 1 },
  body: {
    width: 128,
    height: 0,
    borderLeftWidth: 20,
    borderRightWidth: 20,
    borderBottomWidth: 86,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.pudding,
  },
  plate: {
    width: 170,
    height: 16,
    borderRadius: 85,
    backgroundColor: colors.plate,
    borderWidth: 2,
    borderColor: colors.plateShadow,
    marginTop: -6,
  },
  howto: { fontSize: 15, lineHeight: 22, color: colors.text, textAlign: 'center', fontWeight: '600' },
  best: { marginTop: 16, alignItems: 'center' },
  bestText: { fontSize: 14, color: colors.textSub, fontWeight: '700' },
  bestTitle: { fontSize: 13, color: colors.textSub, marginTop: 2 },
  buttons: { marginTop: 24, gap: 12 },
});
