import { useEffect, useRef } from 'react';

/** 1フレームの最大経過時間。バックグラウンド復帰時などに世界がワープしないように */
const MAX_DT = 1 / 30;

/** requestAnimationFrame でフレームごとに onFrame(dt秒) を呼ぶ */
export function useGameLoop(onFrame: (dt: number) => void, running: boolean) {
  const callback = useRef(onFrame);
  callback.current = onFrame;

  useEffect(() => {
    if (!running) return;
    let rafId = 0;
    let last: number | null = null;
    const loop = (now: number) => {
      if (last !== null) {
        const dt = Math.min((now - last) / 1000, MAX_DT);
        if (dt > 0) callback.current(dt);
      }
      last = now;
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [running]);
}
