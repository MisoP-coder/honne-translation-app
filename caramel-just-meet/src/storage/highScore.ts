import AsyncStorage from '@react-native-async-storage/async-storage';

import { comboForScore } from '../game/engine';

const KEY = 'caramel-just-meet/high-score/v1';

export interface HighScore {
  bestScore: number;
  /** 最高連続数（ハイスコアを出したゲームとは別のゲームのこともある） */
  bestCombo: number;
  /** ハイスコアを出したゲームの連続数（ランキングにはスコアとこの組で登録する） */
  bestScoreCombo: number;
}

export const EMPTY_HIGH_SCORE: HighScore = { bestScore: 0, bestCombo: 0, bestScoreCombo: 0 };

export async function loadHighScore(): Promise<HighScore> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return EMPTY_HIGH_SCORE;
    const parsed = JSON.parse(raw) as Partial<HighScore>;
    const bestScore = Number(parsed.bestScore) || 0;
    const bestCombo = Number(parsed.bestCombo) || 0;
    // 前のバージョンで保存したデータには bestScoreCombo がないので、スコアから求める
    const bestScoreCombo = Number(parsed.bestScoreCombo) || comboForScore(bestScore, bestCombo);
    return { bestScore, bestCombo, bestScoreCombo };
  } catch {
    return EMPTY_HIGH_SCORE;
  }
}

export async function saveHighScore(value: HighScore): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // 保存に失敗してもゲームは続けられるので無視する
  }
}

/** 今回の結果でハイスコアを更新する。スコアと最高連続数はそれぞれ別に更新 */
export function mergeHighScore(
  current: HighScore,
  result: { score: number; combo: number },
): { next: HighScore; isNewRecord: boolean } {
  const isNewRecord = result.score > current.bestScore;
  const next = {
    bestScore: Math.max(current.bestScore, result.score),
    bestCombo: Math.max(current.bestCombo, result.combo),
    bestScoreCombo: isNewRecord ? result.combo : current.bestScoreCombo,
  };
  return { next, isNewRecord };
}
