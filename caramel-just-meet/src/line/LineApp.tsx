import { useEffect, useMemo, useState } from 'react';

import { SoundProvider, useSound } from '../audio/SoundContext';
import type { SoundManager } from '../audio/SoundManager';

import { useLineHighScore } from './highScore';
import { LineGameScreen } from './screens/LineGameScreen';
import { LineTitleScreen } from './screens/LineTitleScreen';
import { createLineSoundManager } from './sounds';

type SoundContextValue = NonNullable<ReturnType<typeof useSound>>;

interface Props {
  /** プリンのゲームに戻る */
  onExit: () => void;
  /** テスト用：音の管理を差し替える */
  soundManager?: SoundManager;
}

/**
 * 「要約の達人 〜上司の長文LINEを1文字で読め〜」の入口。
 * プリンのゲームとは画面・ハイスコア・音をすべて分けている。
 * 音はこのゲーム専用の SoundManager を持ち、BGM と効果音の設定（オン・オフ・音量）だけはプリンと共通にする。
 */
export function LineApp({ onExit, soundManager }: Props) {
  const outer = useSound();
  const [screen, setScreen] = useState<'title' | 'game'>('title');
  const [gameKey, setGameKey] = useState(0);
  const { highScore, submit } = useLineHighScore();
  const manager = useMemo(() => {
    const m = soundManager ?? createLineSoundManager();
    // プリンのほうで決めた音の設定を引き継ぐ
    if (outer) m.applySettings(outer.settings);
    return m;
  }, [soundManager]); // eslint-disable-line react-hooks/exhaustive-deps

  // プリンの BGM を止める（プリンのタイトルに戻ると、また流れ出す）
  const outerManager = outer?.manager;
  useEffect(() => {
    outerManager?.stopBgm();
  }, [outerManager]);

  const start = () => {
    setGameKey((k) => k + 1);
    setScreen('game');
  };

  return (
    <SoundProvider manager={manager}>
      <SettingsBridge outer={outer} />
      {screen === 'title' && <LineTitleScreen highScore={highScore} onStart={start} onPudding={onExit} />}
      {screen === 'game' && (
        <LineGameScreen
          key={gameKey}
          bestScore={highScore.bestScore}
          onGameOver={submit}
          onRetry={start}
          onTitle={() => setScreen('title')}
        />
      )}
    </SoundProvider>
  );
}

/** このゲームで変えた音の設定を、プリンのほうにも反映する（プリンに戻ったときに元に戻らないように） */
function SettingsBridge({ outer }: { outer: SoundContextValue | null }) {
  const settings = useSound()?.settings;
  useEffect(() => {
    if (!outer || !settings) return;
    const o = outer.settings;
    if (
      o.bgmEnabled !== settings.bgmEnabled ||
      o.bgmVolume !== settings.bgmVolume ||
      o.seEnabled !== settings.seEnabled ||
      o.seVolume !== settings.seVolume
    ) {
      outer.updateSettings(settings);
    }
  }, [settings]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
