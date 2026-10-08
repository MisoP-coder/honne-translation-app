import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { SoundProvider } from './src/audio/SoundContext';
import type { SoundManager } from './src/audio/SoundManager';
import { useHighScore } from './src/hooks/useHighScore';
import { usePlayer } from './src/hooks/usePlayer';
import { createRankingRepository } from './src/ranking';
import { RankingError, type RankingRepository } from './src/ranking/types';
import { type GameResult, GameScreen } from './src/screens/GameScreen';
import { RankingScreen } from './src/screens/RankingScreen';
import { TitleScreen } from './src/screens/TitleScreen';
import { colors } from './src/theme/colors';

type Screen = 'title' | 'game' | 'ranking';

interface Props {
  /** Supabase などに繋ぐときはここに本物の実装を渡す */
  rankingRepository?: RankingRepository;
  /** テスト用：音の管理を差し替える */
  soundManager?: SoundManager;
}

export default function App({ rankingRepository, soundManager }: Props) {
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
          {screen === 'title' && (
            <TitleScreen
              highScore={highScore}
              onStart={startGame}
              onRanking={() => setScreen('ranking')}
            />
          )}
          {screen === 'game' && (
            <GameScreen
              key={gameKey}
              bestScore={highScore.bestScore}
              onGameOver={onGameOver}
              onRanking={() => setScreen('ranking')}
              onTitle={() => setScreen('title')}
            />
          )}
          {screen === 'ranking' && (
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
