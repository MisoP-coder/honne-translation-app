import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Linking,
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
import { TitleBackdrop } from '../components/TitleBackdrop';
import { config } from '../config';
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
  // タイトルとスタートボタンを、どくん…どくん…と脈打たせる
  const pulse = useRef(new Animated.Value(0)).current;
  const [size, setSize] = useState({ width: 0, height: 0 });
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

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(pulse, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const translateX = wobble.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });
  const skewX = wobble.interpolate({ inputRange: [-1, 1], outputRange: ['6deg', '-6deg'] });
  const titleScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const startScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });

  return (
    <View
      style={styles.root}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      <TitleBackdrop width={size.width} height={size.height} centerYRatio={compact ? 0.45 : 0.47} />
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
        {/* 「極限！」は傾けた赤いリボンに */}
        <View style={styles.kickerRibbon}>
          <OutlinedText fill="#FFFFFF" shadow="#5A1A00" outlineWidth={2} depth={3} style={compact ? styles.kickerCompact : styles.kicker}>
            極限！
          </OutlinedText>
        </View>
        <Animated.View style={{ transform: [{ scale: titleScale }] }}>
          <OutlinedText fill="#FFE600" shadow="#D0002A" outlineWidth={3} depth={5} style={compact ? styles.titleCompact : styles.title}>
            カラメル・{'\n'}ジャスト・ミート
          </OutlinedText>
        </Animated.View>

        <View style={[styles.pudding, compact && styles.puddingCompact]}>
          <PuddingArt
            topHalf={compact ? 50 : 66}
            bottomHalf={compact ? 64 : 84}
            height={compact ? 58 : 78}
            caramelCount={6}
            bodyStyle={{ transform: [{ translateX }, { skewX }] }}
          />
        </View>

        <View style={[styles.howtoCard, compact && styles.howtoCardCompact]}>
          <Text style={[styles.howto, compact && styles.howtoCompact]}>
            ぷるぷる揺れるプリンの頂点に{'\n'}タップでカラメルを落とせ！{'\n'}
            <Text style={styles.howtoStrong}>ズレたら即ゲームオーバー</Text>
          </Text>
        </View>

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
          <Animated.View style={{ transform: [{ scale: startScale }] }}>
            <GameButton testID="start" label="スタート" size="large" onPress={onStart} />
          </Animated.View>
          <GameButton testID="open-ranking" label="世界ランキング" variant="secondary" onPress={onRanking} />
        </View>

        <View style={styles.footer}>
          <FooterLink testID="link-about" path="/about.html" label="遊び方" />
          <Text style={styles.footerSep}>・</Text>
          <FooterLink testID="link-privacy" path="/privacy.html" label="プライバシーポリシー" />
        </View>
      </ScrollView>
      {settingsOpen && <SoundSettingsPanel onClose={() => setSettingsOpen(false)} />}
    </View>
  );
}

/**
 * 遊び方・プライバシーポリシーのページへのリンク。
 * ブラウザ版は本物のリンク（<a>）にする。アプリ版は公開サイトの URL があるときだけブラウザで開く。
 */
function FooterLink({ path, label, testID }: { path: string; label: string; testID: string }) {
  const web = Platform.OS === 'web';
  if (!web && !config.siteUrl) return null;
  // href は react-native-web だけが解釈する（型定義にはない）
  const linkProps = web ? { href: path } : {};
  return (
    <Text
      testID={testID}
      accessibilityRole="link"
      onPress={web ? undefined : () => void Linking.openURL(`${config.siteUrl}${path}`).catch(() => {})}
      style={styles.footerLink}
      {...linkProps}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F07A22', overflow: 'hidden' },
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
  kickerRibbon: {
    flexShrink: 0,
    backgroundColor: '#D0002A',
    paddingHorizontal: 18,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFE600',
    transform: [{ rotate: '-6deg' }],
    marginBottom: 6,
  },
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
  pudding: { flexShrink: 0, marginTop: 18, marginBottom: 12, alignItems: 'center' },
  puddingCompact: { marginTop: 6, marginBottom: 4 },
  // 背景がにぎやかなので、説明は白いカードに載せて読みやすくする
  howtoCard: {
    flexShrink: 0,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.caramel,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  howtoCardCompact: { paddingVertical: 6 },
  howto: { fontSize: 15, lineHeight: 22, color: colors.text, textAlign: 'center', fontWeight: '700' },
  howtoCompact: { fontSize: 14, lineHeight: 20 },
  howtoStrong: { color: colors.accent, fontWeight: '900' },
  best: {
    flexShrink: 0,
    marginTop: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(90,30,0,0.82)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 18,
  },
  bestCompact: { marginTop: 8 },
  bestText: { fontSize: 14, color: '#FFE600', fontWeight: '900' },
  bestTitle: { fontSize: 12, color: '#FFFFFF', marginTop: 1, fontWeight: '700' },
  buttons: { flexShrink: 0, marginTop: 20, gap: 14, alignItems: 'center' },
  footer: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  // 背景がにぎやかなので、影を付けて読みやすくする
  footerLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textDecorationLine: 'underline',
    textShadowColor: 'rgba(90,30,0,0.85)',
    textShadowRadius: 3,
  },
  footerSep: { fontSize: 12, color: '#FFFFFF', marginHorizontal: 6 },
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
