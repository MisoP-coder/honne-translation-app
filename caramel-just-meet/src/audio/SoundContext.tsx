import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { loadSoundSettings, saveSoundSettings, type SoundSettings } from './settings';
import { SoundManager } from './SoundManager';

interface SoundContextValue {
  manager: SoundManager;
  settings: SoundSettings;
  /** BGM / 効果音のオン・オフや音量を変える（端末に保存される） */
  updateSettings: (next: Partial<SoundSettings>) => void;
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
  const [settings, setSettings] = useState<SoundSettings>(manager.getSettings());
  const touchedRef = useRef<() => void>(() => {});

  useEffect(() => {
    manager.load();
    // 前回の音の設定を読み込む（読み込み中に変えられていたら、そちらを優先）
    let touched = false;
    let alive = true;
    loadSoundSettings().then((saved) => {
      if (!alive || touched) return;
      setSettings(manager.applySettings(saved));
    });
    touchedRef.current = () => {
      touched = true;
    };
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
      alive = false;
      removeUnlock();
      manager.dispose();
    };
  }, [manager]);

  const value = useMemo(
    () => ({
      manager,
      settings,
      updateSettings: (next: Partial<SoundSettings>) => {
        touchedRef.current();
        const applied = manager.applySettings(next);
        setSettings(applied);
        void saveSoundSettings(applied);
      },
    }),
    [manager, settings],
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

/** SoundProvider の外では null（音なしで動く） */
export function useSound(): SoundContextValue | null {
  return useContext(SoundContext);
}

/** 画面が表示されている間、指定した BGM を流す */
export function useBgm(name: 'bgm_title' | 'bgm_game' | null) {
  // 設定を変えるたびに鳴らし直さないよう、manager だけを見る
  const manager = useSound()?.manager;
  useEffect(() => {
    if (manager && name) manager.playBgm(name);
  }, [manager, name]);
}
