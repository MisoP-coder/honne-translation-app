import { useCallback, useEffect, useRef, useState } from 'react';

import {
  EMPTY_HIGH_SCORE,
  type HighScore,
  loadHighScore,
  mergeHighScore,
  saveHighScore,
} from '../storage/highScore';

export function useHighScore() {
  const [highScore, setHighScore] = useState<HighScore>(EMPTY_HIGH_SCORE);
  const current = useRef<HighScore>(EMPTY_HIGH_SCORE);

  useEffect(() => {
    let alive = true;
    loadHighScore().then((loaded) => {
      if (!alive) return;
      // 読み込み中にプレイが終わっていた場合も記録を失わないようにマージする
      const { next } = mergeHighScore(loaded, {
        score: current.current.bestScore,
        combo: current.current.bestCombo,
      });
      current.current = next;
      setHighScore(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  /** 結果を記録し、ハイスコア更新なら true を返す */
  const submit = useCallback((result: { score: number; combo: number }) => {
    const { next, isNewRecord } = mergeHighScore(current.current, result);
    current.current = next;
    setHighScore(next);
    void saveHighScore(next);
    return isNewRecord;
  }, []);

  return { highScore, submit };
}
