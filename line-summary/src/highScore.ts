import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

/** ハイスコアの保存場所 */
const KEY = 'line-summary/high-score/v1';

export interface LineHighScore {
  bestScore: number;
  bestCombo: number;
}

export const EMPTY_LINE_HIGH_SCORE: LineHighScore = { bestScore: 0, bestCombo: 0 };

export async function loadLineHighScore(): Promise<LineHighScore> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return EMPTY_LINE_HIGH_SCORE;
    const parsed = JSON.parse(raw) as Partial<LineHighScore>;
    return { bestScore: Number(parsed.bestScore) || 0, bestCombo: Number(parsed.bestCombo) || 0 };
  } catch {
    return EMPTY_LINE_HIGH_SCORE;
  }
}

async function saveLineHighScore(value: LineHighScore): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // 保存に失敗してもゲームは続けられる
  }
}

export function mergeLineHighScore(current: LineHighScore, result: { score: number; combo: number }) {
  const isNewRecord = result.score > current.bestScore;
  const next = {
    bestScore: Math.max(current.bestScore, result.score),
    bestCombo: Math.max(current.bestCombo, result.combo),
  };
  return { next, isNewRecord };
}

export function useLineHighScore() {
  const [highScore, setHighScore] = useState<LineHighScore>(EMPTY_LINE_HIGH_SCORE);
  const current = useRef<LineHighScore>(EMPTY_LINE_HIGH_SCORE);

  useEffect(() => {
    let alive = true;
    loadLineHighScore().then((loaded) => {
      if (!alive) return;
      // 読み込み中にプレイが終わっていても記録を失わないようにマージする
      const next = {
        bestScore: Math.max(loaded.bestScore, current.current.bestScore),
        bestCombo: Math.max(loaded.bestCombo, current.current.bestCombo),
      };
      current.current = next;
      setHighScore(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  /** 結果を記録し、ハイスコア更新なら true を返す */
  const submit = useCallback((result: { score: number; combo: number }) => {
    const { next, isNewRecord } = mergeLineHighScore(current.current, result);
    current.current = next;
    setHighScore(next);
    void saveLineHighScore(next);
    return isNewRecord;
  }, []);

  return { highScore, submit };
}
