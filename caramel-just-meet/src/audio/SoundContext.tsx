import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { loadSoundSettings, saveSoundSettings, type SoundSettings } from './settings';
import { SoundManager } from './SoundManager';

interface SoundContextValue {
  manager: SoundManager;
  settings: SoundSettings;
  /** BGM / 効果音のオン・オフや音量を変える（端末に保存される） */
  updateSettings: (next: Partial<SoundSettings>) => void;
  /** ブラウザで、まだ一度も画面に触れていない（＝音を出させてもらえない）とき true */
  needsTapForAudio: boolean;
}

/**
 * ブラウザが「ユーザーが操作した」と認めて音を出させてくれるイベント。
 * 指で触れた瞬間（pointerdown / touchstart）は認められず、指を離したとき（pointerup / touchend / click）に認められる。
 * iPhone の Safari は特に厳しく、これ以外のイベントで再生しようとすると失敗する。
 */
export const AUDIO_UNLOCK_EVENTS = ['pointerup', 'touchend', 'click', 'keydown'] as const;

function hasUserActivated(): boolean {
  const nav = typeof navigator !== 'undefined' ? (navigator as { userActivation?: { hasBeenActive?: boolean } }) : undefined;
  return nav?.userActivation?.hasBeenActive === true;
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
  const [needsTapForAudio, setNeedsTapForAudio] = useState(
    () => Platform.OS === 'web' && typeof document !== 'undefined' && !hasUserActivated(),
  );

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
    // ブラウザは最初に画面に触れるまで音を出せないので、触れたら BGM を鳴らし直す。
    // 1 回目でうまく鳴らなかったときのために、タップのたびに試す（鳴っていれば何もしない）
    let removeUnlock = () => {};
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const unlock = () => {
        manager.unlock();
        setNeedsTapForAudio(false);
      };
      const doc = document;
      for (const type of AUDIO_UNLOCK_EVENTS) doc.addEventListener(type, unlock, true);
      removeUnlock = () => {
        for (const type of AUDIO_UNLOCK_EVENTS) doc.removeEventListener(type, unlock, true);
      };
    }
    // 別のアプリ・別のタブに移ったり画面を消したりしたら音を止め、戻ったら続きから流す
    let removeBackground = () => {};
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const doc = document;
      const sync = () => (doc.visibilityState === 'hidden' ? manager.enterBackground() : manager.enterForeground());
      const hide = () => manager.enterBackground();
      doc.addEventListener('visibilitychange', sync);
      // iPhone の Safari は、タブを閉じたり履歴を移動したりしたときに visibilitychange が来ないことがある
      const win = typeof window !== 'undefined' && typeof window.addEventListener === 'function' ? window : null;
      win?.addEventListener('pagehide', hide);
      win?.addEventListener('pageshow', sync);
      if (doc.visibilityState === 'hidden') manager.enterBackground();
      removeBackground = () => {
        doc.removeEventListener('visibilitychange', sync);
        win?.removeEventListener('pagehide', hide);
        win?.removeEventListener('pageshow', sync);
      };
    } else {
      const sub = AppState.addEventListener('change', (state) =>
        state === 'active' ? manager.enterForeground() : manager.enterBackground(),
      );
      removeBackground = () => sub.remove();
    }
    return () => {
      alive = false;
      removeUnlock();
      removeBackground();
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
      needsTapForAudio,
    }),
    [manager, settings, needsTapForAudio],
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
