import type { Judge } from '../game/engine';

/**
 * ゲームで使う音の一覧。すべて scripts/generate_sounds.py で合成した自作の音源で、アプリに同梱している。
 * （ネットから読み込まないので、オフラインでも鳴り、通信待ちで音がズレることもない）
 * 差し替えるときは、同じ名前のファイルを置き換えるか、ここで { uri: 'https://…' } を指定する。
 */
export const SOUND_SOURCES = {
  bgm_title: require('../../assets/sounds/bgm_title.wav'),
  bgm_game: require('../../assets/sounds/bgm_game.wav'),
  se_drop: require('../../assets/sounds/se_drop.wav'),
  se_perfect_0: require('../../assets/sounds/se_perfect_0.wav'),
  se_perfect_1: require('../../assets/sounds/se_perfect_1.wav'),
  se_perfect_2: require('../../assets/sounds/se_perfect_2.wav'),
  se_perfect_3: require('../../assets/sounds/se_perfect_3.wav'),
  se_perfect_4: require('../../assets/sounds/se_perfect_4.wav'),
  se_perfect_5: require('../../assets/sounds/se_perfect_5.wav'),
  se_perfect_6: require('../../assets/sounds/se_perfect_6.wav'),
  se_perfect_7: require('../../assets/sounds/se_perfect_7.wav'),
  se_good: require('../../assets/sounds/se_good.wav'),
  se_fever: require('../../assets/sounds/se_fever.wav'),
  se_jackpot: require('../../assets/sounds/se_jackpot.wav'),
  se_gameover: require('../../assets/sounds/se_gameover.wav'),
} as const;

export type SoundName = keyof typeof SOUND_SOURCES;
export type BgmName = 'bgm_title' | 'bgm_game';

export const BGM_NAMES: readonly BgmName[] = ['bgm_title', 'bgm_game'];

/** 音ごとの音量（BGM は効果音の邪魔をしないよう控えめ） */
export const VOLUMES: Partial<Record<SoundName, number>> = {
  bgm_title: 0.55,
  bgm_game: 0.45,
  se_drop: 0.7,
  se_good: 0.8,
  se_fever: 0.8,
};

/** JUST MEET の音の段階数（ド〜ドの長音階 8 音） */
export const PERFECT_TIERS = 8;
/** この連続数から「キュイィィン」を重ねる */
export const FEVER_SOUND_COMBO = 10;
/** この連続数から「確定！」音に切り替える */
export const JACKPOT_SOUND_COMBO = 20;

export function perfectSound(combo: number): SoundName {
  const tier = Math.min(Math.max(combo - 1, 0), PERFECT_TIERS - 1);
  return `se_perfect_${tier}` as SoundName;
}

/**
 * 着地したときに鳴らす音。
 * JUST MEET はコンボごとに音程が上がり（8 段階）、10 コンボからリーチ音を重ね、
 * 20 コンボからは「確定！」音に切り替わる。
 */
export function landingSounds(judge: Judge, combo: number): SoundName[] {
  if (judge === 'miss') return ['se_gameover'];
  if (judge === 'good') return ['se_good'];
  if (combo >= JACKPOT_SOUND_COMBO) return [perfectSound(combo), 'se_jackpot'];
  if (combo >= FEVER_SOUND_COMBO) return [perfectSound(combo), 'se_fever'];
  return [perfectSound(combo)];
}
