import AsyncStorage from '@react-native-async-storage/async-storage';

/** BGM と効果音（SE）を別々にオン・オフ、音量調節する */
export interface SoundSettings {
  bgmEnabled: boolean;
  /** 0〜1 */
  bgmVolume: number;
  seEnabled: boolean;
  /** 0〜1 */
  seVolume: number;
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  bgmEnabled: true,
  bgmVolume: 0.8,
  seEnabled: true,
  seVolume: 0.8,
};

/** 音量ゲージの目盛りの数（0〜10 の 11 段階） */
export const VOLUME_STEPS = 10;

const KEY = 'caramel-just-meet/sound-settings/v1';

export function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return 0;
  // 目盛りにそろえて、0.1 刻みにする
  return Math.round(Math.min(1, Math.max(0, v)) * VOLUME_STEPS) / VOLUME_STEPS;
}

/** 保存されていた値を、壊れていても安全な設定に直す */
export function sanitizeSettings(raw: unknown): SoundSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof SoundSettings, unknown>>;
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  const vol = (v: unknown, d: number) => (typeof v === 'number' ? clampVolume(v) : d);
  return {
    bgmEnabled: bool(r.bgmEnabled, DEFAULT_SOUND_SETTINGS.bgmEnabled),
    bgmVolume: vol(r.bgmVolume, DEFAULT_SOUND_SETTINGS.bgmVolume),
    seEnabled: bool(r.seEnabled, DEFAULT_SOUND_SETTINGS.seEnabled),
    seVolume: vol(r.seVolume, DEFAULT_SOUND_SETTINGS.seVolume),
  };
}

export async function loadSoundSettings(): Promise<SoundSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? sanitizeSettings(JSON.parse(raw)) : DEFAULT_SOUND_SETTINGS;
  } catch {
    return DEFAULT_SOUND_SETTINGS;
  }
}

export async function saveSoundSettings(settings: SoundSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // 保存できなくても、今回のプレイ中の設定は効いている
  }
}
