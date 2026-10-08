import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { SoundProvider } from './src/audio/SoundContext';
import type { SoundManager } from './src/audio/SoundManager';
import { useHighScore } from './src/hooks/useHighScore';
import { MockRankingRepository } from './src/ranking/mockRanking';
import type { RankingRepository } from './src/ranking/types';
import { type GameResult, GameScreen } from './src/screens/GameScreen';
import { RankingScreen } from './src/screens/RankingScreen';
import { TitleScreen } from './src/screens/TitleScreen';
import { colors } from './src/theme/colors';

type Screen = 'title' | 'game' | 'ranking';

export const PLAYER_NAME = 'あなた';

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
  const repository = useMemo(
    () => rankingRepository ?? new MockRankingRepository(undefined, 400),
    [rankingRepository],
  );

  const onGameOver = useCallback(
    (result: GameResult) => {
      const isNewRecord = submit(result);
      if (isNewRecord) {
        void repository.submit({ name: PLAYER_NAME, ...result }).catch(() => {});
      }
      return isNewRecord;
    },
    [repository, submit],
  );

  const startGame = () => {
    setGameKey((k) => k + 1);
    setScreen('game');
  };

  const myRecord =
    highScore.bestScore > 0
      ? { name: PLAYER_NAME, score: highScore.bestScore, combo: highScore.bestCombo }
      : null;

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
              myRecord={myRecord}
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
