import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

/**
 * ランキングに参加する「この端末のプレイヤー」。ログインはせず、端末に保存する。
 * playerId は記録を更新するための合言葉で、誰にも見せない。
 */
export interface PlayerProfile {
  playerId: string;
  /** ランキングで自分の行を見分ける公開 ID（登録すると決まる） */
  publicId: string | null;
  /** ランキングに出す名前（未登録なら null） */
  name: string | null;
  flag: string;
}

export const NAME_MAX = 12;
const KEY = 'caramel-just-meet/player/v1';

/** 名前を整える。空白をまとめ、1〜12 文字でなければ null */
export function sanitizeName(raw: string): string | null {
  // eslint-disable-next-line no-control-regex
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  const length = Array.from(name).length;
  return length >= 1 && length <= NAME_MAX ? name : null;
}

/** 'ja-JP' → 🇯🇵。地域がわからなければ 🌏 */
export function flagFromLocale(locale: string | undefined): string {
  const region = locale?.match(/[-_]([A-Za-z]{2})(?:$|[-_])/)?.[1]?.toUpperCase();
  if (!region) return '🌏';
  return String.fromCodePoint(...Array.from(region).map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function currentLocale(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}

function newProfile(): PlayerProfile {
  return { playerId: randomUUID(), publicId: null, name: null, flag: flagFromLocale(currentLocale()) };
}

export async function loadPlayer(): Promise<PlayerProfile> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<PlayerProfile>;
      if (typeof p.playerId === 'string' && p.playerId.length >= 16) {
        return {
          playerId: p.playerId,
          publicId: typeof p.publicId === 'string' ? p.publicId : null,
          name: typeof p.name === 'string' ? sanitizeName(p.name) : null,
          flag: typeof p.flag === 'string' && p.flag ? p.flag : flagFromLocale(currentLocale()),
        };
      }
    }
  } catch {
    // 壊れていたら作り直す
  }
  const fresh = newProfile();
  await savePlayer(fresh);
  return fresh;
}

export async function savePlayer(profile: PlayerProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // 保存できなくても、今回は登録できる
  }
}
