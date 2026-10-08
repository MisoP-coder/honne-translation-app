import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useBgm, useSound } from '../audio/SoundContext';
import { landingSounds } from '../audio/sounds';
import { Backdrop } from '../components/Backdrop';
import { CaramelDrop } from '../components/CaramelDrop';
import { ComboPopup } from '../components/ComboPopup';
import { Dropper } from '../components/Dropper';
import { Fever, feverLevel } from '../components/Fever';
import { GameOverPanel } from '../components/GameOverPanel';
import { OutlinedText } from '../components/OutlinedText';
import { PausePanel } from '../components/PausePanel';
import { SoundSettingsPanel } from '../components/SoundSettingsPanel';
import { JudgePopup } from '../components/JudgePopup';
import { ParticleLayer } from '../components/ParticleLayer';
import { type BounceTrigger, Pudding } from '../components/Pudding';
import { TvNoise } from '../components/TvNoise';
import { Vignette } from '../components/Vignette';
import {
  createConfig,
  createGame,
  type GameConfig,
  type GameState,
  puddingCenterX,
  step,
  tapDrop,
} from '../game/engine';
import { type FaceState, INITIAL_FACE, stepFace } from '../game/face';
import {
  clearParticles,
  createParticleSystem,
  type ParticleSystem,
  spawnBurst,
  stepParticles,
} from '../game/particles';
import { randomSeed } from '../game/rng';
import { useGameLoop } from '../hooks/useGameLoop';
import { shareToX } from '../share/xShare';
import { colors } from '../theme/colors';
import { sepia } from '../theme/tone';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** 一時停止から戻るときのカウントダウン（3, 2, 1）の 1 つぶんの長さ（ミリ秒） */
export const RESUME_COUNT_MS = 600;

/** ミスした瞬間のスクリーンシェイク（x, y の振れ幅。だんだん収まる） */
const SHAKE_STEPS: readonly [number, number][] = [
  [30, -14],
  [-26, 18],
  [24, 10],
  [-22, -16],
  [18, 12],
  [-15, -9],
  [12, 8],
  [-9, -6],
  [6, 4],
  [-3, -2],
  [0, 0],
];

/** ゲームオーバー演出のセピア化の度合い（0〜1） */
export function sepiaAmountFor(game: GameState): number {
  if (game.status === 'over') return 1;
  if (game.status !== 'sliding' || !game.slide) return 0;
  // 滑り始めてすぐにグッと色が抜ける
  const p = Math.min(1, game.slide.progress * 1.6);
  return 1 - (1 - p) ** 3;
}

export interface GameResult {
  score: number;
  combo: number;
}

interface Props {
  bestScore: number;
  /** ゲームオーバー時に1回呼ばれる。ハイスコア更新なら true を返す */
  onGameOver: (result: GameResult) => boolean;
  onRanking: () => void;
  onTitle: () => void;
  /** テスト用：揺れ方を固定する */
  seed?: number;
}

export function GameScreen({ bestScore, onGameOver, onRanking, onTitle, seed }: Props) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const config = useMemo<GameConfig | null>(
    () => (size ? createConfig(size.width, size.height) : null),
    [size],
  );
  const [game, setGame] = useState<GameState>(() => createGame(seed ?? randomSeed()));
  const gameRef = useRef(game);
  const [particles, setParticles] = useState<ParticleSystem>(() =>
    createParticleSystem(randomSeed()),
  );
  const particlesRef = useRef(particles);
  const [face, setFace] = useState<FaceState>(INITIAL_FACE);
  const faceRef = useRef(face);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const shakeX = useRef(new Animated.Value(0)).current;
  const shakeY = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const [flashColor, setFlashColor] = useState('#FFFFFF');
  const reported = useRef(false);
  const sound = useSound();
  const soundRef = useRef(sound);
  soundRef.current = sound;
  useBgm('bgm_game');

  // 一時停止。countdown は再開前の「3, 2, 1」（その間もゲームは止まったまま）
  const [paused, setPaused] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [soundOpen, setSoundOpen] = useState(false);

  const update = useCallback((next: GameState) => {
    gameRef.current = next;
    setGame(next);
  }, []);

  const setParticleSystem = useCallback((next: ParticleSystem) => {
    if (next === particlesRef.current) return;
    particlesRef.current = next;
    setParticles(next);
  }, []);

  const runFlash = useCallback(
    (color: string, peak: number, duration: number) => {
      setFlashColor(color);
      flash.setValue(peak);
      Animated.timing(flash, { toValue: 0, duration, useNativeDriver: USE_NATIVE_DRIVER }).start();
    },
    [flash],
  );

  useGameLoop(
    (dt) => {
      if (!config) return;
      const prev = gameRef.current;
      const next = step(prev, config, dt);
      let fx = particlesRef.current;
      const judge = next.lastJudge;
      if (judge && judge.id !== prev.lastJudge?.id) {
        // 着地した瞬間に音を鳴らす。ミスなら BGM をピタッと止めて「カッ…カーン、チーン…」
        if (judge.judge === 'miss') soundRef.current?.manager.stopBgm();
        soundRef.current?.manager.playSes(landingSounds(judge.judge, judge.combo));
        if (judge.judge === 'miss') {
          fx = clearParticles(fx);
        } else {
          // 成功：プリンの頂点からキラキラが飛び散る
          fx = spawnBurst(fx, puddingCenterX(next, config), config.puddingTopY - 6, judge.judge, judge.combo);
        }
      }
      fx = stepParticles(fx, dt);
      // 顔は慣性で遅れてついてくる
      faceRef.current = stepFace(faceRef.current, next.puddingVelocity, dt, config.puddingTopHalfWidth * 0.24);
      if (next !== prev) update(next);
      setParticleSystem(fx);
      setFace(faceRef.current);
    },
    config !== null && game.status !== 'over' && !paused,
  );

  const pause = useCallback(() => {
    if (gameRef.current.status !== 'playing') return;
    setPaused(true);
    setCountdown(null);
    soundRef.current?.manager.suspendBgm();
  }, []);

  const resume = () => {
    setSoundOpen(false);
    setCountdown(3);
  };

  // 再開前のカウントダウン。0 になったらゲームと BGM を再開する
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      setPaused(false);
      soundRef.current?.manager.resumeBgm();
      return;
    }
    const id = setTimeout(() => setCountdown(countdown - 1), RESUME_COUNT_MS);
    return () => clearTimeout(id);
  }, [countdown]);

  // アプリが裏に回ったら（電話・通知・ホームボタンなど）自動で一時停止する
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') pause();
    });
    return () => sub.remove();
  }, [pause]);

  // 一時停止したまま画面を離れたら、一時停止を取り消しておく（次の画面の BGM が流れるように）
  useEffect(() => () => soundRef.current?.manager.cancelSuspend(), []);

  // 成功：ハイコンボの JUST MEET では画面がまぶしく光る
  useEffect(() => {
    const j = game.lastJudge;
    if (!j || j.judge !== 'perfect' || j.combo < 10) return;
    runFlash('#FFF3B0', Math.min(0.5, 0.2 + j.combo * 0.01), 260);
  }, [game.lastJudge, runFlash]);

  // 失敗：画面全体を激しく揺らし、一瞬白く光らせる
  useEffect(() => {
    if (game.status !== 'sliding') return;
    runFlash('#FFFFFF', 0.85, 420);
    const step = (to: number, v: Animated.Value) =>
      Animated.timing(v, { toValue: to, duration: 34, useNativeDriver: USE_NATIVE_DRIVER });
    const anim = Animated.parallel([
      Animated.sequence(SHAKE_STEPS.map(([x]) => step(x, shakeX))),
      Animated.sequence(SHAKE_STEPS.map(([, y]) => step(y, shakeY))),
    ]);
    anim.start();
    return () => anim.stop();
  }, [game.status, shakeX, shakeY, runFlash]);

  useEffect(() => {
    if (game.status !== 'over' || reported.current) return;
    reported.current = true;
    setIsNewRecord(onGameOver({ score: game.score, combo: game.combo }));
  }, [game.status, game.score, game.combo, onGameOver]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || size.width !== width || size.height !== height) setSize({ width, height });
  };

  const onTap = () => {
    if (!config || paused) return;
    const next = tapDrop(gameRef.current, config);
    if (next !== gameRef.current) {
      // 投下の「ヒュゥゥン」
      sound?.manager.playSe('se_drop');
      update(next);
    }
  };

  const retry = () => {
    reported.current = false;
    setPaused(false);
    setCountdown(null);
    setSoundOpen(false);
    sound?.manager.cancelSuspend();
    sound?.manager.stopBgm();
    sound?.manager.playBgm('bgm_game');
    setIsNewRecord(false);
    setParticleSystem(clearParticles(particlesRef.current));
    shakeX.setValue(0);
    shakeY.setValue(0);
    faceRef.current = INITIAL_FACE;
    setFace(INITIAL_FACE);
    update(createGame(randomSeed()));
  };

  const tone = sepiaAmountFor(game);
  const toned = (hex: string) => sepia(hex, tone);

  return (
    <View style={[styles.root, { backgroundColor: toned(colors.background) }]}>
      <Animated.View
        style={[styles.shaker, { transform: [{ translateX: shakeX }, { translateY: shakeY }] }]}
      >
        <View style={styles.hud}>
          <View>
            <Text style={[styles.hudLabel, { color: toned(colors.textSub) }]}>SCORE</Text>
            <Text style={[styles.hudValue, { color: toned(colors.text) }]} testID="hud-score">
              {game.score}
            </Text>
          </View>
          <View style={styles.hudCenter}>
            <Text style={[styles.hudLabel, { color: toned(colors.textSub) }]}>連続</Text>
            <Text
              style={[styles.hudValue, styles.combo, { color: toned(colors.accent) }]}
              testID="hud-combo"
            >
              {game.combo}
            </Text>
          </View>
          <View style={styles.hudRightGroup}>
            <View style={styles.hudRight}>
              <Text style={[styles.hudLabel, { color: toned(colors.textSub) }]}>BEST</Text>
              <Text style={[styles.hudValue, { color: toned(colors.text) }]}>
                {Math.max(bestScore, game.score)}
              </Text>
            </View>
            <Pressable
              testID="pause"
              accessibilityRole="button"
              accessibilityLabel="一時停止"
              accessibilityState={{ disabled: game.status !== 'playing' }}
              disabled={game.status !== 'playing'}
              onPress={pause}
              hitSlop={10}
              style={[styles.pauseButton, game.status !== 'playing' && styles.pauseHidden]}
            >
              <View style={styles.pauseBar} />
              <View style={styles.pauseBar} />
            </Pressable>
          </View>
        </View>

        {/* 押した瞬間に反応させたいので Pressable ではなくレスポンダーを直接使う */}
        <View
          testID="play-area"
          style={styles.playArea}
          onStartShouldSetResponder={() => true}
          onResponderGrant={onTap}
          onLayout={onLayout}
          accessible
          accessibilityRole="button"
          accessibilityLabel="タップでカラメルを落とす"
        >
          {config && (
            <Stage config={config} game={game} particles={particles} face={face} sepiaAmount={tone} />
          )}
          {config && game.combo === 0 && !game.drop && game.status === 'playing' && (
            <Text style={styles.hint} pointerEvents="none">
              タップでカラメル投下！{'\n'}プリンの頂点を狙え
            </Text>
          )}
        </View>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: flashColor, opacity: flash }]}
      />

      {/* ゲームオーバー：古いテレビの砂嵐（ザーッ） */}
      <TvNoise amount={tone} />

      {paused && countdown === null && !soundOpen && (
        <PausePanel
          combo={game.combo}
          score={game.score}
          onResume={resume}
          onSoundSettings={() => setSoundOpen(true)}
          onRetry={retry}
          onTitle={() => {
            sound?.manager.cancelSuspend();
            onTitle();
          }}
        />
      )}
      {paused && soundOpen && <SoundSettingsPanel onClose={() => setSoundOpen(false)} />}
      {countdown !== null && countdown > 0 && (
        <View style={styles.countdown} pointerEvents="none" testID="resume-countdown">
          <OutlinedText
            key={countdown}
            testID="resume-count"
            fill="#FFE600"
            shadow="#D0002A"
            outlineWidth={4}
            depth={6}
            style={styles.countdownText}
          >
            {countdown}
          </OutlinedText>
        </View>
      )}

      {game.status === 'over' && (
        <GameOverPanel
          score={game.score}
          combo={game.combo}
          perfectCount={game.perfectCount}
          bestScore={Math.max(bestScore, game.score)}
          isNewRecord={isNewRecord}
          onShare={() => void shareToX(game.combo)}
          onRetry={retry}
          onRanking={onRanking}
          onTitle={onTitle}
        />
      )}
    </View>
  );
}

interface StageProps {
  config: GameConfig;
  game: GameState;
  particles: ParticleSystem;
  face: FaceState;
  sepiaAmount: number;
}

function Stage({ config, game, particles, face, sepiaAmount }: StageProps) {
  const centerX = puddingCenterX(game, config);
  const judge = game.lastJudge;
  const bounce = useMemo<BounceTrigger | null>(
    () =>
      judge && judge.judge !== 'miss'
        ? { id: judge.id, strength: judge.judge === 'perfect' ? 1 : 0.55 }
        : null,
    [judge],
  );
  const slide = game.slide;
  let slidingDrop: { x: number; y: number; tilt: number } | null = null;
  if (slide) {
    const p = slide.progress;
    const eased = p * p;
    const fallDistance = config.puddingHeight + 30;
    if (Math.abs(slide.relX) > config.puddingTopHalfWidth + config.dropRadius) {
      // かすりもしなかった：そのまま真下へ
      slidingDrop = { x: slide.worldX, y: config.puddingTopY + eased * fallDistance, tilt: 0 };
    } else {
      // 頂点からズレた：プリンの側面を滑り落ちる
      const slideOut = config.puddingBottomHalfWidth - Math.abs(slide.relX) + config.dropRadius;
      slidingDrop = {
        x: centerX + slide.relX + slide.dir * Math.max(0, slideOut) * eased,
        y: config.puddingTopY + eased * fallDistance,
        tilt: slide.dir * 50 * p,
      };
    }
  }

  return (
    <>
      <Backdrop
        width={config.width}
        height={config.height}
        tableY={config.puddingTopY + config.puddingHeight - 4}
        sepiaAmount={sepiaAmount}
      />
      <Fever
        width={config.width}
        height={config.height}
        cx={centerX}
        cy={config.puddingTopY + config.puddingHeight * 0.4}
        level={feverLevel(game.combo, game.status === 'playing')}
        time={game.time}
      />
      <Dropper x={config.dropperX} y={config.dropStartY} sepiaAmount={sepiaAmount} />
      <Pudding
        config={config}
        centerX={centerX}
        velocity={game.puddingVelocity}
        caramelCount={game.combo}
        bounce={bounce}
        sepiaAmount={sepiaAmount}
        faceOffset={face}
        faceMood={game.status === 'playing' ? 'normal' : 'shock'}
      />
      {game.drop && (
        <CaramelDrop
          testID="falling-drop"
          x={game.drop.x}
          y={game.drop.y}
          radius={config.dropRadius}
          stretch={1 + Math.min(game.drop.vy / 3000, 0.25)}
        />
      )}
      {slidingDrop && (
        <CaramelDrop
          testID="sliding-drop"
          x={slidingDrop.x}
          y={slidingDrop.y}
          radius={config.dropRadius}
          tilt={slidingDrop.tilt}
          sepiaAmount={sepiaAmount}
        />
      )}
      <ParticleLayer width={config.width} height={config.height} particles={particles.particles} />
      <Vignette width={config.width} height={config.height} amount={sepiaAmount} />
      <JudgePopup event={game.lastJudge} x={centerX} y={config.puddingTopY} />
      <ComboPopup event={game.lastJudge} y={config.height * 0.3} width={config.width} time={game.time} />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  shaker: { flex: 1 },
  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  hudCenter: { alignItems: 'center' },
  hudRight: { alignItems: 'flex-end' },
  hudRightGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pauseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.caramel,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  pauseHidden: { opacity: 0 },
  pauseBar: { width: 5, height: 16, borderRadius: 2, backgroundColor: colors.caramel },
  countdown: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(60,30,0,0.25)',
  },
  countdownText: { fontSize: 120, fontWeight: '900', fontStyle: 'italic' },
  hudLabel: { fontSize: 11, fontWeight: '800', color: colors.textSub, letterSpacing: 1 },
  hudValue: { fontSize: 24, fontWeight: '900', color: colors.text },
  combo: { color: colors.accent, fontSize: 32 },
  playArea: { flex: 1, overflow: 'hidden' },
  hint: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '28%',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    textShadowColor: '#FFFFFF',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 0 },
  },
});
