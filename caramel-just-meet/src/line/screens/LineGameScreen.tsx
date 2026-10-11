import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  type LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useBgm, useSound } from '../../audio/SoundContext';
import { OutlinedText } from '../../components/OutlinedText';
import { randomSeed } from '../../game/rng';
import { useGameLoop } from '../../hooks/useGameLoop';
import { FallingText } from '../components/FallingText';
import { IncomingCall } from '../components/IncomingCall';
import { MoodGauge } from '../components/MoodGauge';
import { PraisePopup } from '../components/PraisePopup';
import { RageOverlay } from '../components/RageOverlay';
import { SummaryBasket } from '../components/SummaryBasket';
import {
  createLineConfig,
  createLineGame,
  type LineConfig,
  type LineState,
  MAX_LIVES,
  moveBasket,
  step,
} from '../engine';
import { catchSounds, playLineSe } from '../sounds';
import { emojiText, lineColors } from '../theme';

/** キーボード（ブラウザ版）で要約カゴを動かす速さ（px/秒） */
const KEY_SPEED = 520;
/** キャッチ・被弾したあと、カゴが光っている秒数 */
const BASKET_FLASH_SECONDS = 0.18;
/** 被弾したときの画面の揺れの長さ（秒） */
const SHAKE_SECONDS = 0.35;
/** ブチギレを耐え抜いたときの「セーフ！」の表示時間（秒） */
const CALM_SECONDS = 1.6;

export interface LineResult {
  score: number;
  combo: number;
}

interface Props {
  bestScore: number;
  /** ゲームオーバー時に 1 回呼ばれる。ハイスコア更新なら true を返す */
  onGameOver: (result: LineResult) => boolean;
  onRetry: () => void;
  onTitle: () => void;
  /** テスト用：展開を固定する */
  seed?: number;
}

export function LineGameScreen({ bestScore, onGameOver, onRetry, onTitle, seed }: Props) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const config = useMemo<LineConfig | null>(() => (size ? createLineConfig(size.width, size.height) : null), [size]);
  const [game, setGame] = useState<LineState>(() => createLineGame(seed ?? randomSeed()));
  const gameRef = useRef(game);
  const configRef = useRef(config);
  configRef.current = config;
  const [paused, setPaused] = useState(false);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [calmAt, setCalmAt] = useState(-10);
  const [reduceMotion, setReduceMotion] = useState(false);
  const keys = useRef({ left: false, right: false });
  const reported = useRef(false);
  const sound = useSound();
  const soundRef = useRef(sound);
  soundRef.current = sound;
  useBgm(game.status === 'over' ? null : 'bgm_game');

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      ?.then((v) => alive && setReduceMotion(v))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const update = useCallback((next: LineState) => {
    gameRef.current = next;
    setGame(next);
  }, []);

  // 画面の大きさが決まったら、カゴを真ん中に置く
  useEffect(() => {
    if (!config) return;
    const g = gameRef.current;
    update(moveBasket(g, config, g.basketX || config.width / 2));
  }, [config, update]);

  useGameLoop(
    (dt) => {
      const cfg = configRef.current;
      if (!cfg) return;
      let prev = gameRef.current;
      // キーボードの ← → でも動かせる
      const dir = (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0);
      if (dir !== 0) prev = moveBasket(prev, cfg, prev.basketX + dir * KEY_SPEED * dt);
      const next = step(prev, cfg, dt);
      const manager = soundRef.current?.manager;
      for (const ev of next.events) {
        if (ev.type === 'catch') playLineSe(manager, catchSounds(ev.combo));
        else if (ev.type === 'hit') playLineSe(manager, ['line_hit']);
        else if (ev.type === 'rage-start') playLineSe(manager, ['line_rage']);
        else if (ev.type === 'rage-end') {
          playLineSe(manager, ['line_calm']);
          setCalmAt(next.time);
        } else if (ev.type === 'gameover') {
          // BGM をピタッと止めて、着信のバイブ → 「チーン…」
          manager?.stopBgm();
          playLineSe(manager, ['line_gameover']);
        }
      }
      update(next);
    },
    config !== null && game.status === 'playing' && !paused,
  );

  // ゲームオーバーになったら 1 回だけ結果を記録する
  useEffect(() => {
    if (game.status !== 'over' || reported.current) return;
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

  // ブラウザ版：← → / A D キーでカゴを動かす、スペース / Esc で一時停止
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

  // 左右スワイプ：指を動かした分だけカゴが動く（指でカゴが隠れないよう、どこを触ってもよい）
  const dragStart = useRef(0);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStart.current = gameRef.current.basketX;
        },
        onPanResponderMove: (_e, g) => {
          const cfg = configRef.current;
          if (!cfg || gameRef.current.status !== 'playing') return;
          // 少し大きめに動かして、狭い画面でも端まで届くようにする
          gameRef.current = moveBasket(gameRef.current, cfg, dragStart.current + g.dx * 1.25);
        },
      }),
    [],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || size.width !== width || size.height !== height) setSize({ width, height });
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

  return (
    <View style={[styles.root, raging && styles.rootRage]} testID="line-game">
      {/* 上部：スコア・ライフ・イライラ度ゲージ */}
      <View style={styles.hud}>
        <View style={styles.hudRow}>
          <Text style={styles.score} testID="line-score">
            {game.score}
            <Text style={styles.scoreUnit}> pt</Text>
          </Text>
          {game.combo >= 2 && <Text style={styles.combo}>{game.combo} 連続要約</Text>}
          <Text style={[emojiText, styles.lives]} testID="line-lives" accessibilityLabel={`ライフ ${game.lives}`}>
            {'❤️'.repeat(game.lives)}
            {'🖤'.repeat(Math.max(0, MAX_LIVES - game.lives))}
          </Text>
          <Pressable testID="line-pause" accessibilityRole="button" accessibilityLabel="一時停止" onPress={pause} style={styles.pauseButton}>
            <Text style={styles.pauseText}>Ⅱ</Text>
          </Pressable>
        </View>
        <MoodGauge mood={game.mood} rage={game.rage} blink={blink} />
      </View>

      {/* 遊ぶ場所 */}
      <View style={styles.field} onLayout={onLayout} {...pan.panHandlers} testID="line-field">
        <View style={[StyleSheet.absoluteFill, { transform: [{ translateX: shake }] }]}>
          {config && (
            <>
              {game.items.map((it) => (
                <FallingText key={it.id} item={it} rage={raging} />
              ))}
              {game.floaters.map((f) => (
                <Text
                  key={f.id}
                  style={[styles.floater, { left: f.x - 50, top: f.y - 30 - f.age * 60, opacity: 1 - f.age / 0.9 }]}
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
          <View style={styles.calm} pointerEvents="none" testID="rage-calm">
            <OutlinedText fill="#FFFFFF" shadow={lineColors.greenDeep} outlineWidth={3} depth={4} style={styles.calmText}>
              機嫌が直った！セーフ
            </OutlinedText>
            <Text style={styles.calmSub}>イライラ度 0% にリセット</Text>
          </View>
        )}
        {game.time < 2.5 && game.status === 'playing' && (
          <View style={styles.hint} pointerEvents="none">
            <Text style={[emojiText, styles.hintText]}>👆 左右にスワイプでカゴを動かす（PC は ← →）</Text>
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
          score={game.score}
          maxCombo={game.maxCombo}
          caught={game.caught}
          bestScore={bestScore}
          isNewRecord={isNewRecord}
          onRetry={onRetry}
          onTitle={onTitle}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: lineColors.talk, overflow: 'hidden' },
  rootRage: { backgroundColor: '#5A1020' },
  hud: { paddingTop: 6, paddingBottom: 6, backgroundColor: lineColors.talkDeep, zIndex: 2 },
  hudRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  score: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', fontVariant: ['tabular-nums'], flexShrink: 0 },
  scoreUnit: { fontSize: 13, fontWeight: '800' },
  combo: {
    fontSize: 12,
    fontWeight: '900',
    color: lineColors.wordText,
    backgroundColor: lineColors.word,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  lives: { marginLeft: 'auto', fontSize: 18, lineHeight: 26 },
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
    width: 100,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '900',
    color: '#FFE600',
    textShadowColor: '#5A2A00',
    textShadowRadius: 4,
    textShadowOffset: { width: 1, height: 2 },
  },
  calm: { position: 'absolute', left: 0, right: 0, top: '38%', alignItems: 'center' },
  calmText: { fontSize: 30, fontWeight: '900', fontStyle: 'italic' },
  calmSub: { marginTop: 4, fontSize: 13, fontWeight: '900', color: '#FFFFFF', textShadowColor: '#000', textShadowRadius: 3 },
  hint: { position: 'absolute', left: 0, right: 0, bottom: 90, alignItems: 'center' },
  hintText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
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
