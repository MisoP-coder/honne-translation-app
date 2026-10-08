import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { SoundManager } from './SoundManager';

interface SoundContextValue {
  manager: SoundManager;
  muted: boolean;
  setMuted: (muted: boolean) => void;
}

const SoundContext = createContext<SoundContextValue | null>(null);

interface Props {
  children: ReactNode;
  /** テスト用に差し替える */
  manager?: SoundManager;
}

/** アプリ全体で 1 つの SoundManager を持ち、起動時に読み込み、終了時に解放する */
export function SoundProvider({ children, manager: injected }: Props) {
  const manager = useMemo(() => injected ?? new SoundManager(), [injected]);
  const [muted, setMutedState] = useState(manager.isMuted);

  useEffect(() => {
    manager.load();
    // ブラウザは最初に画面に触れるまで音を出せないので、最初のタッチで BGM を鳴らし直す
    let removeUnlock = () => {};
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const unlock = () => {
        manager.unlock();
        removeUnlock();
      };
      document.addEventListener('pointerdown', unlock, true);
      document.addEventListener('keydown', unlock, true);
      removeUnlock = () => {
        document.removeEventListener('pointerdown', unlock, true);
        document.removeEventListener('keydown', unlock, true);
      };
    }
    return () => {
      removeUnlock();
      manager.dispose();
    };
  }, [manager]);

  const value = useMemo(
    () => ({
      manager,
      muted,
      setMuted: (next: boolean) => {
        manager.setMuted(next);
        setMutedState(next);
      },
    }),
    [manager, muted],
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

/** SoundProvider の外では null（音なしで動く） */
export function useSound(): SoundContextValue | null {
  return useContext(SoundContext);
}

/** 画面が表示されている間、指定した BGM を流す */
export function useBgm(name: 'bgm_title' | 'bgm_game' | null) {
  const sound = useSound();
  useEffect(() => {
    if (!sound) return;
    if (name) sound.manager.playBgm(name);
  }, [sound, name]);
}
