import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useBgm, useSound } from '../shared/audio/SoundContext';
import { GameButton } from '../shared/components/GameButton';
import { OutlinedText } from '../shared/components/OutlinedText';
import { SoundSettingsPanel } from '../shared/components/SoundSettingsPanel';
import { HaloBackdrop } from '../components/HaloBackdrop';
import { lineTitleFor } from '../game/engine';
import type { LineHighScore } from '../highScore';
import { CONCLUSION_WORDS } from '../game/texts';
import { emojiText, lineColors } from '../theme';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

interface Props {
  highScore: LineHighScore;
  onStart: () => void;
}

/** 「要約の達人」のタイトル画面。パチンコ風の後光の前に、極太の縁取り文字で大げさに */
export function LineTitleScreen({ highScore, onStart }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const pulse = useRef(new Animated.Value(0)).current;
  const slam = useRef(new Animated.Value(0)).current;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const sound = useSound();
  const s = sound?.settings;
  const silent = s ? !(s.bgmEnabled && s.bgmVolume > 0) && !(s.seEnabled && s.seVolume > 0) : false;
  useBgm('bgm_title');

  useEffect(() => {
    // タイトルが奥から「ドーン！」と飛び込んできて、そのあとは脈打ち続ける
    const intro = Animated.spring(slam, { toValue: 1, friction: 4, tension: 70, useNativeDriver: USE_NATIVE_DRIVER });
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(pulse, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    intro.start();
    loop.start();
    return () => {
      intro.stop();
      loop.stop();
    };
  }, [pulse, slam]);

  const titleScale = Animated.multiply(
    slam.interpolate({ inputRange: [0, 1], outputRange: [3, 1] }),
    pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }),
  );
  const startScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });

  return (
    <View
      style={styles.root}
      testID="line-title"
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      <HaloBackdrop width={size.width} height={size.height} centerYRatio={0.3} />
      <View style={styles.topBar}>
        {sound && (
          <Pressable
            testID="line-sound-settings"
            accessibilityRole="button"
            accessibilityLabel="サウンド設定"
            onPress={() => setSettingsOpen(true)}
            style={styles.chip}
          >
            <Text style={[emojiText, styles.chipText]}>{silent ? '🔇 サウンド' : '🔊 サウンド'}</Text>
          </Pressable>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.kicker}>
          <Text style={styles.kickerText}>上司の長文LINEを1文字で読め</Text>
        </View>
        <Animated.View style={{ transform: [{ scale: titleScale }, { rotate: '-4deg' }] }}>
          <OutlinedText testID="line-title-logo" fill="#FFE600" outline="#000000" shadow="#D0002A" outlineWidth={4} depth={7} style={styles.title}>
            要約の達人
          </OutlinedText>
        </Animated.View>

        {/* 長文 LINE → タップで要約 → 結論 1 語 のイメージ */}
        <View style={styles.demo}>
          <View style={styles.demoBubble}>
            <Text style={[emojiText, styles.demoText]} numberOfLines={3}>
              お疲れサマ😊✨色々考えたんだけど…<Text style={styles.marker}>{CONCLUSION_WORDS[0]}</Text>
              にしていいヨ👍ゆっくりしてネ🛌💤
            </Text>
          </View>
          <Text style={[emojiText, styles.arrow]}>👆 タップで要約 ✂️</Text>
          <View style={styles.demoWord}>
            <Text style={styles.demoWordText}>{CONCLUSION_WORDS[0]}</Text>
          </View>
        </View>

        <View style={styles.howto}>
          <Text style={[emojiText, styles.howtoText]}>
            🕘 9:00〜18:00 まで耐えれば<Text style={styles.good}>定時退社</Text>！{'\n'}
            吹き出しを<Text style={styles.good}>タップで要約</Text>→ 出てきた結論をカゴでキャッチ{'\n'}
            <Text style={styles.bad}>「明日休み…なんてネ😜」のひっかけ</Text>は要約するとライフ−1{'\n'}
            結論を見逃すと上司がイライラ → 100% でブチギレ😡
          </Text>
        </View>

        <View style={styles.best}>
          <Text style={styles.bestText} testID="line-title-best">
            ハイスコア {highScore.bestScore} ／ 最高 {highScore.bestCombo} 連続
          </Text>
          {highScore.bestScore > 0 && <Text style={styles.bestTitle}>称号：{lineTitleFor(highScore.bestScore)}</Text>}
        </View>

        <Animated.View style={[styles.start, { transform: [{ scale: startScale }] }]}>
          <GameButton testID="line-start" label="業務開始" size="large" onPress={onStart} style={styles.startButton} />
        </Animated.View>
      </ScrollView>
      {settingsOpen && <SoundSettingsPanel onClose={() => setSettingsOpen(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: lineColors.green, overflow: 'hidden' },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 14, paddingTop: 10, minHeight: 48 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: lineColors.greenDeep,
  },
  chipText: { fontSize: 13, fontWeight: '800', color: lineColors.greenDeep },
  scroll: { flex: 1 },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingBottom: 24 },
  kicker: {
    backgroundColor: '#D0002A',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFE600',
    transform: [{ rotate: '-4deg' }],
    marginBottom: 4,
  },
  kickerText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 1 },
  title: { fontSize: 60, lineHeight: 76, fontWeight: '900', fontStyle: 'italic', textAlign: 'center', letterSpacing: 2 },
  demo: { marginTop: 10, alignItems: 'center', width: '100%', maxWidth: 340 },
  demoBubble: {
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  demoText: { fontSize: 12, lineHeight: 17, color: lineColors.bubbleText, fontWeight: '600' },
  marker: { fontWeight: '900', color: '#5A2A00', backgroundColor: '#FFE600' },
  arrow: { fontSize: 15, lineHeight: 26, marginVertical: 2, fontWeight: '900', color: '#FFFFFF', textShadowColor: '#02441E', textShadowRadius: 3 },
  demoWord: {
    backgroundColor: lineColors.word,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 22,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  demoWordText: { fontSize: 22, fontWeight: '900', color: lineColors.wordText, letterSpacing: 2 },
  howto: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 16,
    borderWidth: 3,
    borderColor: lineColors.greenDeep,
    paddingVertical: 8,
    paddingHorizontal: 14,
    maxWidth: 360,
  },
  howtoText: { fontSize: 13, lineHeight: 21, color: lineColors.text, fontWeight: '700', textAlign: 'center' },
  good: { color: '#B86E00', fontWeight: '900' },
  bad: { color: '#D0002A', fontWeight: '900' },
  best: {
    marginTop: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(0,40,20,0.8)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 18,
  },
  bestText: { fontSize: 14, color: '#FFE600', fontWeight: '900' },
  bestTitle: { fontSize: 12, color: '#FFFFFF', marginTop: 1, fontWeight: '700' },
  start: { marginTop: 18 },
  startButton: { backgroundColor: '#D0002A' },
});
