import type { AudioSource } from 'expo-audio';

import { SoundManager } from '../audio/SoundManager';
import type { SoundName } from '../audio/sounds';

/**
 * 「要約の達人」の音。すべて scripts/generate_line_sounds.py で合成した自作の音源で、アプリに同梱している
 * （ネットの音源を直接読み込むと、リンク切れ・権利の確認・通信待ちで音がズレる、の心配があるため）。
 * 差し替えるときは、同じ名前のファイルを置き換えるか、ここで { uri: 'https://…' } を指定する。
 *
 * 音の管理はプリンゲームの SoundManager をそのまま使う（プリン側のコードは変えない）。
 * SoundManager は 'bgm_title' / 'bgm_game' という名前の音を BGM（ループ再生）として扱うので、
 * このゲームの BGM もその名前で登録している。効果音はプリンの音と名前がかぶらないよう line_ を付ける。
 */
export const LINE_SOUND_SOURCES = {
  bgm_title: require('../../assets/sounds/line/line_bgm_title.wav'),
  bgm_game: require('../../assets/sounds/line/line_bgm_game.wav'),
  line_catch_0: require('../../assets/sounds/line/line_catch_0.wav'),
  line_catch_1: require('../../assets/sounds/line/line_catch_1.wav'),
  line_catch_2: require('../../assets/sounds/line/line_catch_2.wav'),
  line_catch_3: require('../../assets/sounds/line/line_catch_3.wav'),
  line_catch_4: require('../../assets/sounds/line/line_catch_4.wav'),
  line_praise: require('../../assets/sounds/line/line_praise.wav'),
  line_hit: require('../../assets/sounds/line/line_hit.wav'),
  line_rage: require('../../assets/sounds/line/line_rage.wav'),
  line_calm: require('../../assets/sounds/line/line_calm.wav'),
  line_gameover: require('../../assets/sounds/line/line_gameover.wav'),
} as const;

export type LineSoundName = keyof typeof LINE_SOUND_SOURCES;
export type LineSeName = Exclude<LineSoundName, 'bgm_title' | 'bgm_game'>;

/** キャッチ音の段階数（コンボで音程が上がる） */
export const CATCH_TIERS = 5;
/** この連続数ごとに、脳汁音「キュインキュイン！」を重ねる */
export const PRAISE_SOUND_EVERY = 3;

export function catchSound(combo: number): LineSeName {
  const tier = Math.min(Math.max(combo - 1, 0), CATCH_TIERS - 1);
  return `line_catch_${tier}` as LineSeName;
}

/** キャッチしたときに鳴らす音 */
export function catchSounds(combo: number): LineSeName[] {
  if (combo >= PRAISE_SOUND_EVERY && combo % PRAISE_SOUND_EVERY === 0) return [catchSound(combo), 'line_praise'];
  return [catchSound(combo)];
}

/** このゲーム用の SoundManager を作る */
export function createLineSoundManager(create?: ConstructorParameters<typeof SoundManager>[0]): SoundManager {
  return new SoundManager(create, LINE_SOUND_SOURCES as unknown as Record<SoundName, AudioSource>);
}

/** このゲームの効果音を鳴らす（SoundManager の型はプリンの音の名前なので、ここで読み替える） */
export function playLineSe(manager: SoundManager | undefined, names: readonly LineSeName[]): void {
  manager?.playSes(names as unknown as SoundName[]);
}
