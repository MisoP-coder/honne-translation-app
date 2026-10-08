import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { useBgm, useSound } from '../audio/SoundContext';

import { GameButton } from '../components/GameButton';
import { OutlinedText } from '../components/OutlinedText';
import { PuddingArt } from '../components/PuddingArt';
import { SoundSettingsPanel } from '../components/SoundSettingsPanel';
import { titleFor } from '../game/titles';
import type { HighScore } from '../storage/highScore';
import { colors } from '../theme/colors';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** この高さより低い画面では、プリンと文字を小さくして 1 画面に収まりやすくする */
export const COMPACT_HEIGHT = 740;

interface Props {
  highScore: HighScore;
  onStart: () => void;
  onRanking: () => void;
}

export function TitleScreen({ highScore, onStart, onRanking }: Props) {
  const wobble = useRef(new Animated.Value(0)).current;
  const sound = useSound();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const s = sound?.settings;
  const silent = s ? !(s.bgmEnabled && s.bgmVolume > 0) && !(s.seEnabled && s.seVolume > 0) : false;
  // ブラウザ版はアプリの枠（上の黒いバー）のぶん画面が低くなるので、低い画面ではコンパクトにする
  const { height } = useWindowDimensions();
  const compact = height < COMPACT_HEIGHT;
  // 起動したら無駄に壮大な「運命」が流れる
  useBgm('bgm_title');

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

  const translateX = wobble.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });
  const skewX = wobble.interpolate({ inputRange: [-1, 1], outputRange: ['6deg', '-6deg'] });

  return (
    <View style={styles.root}>
      {/* サウンドボタンは上の段に置き、タイトルと重ならないようにする */}
      <View style={styles.topBar}>
        {sound && (
          <Pressable
            testID="sound-settings-open"
            accessibilityRole="button"
            accessibilityLabel="サウンド設定"
            onPress={() => setSettingsOpen(true)}
            style={styles.soundToggle}
          >
            <Text style={styles.soundToggleText}>{silent ? '🔇 サウンド' : '🔊 サウンド'}</Text>
          </Pressable>
        )}
      </View>

      {/* 収まるときは真ん中に、収まらないときはスクロールできるようにする（文字をつぶさない） */}
      <ScrollView
        testID="title-scroll"
        style={styles.scroll}
        contentContainerStyle={[styles.content, compact && styles.contentCompact]}
      >
        <OutlinedText fill="#E8572A" shadow="#5A1A00" outlineWidth={2} depth={3} style={compact ? styles.kickerCompact : styles.kicker}>
          極限！
        </OutlinedText>
        <OutlinedText fill="#FFE600" shadow="#D0002A" outlineWidth={3} depth={5} style={compact ? styles.titleCompact : styles.title}>
          カラメル・{'\n'}ジャスト・ミート
        </OutlinedText>

        <View style={[styles.pudding, compact && styles.puddingCompact]}>
          <PuddingArt
            topHalf={compact ? 46 : 58}
            bottomHalf={compact ? 59 : 74}
            height={compact ? 54 : 70}
            caramelCount={6}
            bodyStyle={{ transform: [{ translateX }, { skewX }] }}
          />
        </View>

        <Text style={[styles.howto, compact && styles.howtoCompact]}>
          ぷるぷる揺れるプリンの頂点に{'\n'}タップでカラメルを落とせ！{'\n'}ズレたら即ゲームオーバー
        </Text>

        <View style={[styles.best, compact && styles.bestCompact]}>
          <Text style={styles.bestText} testID="title-best">
            ハイスコア {highScore.bestScore} ／ 最高 {highScore.bestCombo} 連続
          </Text>
          {highScore.bestCombo > 0 && (
            <Text style={styles.bestTitle}>称号：{titleFor(highScore.bestCombo)}</Text>
          )}
        </View>

        {/* ブラウザは画面に触れるまで音を出させてくれないので、そのことを知らせる */}
        {sound?.needsTapForAudio && s?.bgmEnabled && s.bgmVolume > 0 && (
          <Text testID="tap-for-sound" style={styles.tapHint}>
            🔊 画面をタップすると BGM が流れます
          </Text>
        )}

        <View style={[styles.buttons, compact && styles.buttonsCompact]}>
          <GameButton testID="start" label="スタート" onPress={onStart} />
          <GameButton testID="open-ranking" label="世界ランキング" variant="secondary" onPress={onRanking} />
        </View>
      </ScrollView>
      {settingsOpen && <SoundSettingsPanel onClose={() => setSettingsOpen(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 10,
    minHeight: 48,
  },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  contentCompact: { paddingBottom: 12 },
  // 文字や部品は縮めない（収まらなければスクロールする）
  kicker: { flexShrink: 0, fontSize: 24, fontWeight: '900', fontStyle: 'italic', letterSpacing: 4, textAlign: 'center' },
  kickerCompact: { flexShrink: 0, fontSize: 20, fontWeight: '900', fontStyle: 'italic', letterSpacing: 4, textAlign: 'center' },
  title: {
    flexShrink: 0,
    fontSize: 36,
    lineHeight: 46,
    fontWeight: '900',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  titleCompact: {
    flexShrink: 0,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '900',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  soundToggle: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.caramel,
  },
  soundToggleText: { fontSize: 13, fontWeight: '800', color: colors.caramel },
  pudding: { flexShrink: 0, marginTop: 20, marginBottom: 14, alignItems: 'center' },
  puddingCompact: { marginTop: 8, marginBottom: 6 },
  howto: { flexShrink: 0, fontSize: 15, lineHeight: 22, color: colors.text, textAlign: 'center', fontWeight: '600' },
  howtoCompact: { fontSize: 14, lineHeight: 20 },
  best: { flexShrink: 0, marginTop: 16, alignItems: 'center' },
  bestCompact: { marginTop: 8 },
  bestText: { fontSize: 14, color: colors.textSub, fontWeight: '700' },
  bestTitle: { fontSize: 13, color: colors.textSub, marginTop: 2 },
  buttons: { flexShrink: 0, marginTop: 24, gap: 12 },
  buttonsCompact: { marginTop: 14, gap: 10 },
  tapHint: {
    flexShrink: 0,
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.backgroundDeep,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '800',
    color: colors.caramel,
    textAlign: 'center',
  },
});
