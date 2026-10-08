/**
 * 再現性のある乱数（mulberry32）。
 * ゲーム状態に乱数の内部状態を持たせることで、エンジンを純粋関数のまま保ち、
 * テストでは同じシードから同じ揺れ方を再現できるようにしている。
 */
export function nextRandom(state: number): { value: number; state: number } {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: next };
}

/** [min, max) の範囲の乱数を返す */
export function randomRange(
  state: number,
  min: number,
  max: number,
): { value: number; state: number } {
  const r = nextRandom(state);
  return { value: min + r.value * (max - min), state: r.state };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}
