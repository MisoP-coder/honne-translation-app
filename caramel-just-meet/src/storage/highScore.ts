import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'caramel-just-meet/high-score/v1';

export interface HighScore {
  bestScore: number;
  bestCombo: number;
}

export const EMPTY_HIGH_SCORE: HighScore = { bestScore: 0, bestCombo: 0 };

export async function loadHighScore(): Promise<HighScore> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return EMPTY_HIGH_SCORE;
    const parsed = JSON.parse(raw) as Partial<HighScore>;
    return {
      bestScore: Number(parsed.bestScore) || 0,
      bestCombo: Number(parsed.bestCombo) || 0,
    };
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
  const next = {
    bestScore: Math.max(current.bestScore, result.score),
    bestCombo: Math.max(current.bestCombo, result.combo),
  };
  return { next, isNewRecord: result.score > current.bestScore };
}
