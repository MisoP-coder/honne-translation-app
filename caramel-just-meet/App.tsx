import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { SoundProvider } from './src/audio/SoundContext';
import type { SoundManager } from './src/audio/SoundManager';
import { useHighScore } from './src/hooks/useHighScore';
import { usePlayer } from './src/hooks/usePlayer';
import { LineApp } from './src/line/LineApp';
import { createRankingRepository } from './src/ranking';
import { RankingError, type RankingRepository } from './src/ranking/types';
import { type GameResult, GameScreen } from './src/screens/GameScreen';
import { RankingScreen } from './src/screens/RankingScreen';
import { TitleScreen } from './src/screens/TitleScreen';
import { colors } from './src/theme/colors';

type Screen = 'title' | 'game' | 'ranking';
/** pudding：極限！カラメル・ジャスト・ミート／line：要約の達人 〜上司の長文LINEを1文字で読め〜 */
export type GameMode = 'pudding' | 'line';

/** ブラウザ版は ?game=line で「要約の達人」から始められる（URL を共有できるように） */
function initialGameMode(): GameMode {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'pudding';
  try {
    return new URLSearchParams(window.location?.search ?? '').get('game') === 'line' ? 'line' : 'pudding';
  } catch {
    return 'pudding';
  }
}

/** ブラウザ版は、遊んでいるゲームを URL にも反映する（再読み込みしても同じゲームに戻る） */
function syncGameModeToUrl(mode: GameMode) {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.history?.replaceState) return;
  try {
    const url = new URL(window.location.href);
    if (mode === 'line') url.searchParams.set('game', 'line');
    else url.searchParams.delete('game');
    window.history.replaceState(window.history.state, '', url.toString());
  } catch {
    // URL を書き換えられなくてもゲームは遊べる
  }
}

interface Props {
  /** Supabase などに繋ぐときはここに本物の実装を渡す */
  rankingRepository?: RankingRepository;
  /** テスト用：音の管理を差し替える */
  soundManager?: SoundManager;
  /** テスト用：「要約の達人」の音の管理を差し替える */
  lineSoundManager?: SoundManager;
  /** テスト用：最初に開くゲーム */
  initialGame?: GameMode;
}

export default function App({ rankingRepository, soundManager, lineSoundManager, initialGame }: Props) {
  const [gameMode, setGameMode] = useState<GameMode>(() => initialGame ?? initialGameMode());
  const [screen, setScreen] = useState<Screen>('title');
  const [gameKey, setGameKey] = useState(0);
  const { highScore, submit } = useHighScore();
  const { player, playerRef, updatePlayer } = usePlayer();
  const repository = useMemo(
    () => rankingRepository ?? createRankingRepository(),
    [rankingRepository],
  );

  const onGameOver = useCallback(
    (result: GameResult) => {
      const isNewRecord = submit(result);
      // ランキングに参加済みなら、自己ベストを更新したときに自動で登録する
      const p = playerRef.current;
      if (isNewRecord && p?.name) {
        void repository
          .submit({ playerId: p.playerId, name: p.name, flag: p.flag, ...result })
          .then((r) => updatePlayer({ publicId: r.publicId }))
          .catch(() => {});
      }
      return isNewRecord;
    },
    [repository, submit, playerRef, updatePlayer],
  );

  /** ランキング画面で名前を決めて、自己ベストを登録する */
  const register = useCallback(
    async (name: string) => {
      const p = playerRef.current;
      if (!p || highScore.bestScore <= 0) throw new RankingError('invalid-score', 'no record');
      const result = await repository.submit({
        playerId: p.playerId,
        name,
        flag: p.flag,
        score: highScore.bestScore,
        combo: highScore.bestScoreCombo,
      });
      updatePlayer({ name, publicId: result.publicId });
      return result;
    },
    [repository, playerRef, updatePlayer, highScore.bestScore, highScore.bestScoreCombo],
  );

  const startGame = () => {
    setGameKey((k) => k + 1);
    setScreen('game');
  };

  const switchGame = (mode: GameMode) => {
    setScreen('title');
    setGameMode(mode);
    syncGameModeToUrl(mode);
  };

  const best = useMemo(
    () =>
      highScore.bestScore > 0 ? { score: highScore.bestScore, combo: highScore.bestScoreCombo } : null,
    [highScore.bestScore, highScore.bestScoreCombo],
  );

  return (
    <SoundProvider manager={soundManager}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.root}>
          <StatusBar style="dark" />
          {gameMode === 'line' && (
            <LineApp soundManager={lineSoundManager} onExit={() => switchGame('pudding')} />
          )}
          {gameMode === 'pudding' && screen === 'title' && (
            <TitleScreen
              highScore={highScore}
              onStart={startGame}
              onRanking={() => setScreen('ranking')}
              onLineGame={() => switchGame('line')}
            />
          )}
          {gameMode === 'pudding' && screen === 'game' && (
            <GameScreen
              key={gameKey}
              bestScore={highScore.bestScore}
              onGameOver={onGameOver}
              onRanking={() => setScreen('ranking')}
              onTitle={() => setScreen('title')}
            />
          )}
          {gameMode === 'pudding' && screen === 'ranking' && (
            <RankingScreen
              repository={repository}
              best={best}
              player={player}
              onRegister={register}
              onBack={() => setScreen('title')}
            />
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </SoundProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
