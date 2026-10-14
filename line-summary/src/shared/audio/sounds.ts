/**
 * ゲームで使う音の一覧。すべて scripts/generate_sounds.py で合成した自作の音源で、アプリに同梱している
 * （ネットの音源を直接読み込むと、リンク切れ・利用条件の確認・通信待ちで音がズレる、の心配があるため）。
 * 差し替えるときは、同じ名前のファイルを置き換えるか、ここで { uri: 'https://…' } を指定する。
 */
export const SOUND_SOURCES = {
  bgm_title: require('../../../assets/sounds/line_bgm_title.wav'),
  bgm_game: require('../../../assets/sounds/line_bgm_game.wav'),
  se_catch_0: require('../../../assets/sounds/line_catch_0.wav'),
  se_catch_1: require('../../../assets/sounds/line_catch_1.wav'),
  se_catch_2: require('../../../assets/sounds/line_catch_2.wav'),
  se_catch_3: require('../../../assets/sounds/line_catch_3.wav'),
  se_catch_4: require('../../../assets/sounds/line_catch_4.wav'),
  se_praise: require('../../../assets/sounds/line_praise.wav'),
  se_hit: require('../../../assets/sounds/line_hit.wav'),
  se_rage: require('../../../assets/sounds/line_rage.wav'),
  se_calm: require('../../../assets/sounds/line_calm.wav'),
  se_gameover: require('../../../assets/sounds/line_gameover.wav'),
  se_tear: require('../../../assets/sounds/line_tear.wav'),
  se_none: require('../../../assets/sounds/line_none.wav'),
  se_clear: require('../../../assets/sounds/line_clear.wav'),
  se_fever: require('../../../assets/sounds/line_fever.wav'),
  se_rare: require('../../../assets/sounds/line_rare.wav'),
} as const;

export type SoundName = keyof typeof SOUND_SOURCES;
export type BgmName = 'bgm_title' | 'bgm_game';

export const BGM_NAMES: readonly BgmName[] = ['bgm_title', 'bgm_game'];

/** 音ごとの音量（BGM は効果音の邪魔をしないよう控えめ） */
export const VOLUMES: Partial<Record<SoundName, number>> = {
  bgm_title: 0.55,
  bgm_game: 0.45,
  se_none: 0.8,
};

/** キャッチ音の段階数（コンボで音程が上がる） */
export const CATCH_TIERS = 5;
/** この連続数ごとに、脳汁音「キュインキュイン！」を重ねる */
export const PRAISE_SOUND_EVERY = 3;

export function catchSound(combo: number): SoundName {
  const tier = Math.min(Math.max(combo - 1, 0), CATCH_TIERS - 1);
  return `se_catch_${tier}` as SoundName;
}

/** キャッチしたときに鳴らす音 */
export function catchSounds(combo: number): SoundName[] {
  if (combo >= PRAISE_SOUND_EVERY && combo % PRAISE_SOUND_EVERY === 0) return [catchSound(combo), 'se_praise'];
  return [catchSound(combo)];
}
