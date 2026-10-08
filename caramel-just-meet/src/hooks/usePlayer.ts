import { useCallback, useEffect, useRef, useState } from 'react';

import { loadPlayer, type PlayerProfile, savePlayer } from '../ranking/player';

/** この端末のプレイヤー情報（ランキング用の合言葉・名前）。端末に保存する */
export function usePlayer() {
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const ref = useRef<PlayerProfile | null>(null);

  useEffect(() => {
    let alive = true;
    loadPlayer().then((p) => {
      if (!alive) return;
      ref.current = p;
      setPlayer(p);
    });
    return () => {
      alive = false;
    };
  }, []);

  const updatePlayer = useCallback((patch: Partial<PlayerProfile>) => {
    if (!ref.current) return;
    const next = { ...ref.current, ...patch };
    ref.current = next;
    setPlayer(next);
    void savePlayer(next);
  }, []);

  return { player, playerRef: ref, updatePlayer };
}
