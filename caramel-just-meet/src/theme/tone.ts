/**
 * ゲームオーバー時の「セピア化」用の色変換。
 * CSS の filter はスマホ（特に iOS）では効かないので、描画する色そのものを変換する。
 * amount = 0 で元の色、1 で完全なセピア。
 */

function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function sepia(hex: string, amount: number): string {
  if (amount <= 0) return hex;
  const t = Math.min(1, amount);
  const [r, g, b] = parseHex(hex);
  // 明るさだけを取り出して、古い写真のような暗めの茶色に置き換える
  // （一般的なセピア行列だと明るい色が黄色っぽくなり、シリアスにならない）
  const l = (0.299 * r + 0.587 * g + 0.114 * b) * 0.82;
  const sr = l * 1.0 + 12;
  const sg = l * 0.86 + 6;
  const sb = l * 0.66;
  return toHex([r + (sr - r) * t, g + (sg - g) * t, b + (sb - b) * t]);
}

