import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ClockOutPanel } from '../components/ClockOutPanel';
import { FallingText } from '../components/FallingText';
import { FeverGauge } from '../components/FeverGauge';
import { HaloBackdrop } from '../components/HaloBackdrop';
import { IncomingCall } from '../components/IncomingCall';
import { MoodGauge } from '../components/MoodGauge';
import { PraisePopup } from '../components/PraisePopup';
import { RageOverlay } from '../components/RageOverlay';
import { SummaryBasket } from '../components/SummaryBasket';
import {
  type Burst,
  clockLabel,
  createLineConfig,
  createLineGame,
  DAY_SECONDS,
  FEVER_SECONDS,
  type LineConfig,
  type LineEvent,
  type LineState,
  MAX_LIVES,
  moveBasket,
  READ_TIERS,
  RUSH_FROM,
  step,
  tapAt,
} from '../game/engine';
import { randomSeed } from '../game/rng';
import { useGameLoop } from '../game/useGameLoop';
import { useBgm, useSound } from '../shared/audio/SoundContext';
import { catchSounds, type SoundName } from '../shared/audio/sounds';
import { OutlinedText } from '../shared/components/OutlinedText';
import { emojiText, lineColors } from '../theme';

/** キーボード（ブラウザ版）で要約カゴを動かす速さ（px/秒） */
const KEY_SPEED = 520;
/** キャッチ・被弾したあと、カゴが光っている秒数 */
const BASKET_FLASH_SECONDS = 0.18;
/** 被弾したときの画面の揺れの長さ（秒） */
const SHAKE_SECONDS = 0.35;
/** ブチギレを耐え抜いたときの「セーフ！」の表示時間（秒） */
const CALM_SECONDS = 1.6;
/** これより指が動かず、これより短く離したら「タップ」（それ以外はカゴを動かすスワイプ） */
export const TAP_MOVE_LIMIT = 12;
export const TAP_TIME_LIMIT_MS = 350;

export interface LineResult {
  score: number;
  combo: number;
}

interface Props {
  bestScore: number;
  /** ゲームが終わったとき（定時退社でも残業確定でも）に 1 回呼ばれる。ハイスコア更新なら true を返す */
  onGameOver: (result: LineResult) => boolean;
  onRetry: () => void;
  onTitle: () => void;
  /** テスト用：展開を固定する */
  seed?: number;
}

/** 起きたことに合わせて鳴らす音 */
export function soundsFor(ev: LineEvent): SoundName[] {
  switch (ev.type) {
    case 'summarize':
      return ev.result === 'real' || ev.result === 'boss' ? ['se_tear'] : ev.result === 'none' ? ['se_none'] : [];
    case 'quick-read':
      return ev.mult >= 3 ? ['se_praise'] : [];
    case 'rare':
      return ['se_rare'];
    case 'fever-start':
      return ['se_fever'];
    case 'fever-end':
      return ['se_calm'];
    case 'catch':
      return catchSounds(ev.combo);
    case 'hit':
      return ['se_hit'];
    case 'overlook':
      return ['se_none'];
    case 'rage-start':
      return ['se_rage'];
    case 'rage-end':
      return ['se_calm'];
    case 'clear':
      return ['se_clear'];
    case 'gameover':
      return ['se_gameover'];
    default:
      return [];
  }
}

export function LineGameScreen({ bestScore, onGameOver, onRetry, onTitle, seed }: Props) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const config = useMemo<LineConfig | null>(() => (size ? createLineConfig(size.width, size.height) : null), [size]);
  const [game, setGame] = useState<LineState>(() => createLineGame(seed ?? randomSeed()));
  const gameRef = useRef(game);
  const configRef = useRef(config);
  configRef.current = config;
  const fieldRef = useRef<View>(null);
  const fieldOffset = useRef({ x: 0, y: 0 });
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [calmAt, setCalmAt] = useState(-10);
  const [reduceMotion, setReduceMotion] = useState(false);
  const keys = useRef({ left: false, right: false });
  const reported = useRef(false);
  const sound = useSound();
  const soundRef = useRef(sound);
  soundRef.current = sound;
  // 神要約タイム中は、大当たり風のタイトルの曲に切り替える
  useBgm(game.status !== 'playing' ? null : game.feverTime > 0 ? 'bgm_title' : 'bgm_game');

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      ?.then((v) => alive && setReduceMotion(v))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /** 新しい状態にして、起きたことの音を鳴らす */
  const update = useCallback((next: LineState) => {
    gameRef.current = next;
    setGame(next);
    const manager = soundRef.current?.manager;
    for (const ev of next.events) {
      // 終わったら BGM をピタッと止める
      if (ev.type === 'gameover' || ev.type === 'clear') manager?.stopBgm();
      if (ev.type === 'rage-end') setCalmAt(next.time);
      manager?.playSes(soundsFor(ev));
    }
  }, []);

  // 画面の大きさが決まったら、カゴを真ん中に置く
  useEffect(() => {
    if (!config) return;
    const g = gameRef.current;
    gameRef.current = moveBasket(g, config, g.basketX || config.width / 2);
    setGame(gameRef.current);
  }, [config]);

  useGameLoop(
    (dt) => {
      const cfg = configRef.current;
      if (!cfg) return;
      let prev = gameRef.current;
      // キーボードの ← → でも動かせる
      const dir = (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0);
      if (dir !== 0) prev = moveBasket(prev, cfg, prev.basketX + dir * KEY_SPEED * dt);
      update(step(prev, cfg, dt));
    },
    config !== null && game.status === 'playing' && !paused,
  );

  // 終わったら 1 回だけ結果を記録する
  useEffect(() => {
    if (game.status === 'playing' || reported.current) return;
    reported.current = true;
    setIsNewRecord(onGameOver({ score: game.score, combo: game.maxCombo }));
  }, [game.status, game.score, game.maxCombo, onGameOver]);

  const pause = useCallback(() => {
    if (gameRef.current.status !== 'playing') return;
    setPaused(true);
    soundRef.current?.manager.suspendBgm();
  }, []);
  const resume = useCallback(() => {
    setPaused(false);
    soundRef.current?.manager.resumeBgm();
  }, []);

  // アプリやタブが裏に回ったら自動で一時停止する
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') pause();
    });
    return () => sub.remove();
  }, [pause]);

  // ブラウザ版：← → / A D キーでカゴを動かす、Esc で一時停止
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    const set = (e: KeyboardEvent, down: boolean) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.current.left = down;
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.current.right = down;
      else return;
      e.preventDefault();
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return pause();
      set(e, true);
    };
    const onUp = (e: KeyboardEvent) => set(e, false);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [pause]);

  /**
   * 1 本の指で 2 つの操作：
   * - 左右にスワイプ → 指を動かした分だけカゴが動く（どこを触ってもよい）
   * - 吹き出しをタップ（ほとんど動かさずにすぐ離す）→ 要約
   */
  const touch = useRef({ basketX: 0, startAt: 0, moved: false });
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          touch.current = { basketX: gameRef.current.basketX, startAt: Date.now(), moved: false };
        },
        onPanResponderMove: (_e, g) => {
          const cfg = configRef.current;
          if (!cfg || gameRef.current.status !== 'playing' || pausedRef.current) return;
          if (Math.abs(g.dx) > TAP_MOVE_LIMIT || Math.abs(g.dy) > TAP_MOVE_LIMIT) touch.current.moved = true;
          // 少し大きめに動かして、狭い画面でも端まで届くようにする
          gameRef.current = moveBasket(gameRef.current, cfg, touch.current.basketX + g.dx * 1.25);
        },
        onPanResponderRelease: (e: GestureResponderEvent, g) => {
          const cfg = configRef.current;
          if (!cfg || pausedRef.current) return;
          const quick = Date.now() - touch.current.startAt < TAP_TIME_LIMIT_MS;
          const still = !touch.current.moved && Math.abs(g.dx) <= TAP_MOVE_LIMIT && Math.abs(g.dy) <= TAP_MOVE_LIMIT;
          if (!quick || !still) return;
          const x = e.nativeEvent.pageX - fieldOffset.current.x;
          const y = e.nativeEvent.pageY - fieldOffset.current.y;
          const next = tapAt(gameRef.current, cfg, x, y);
          if (next !== gameRef.current) update(next);
        },
      }),
    [update],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || size.width !== width || size.height !== height) setSize({ width, height });
    // タップの位置を、遊ぶ場所の中の座標に直すために、画面の中での位置を覚えておく
    fieldRef.current?.measureInWindow?.((x, y) => {
      if (Number.isFinite(x) && Number.isFinite(y)) fieldOffset.current = { x, y };
    });
  };

  const raging = game.rage > 0;
  const shaking = game.lastHitAt >= 0 && game.time - game.lastHitAt < SHAKE_SECONDS && !reduceMotion;
  const shake = shaking ? Math.sin(game.time * 80) * 10 * (1 - (game.time - game.lastHitAt) / SHAKE_SECONDS) : 0;
  const basketFlash =
    game.lastHitAt >= 0 && game.time - game.lastHitAt < BASKET_FLASH_SECONDS * 2
      ? 'hit'
      : game.lastCatchAt >= 0 && game.time - game.lastCatchAt < BASKET_FLASH_SECONDS
        ? 'catch'
        : null;
  const blink = Math.floor(game.time / 0.2) % 2;
  const showCalm = !raging && game.time - calmAt < CALM_SECONDS;
  const rush = game.time >= RUSH_FROM && game.status === 'playing';
  const dayProgress = Math.min(1, game.time / DAY_SECONDS);
  const fever = game.feverTime > 0;

  return (
    <View style={[styles.root, raging && styles.rootRage, fever && styles.rootFever]} testID="line-game">
      {/* 上部：時計・スコア・ライフ・イライラ度ゲージ */}
      <View style={styles.hud}>
        <View style={styles.hudRow}>
          <View style={styles.clockBox}>
            <Text style={[styles.clock, rush && styles.clockRush]} testID="line-clock">
              {clockLabel(game.time)}
            </Text>
            <View style={styles.dayTrack}>
              <View style={[styles.dayFill, { width: `${dayProgress * 100}%` }, rush && styles.dayFillRush]} />
            </View>
          </View>
          <Text style={styles.score} testID="line-score">
            {game.score}
            <Text style={styles.scoreUnit}> pt</Text>
          </Text>
          <Text style={[emojiText, styles.lives]} testID="line-lives" accessibilityLabel={`ライフ ${game.lives}`}>
            {'❤️'.repeat(game.lives)}
            {'🖤'.repeat(Math.max(0, MAX_LIVES - game.lives))}
          </Text>
          <Pressable testID="line-pause" accessibilityRole="button" accessibilityLabel="一時停止" onPress={pause} style={styles.pauseButton}>
            <Text style={styles.pauseText}>Ⅱ</Text>
          </Pressable>
        </View>
        <MoodGauge mood={game.mood} rage={game.rage} blink={blink} />
        <FeverGauge fever={game.fever} feverTime={game.feverTime} time={game.time} />
      </View>

      {/* 遊ぶ場所 */}
      <View ref={fieldRef} style={styles.field} onLayout={onLayout} {...pan.panHandlers} testID="line-field">
        {/* 神要約タイム：大当たりの後光 */}
        {config && fever && (
          <View style={[StyleSheet.absoluteFill, styles.feverBack]} pointerEvents="none" testID="fever-backdrop">
            <HaloBackdrop width={config.width} height={config.height} centerYRatio={0.4} />
          </View>
        )}
        <View style={[StyleSheet.absoluteFill, { transform: [{ translateX: shake }] }]}>
          {config && (
            <>
              {/* 即読ボーナスの目安線（この線より上で要約すると高得点） */}
              {!fever &&
                READ_TIERS.map((t) => (
                  <View key={t.mult} pointerEvents="none" style={[styles.zoneLine, { top: config.basketTop * t.until }]}>
                    <Text style={styles.zoneText}>
                      ↑ {t.label} ×{t.mult}
                    </Text>
                  </View>
                ))}
              {game.items.map((it) => (
                <FallingText key={it.id} item={it} rage={raging} time={game.time} />
              ))}
              {game.bursts.map((b) => (
                <BurstMark key={b.id} burst={b} />
              ))}
              {game.floaters.map((f) => (
                <Text
                  key={`f${f.id}`}
                  style={[
                    styles.floater,
                    f.tone === 'bad' && styles.floaterBad,
                    { left: f.x - 70, top: f.y - 30 - f.age * 60, opacity: 1 - f.age / 0.9 },
                  ]}
                >
                  {f.text}
                </Text>
              ))}
              <SummaryBasket config={config} x={game.basketX} flash={basketFlash} />
              <PraisePopup praise={game.lastPraise} y={config.height * 0.42} width={config.width} time={game.time} />
            </>
          )}
        </View>
        {config && <RageOverlay rage={game.rage} width={config.width} height={config.height} reduceMotion={reduceMotion} />}
        {showCalm && (
          <View style={styles.banner} pointerEvents="none" testID="rage-calm">
            <OutlinedText fill="#FFFFFF" shadow={lineColors.greenDeep} outlineWidth={3} depth={4} style={styles.bannerText}>
              機嫌が直った！セーフ
            </OutlinedText>
            <Text style={styles.bannerSub}>イライラ度 0% にリセット</Text>
          </View>
        )}
        {fever && game.feverTime > FEVER_SECONDS - 1.8 && (
          <View style={[styles.banner, styles.feverBanner]} pointerEvents="none" testID="fever-banner">
            <OutlinedText fill="#FFE600" shadow="#D0002A" outlineWidth={4} depth={6} style={styles.feverText}>
              神要約タイム!!
            </OutlinedText>
            <Text style={styles.bannerSub}>本物しか来ない！当たっても平気！スコア×3</Text>
          </View>
        )}
        {rush && game.time - RUSH_FROM < 1.6 && !raging && !fever && (
          <View style={styles.banner} pointerEvents="none" testID="rush-banner">
            <OutlinedText fill="#FFE600" shadow="#D0002A" outlineWidth={3} depth={4} style={styles.bannerText}>
              定時前ラッシュ！
            </OutlinedText>
            <Text style={styles.bannerSub}>17:00 を過ぎた。あと少しで定時</Text>
          </View>
        )}
        {game.time < 4 && game.status === 'playing' && (
          <View style={styles.hint} pointerEvents="none">
            <Text style={[emojiText, styles.hintText]}>
              👆 吹き出しをタップで要約 → 出てきた結論をカゴでキャッチ{'\n'}↔️ 左右スワイプでカゴを動かす（PC は ← →）
            </Text>
          </View>
        )}
      </View>

      {paused && (
        <Pressable testID="line-resume" accessibilityRole="button" accessibilityLabel="再開" onPress={resume} style={styles.pausePanel}>
          <OutlinedText fill="#FFFFFF" shadow={lineColors.greenDeep} outlineWidth={3} depth={4} style={styles.pausedTitle}>
            一時停止中
          </OutlinedText>
          <Text style={styles.pausedSub}>タップで再開</Text>
          <Pressable testID="line-pause-title" accessibilityRole="button" onPress={onTitle} style={styles.pausedTitleButton}>
            <Text style={styles.pausedTitleButtonText}>タイトルへ戻る</Text>
          </Pressable>
        </Pressable>
      )}

      {game.status === 'over' && (
        <IncomingCall
          reason={game.overReason ?? 'lives'}
          clock={clockLabel(game.time)}
          score={game.score}
          fakesDodged={game.fakesDodged}
          maxCombo={game.maxCombo}
          caught={game.caught}
          bestScore={bestScore}
          isNewRecord={isNewRecord}
          onRetry={onRetry}
          onTitle={onTitle}
        />
      )}
      {game.status === 'clear' && (
        <ClockOutPanel
          score={game.score}
          clearBonus={game.clearBonus}
          caught={game.caught}
          fakesDodged={game.fakesDodged}
          maxCombo={game.maxCombo}
          lives={game.lives}
          feverCount={game.feverCount}
          quickReads={game.quickReads}
          rares={game.rares}
          bestScore={bestScore}
          isNewRecord={isNewRecord}
          onRetry={onRetry}
          onTitle={onTitle}
        />
      )}
    </View>
  );
}

/** 吹き出しを要約した瞬間の文字（本物は「要約！」、ひっかけは「ひっかけ😜」、結論なしは「…」） */
function BurstMark({ burst }: { burst: Burst }) {
  const p = burst.age / 0.6;
  const label =
    burst.type === 'real'
      ? '✂️ 要約！'
      : burst.type === 'boss'
        ? '👑 社長命令！'
        : burst.type === 'gobaku'
          ? '📱 誤爆回収！'
          : burst.type === 'fake'
            ? '😜'
            : '💤';
  return (
    <Text
      pointerEvents="none"
      style={[
        emojiText,
        styles.burst,
        (burst.type === 'real' || burst.type === 'boss' || burst.type === 'gobaku') && styles.burstReal,
        { left: burst.x - 80, top: burst.y - 20, opacity: 1 - p, transform: [{ scale: 1 + p * 0.6 }] },
      ]}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: lineColors.talk, overflow: 'hidden' },
  rootRage: { backgroundColor: '#5A1020' },
  rootFever: { backgroundColor: '#06C755' },
  feverBack: { opacity: 0.85 },
  feverText: { fontSize: 38, fontWeight: '900', fontStyle: 'italic' },
  // ほめ言葉のポップ（画面の 4 割の高さ）と重ならないよう、上のほうに出す
  feverBanner: { top: '12%' },
  zoneLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.45)',
  },
  zoneText: {
    position: 'absolute',
    right: 6,
    top: -16,
    fontSize: 10,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.8)',
  },
  hud: { paddingTop: 6, paddingBottom: 6, backgroundColor: lineColors.talkDeep, zIndex: 2 },
  hudRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10 },
  clockBox: { alignItems: 'stretch', width: 64 },
  clock: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', fontVariant: ['tabular-nums'], textAlign: 'center' },
  clockRush: { color: '#FFE600' },
  dayTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  dayFill: { height: '100%', backgroundColor: '#FFFFFF' },
  dayFillRush: { backgroundColor: '#FFE600' },
  score: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', fontVariant: ['tabular-nums'], flexShrink: 0 },
  scoreUnit: { fontSize: 12, fontWeight: '800' },
  lives: { marginLeft: 'auto', fontSize: 16, lineHeight: 24 },
  pauseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseText: { fontSize: 16, fontWeight: '900', color: lineColors.talkDeep },
  field: { flex: 1, overflow: 'hidden' },
  floater: {
    position: 'absolute',
    width: 140,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '900',
    color: '#FFE600',
    textShadowColor: '#5A2A00',
    textShadowRadius: 4,
    textShadowOffset: { width: 1, height: 2 },
  },
  floaterBad: { color: '#FFFFFF', textShadowColor: '#D0002A', fontSize: 18 },
  burst: {
    position: 'absolute',
    width: 160,
    textAlign: 'center',
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    textShadowColor: '#000000',
    textShadowRadius: 4,
  },
  burstReal: { color: '#FFE600', textShadowColor: lineColors.greenDeep },
  banner: { position: 'absolute', left: 0, right: 0, top: '38%', alignItems: 'center' },
  bannerText: { fontSize: 30, fontWeight: '900', fontStyle: 'italic' },
  bannerSub: { marginTop: 4, fontSize: 13, fontWeight: '900', color: '#FFFFFF', textShadowColor: '#000', textShadowRadius: 3 },
  hint: { position: 'absolute', left: 0, right: 0, bottom: 90, alignItems: 'center', paddingHorizontal: 12 },
  hintText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  pausePanel: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10,20,40,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  pausedTitle: { fontSize: 36, fontWeight: '900', fontStyle: 'italic' },
  pausedSub: { marginTop: 8, fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  pausedTitleButton: {
    marginTop: 28,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  pausedTitleButtonText: { fontSize: 15, fontWeight: '900', color: lineColors.talkDeep },
});
