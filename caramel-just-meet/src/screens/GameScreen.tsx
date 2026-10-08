import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  type LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CaramelDrop } from '../components/CaramelDrop';
import { Dropper } from '../components/Dropper';
import { GameOverPanel } from '../components/GameOverPanel';
import { JudgePopup } from '../components/JudgePopup';
import { Pudding } from '../components/Pudding';
import {
  createConfig,
  createGame,
  type GameConfig,
  type GameState,
  puddingCenterX,
  step,
  tapDrop,
} from '../game/engine';
import { randomSeed } from '../game/rng';
import { useGameLoop } from '../hooks/useGameLoop';
import { shareToX } from '../share/xShare';
import { colors } from '../theme/colors';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

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
  const [isNewRecord, setIsNewRecord] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;
  const reported = useRef(false);

  const update = useCallback((next: GameState) => {
    gameRef.current = next;
    setGame(next);
  }, []);

  useGameLoop(
    (dt) => {
      if (!config) return;
      const prev = gameRef.current;
      const next = step(prev, config, dt);
      if (next !== prev) update(next);
    },
    config !== null && game.status !== 'over',
  );

  // ミスした瞬間に画面を揺らす
  useEffect(() => {
    if (game.status !== 'sliding') return;
    const seq = [10, -10, 7, -7, 3, 0].map((toValue) =>
      Animated.timing(shake, { toValue, duration: 45, useNativeDriver: USE_NATIVE_DRIVER }),
    );
    Animated.sequence(seq).start();
  }, [game.status, shake]);

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
    if (!config) return;
    const next = tapDrop(gameRef.current, config);
    if (next !== gameRef.current) update(next);
  };

  const retry = () => {
    reported.current = false;
    setIsNewRecord(false);
    update(createGame(randomSeed()));
  };

  return (
    <View style={styles.root}>
      <View style={styles.hud}>
        <View>
          <Text style={styles.hudLabel}>SCORE</Text>
          <Text style={styles.hudValue} testID="hud-score">
            {game.score}
          </Text>
        </View>
        <View style={styles.hudCenter}>
          <Text style={styles.hudLabel}>連続</Text>
          <Text style={[styles.hudValue, styles.combo]} testID="hud-combo">
            {game.combo}
          </Text>
        </View>
        <View style={styles.hudRight}>
          <Text style={styles.hudLabel}>BEST</Text>
          <Text style={styles.hudValue}>{Math.max(bestScore, game.score)}</Text>
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
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: shake }] }]}>
          {config && <Stage config={config} game={game} />}
        </Animated.View>
        {config && game.combo === 0 && !game.drop && game.status === 'playing' && (
          <Text style={styles.hint} pointerEvents="none">
            タップでカラメル投下！{'\n'}プリンの頂点を狙え
          </Text>
        )}
      </View>

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

function Stage({ config, game }: { config: GameConfig; game: GameState }) {
  const centerX = puddingCenterX(game, config);
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
      <Dropper x={config.dropperX} y={config.dropStartY} />
      <Pudding
        config={config}
        centerX={centerX}
        velocity={game.puddingVelocity}
        caramelCount={game.combo}
      />
      {game.drop && (
        <CaramelDrop testID="falling-drop" x={game.drop.x} y={game.drop.y} radius={config.dropRadius} />
      )}
      {slidingDrop && (
        <CaramelDrop
          testID="sliding-drop"
          x={slidingDrop.x}
          y={slidingDrop.y}
          radius={config.dropRadius}
          tilt={slidingDrop.tilt}
        />
      )}
      <JudgePopup event={game.lastJudge} x={centerX} y={config.puddingTopY} />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  hudCenter: { alignItems: 'center' },
  hudRight: { alignItems: 'flex-end' },
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
    color: colors.textSub,
  },
});
