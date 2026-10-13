import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { useLineHighScore } from './src/highScore';
import { LineGameScreen } from './src/screens/LineGameScreen';
import { LineTitleScreen } from './src/screens/LineTitleScreen';
import { SoundProvider } from './src/shared/audio/SoundContext';
import type { SoundManager } from './src/shared/audio/SoundManager';
import { lineColors } from './src/theme';

interface Props {
  /** テスト用：音の管理を差し替える */
  soundManager?: SoundManager;
}

/** 要約の達人 〜上司の長文LINEを1文字で読め〜 */
export default function App({ soundManager }: Props) {
  const [screen, setScreen] = useState<'title' | 'game'>('title');
  const [gameKey, setGameKey] = useState(0);
  const { highScore, submit } = useLineHighScore();

  const start = () => {
    setGameKey((k) => k + 1);
    setScreen('game');
  };

  return (
    <SoundProvider manager={soundManager}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.root}>
          <StatusBar style="light" />
          {screen === 'title' && <LineTitleScreen highScore={highScore} onStart={start} />}
          {screen === 'game' && (
            <LineGameScreen
              key={gameKey}
              bestScore={highScore.bestScore}
              onGameOver={submit}
              onRetry={start}
              onTitle={() => setScreen('title')}
            />
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </SoundProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: lineColors.greenDeep },
});
