/**
 * 連続成功数に応じた「くだらない称号」。
 * min 以上の連続数で獲得（上から順に判定）。
 */
export interface TitleRank {
  min: number;
  title: string;
}

export const TITLES: readonly TitleRank[] = [
  { min: 100, title: '宇宙カラメル大統領' },
  { min: 50, title: 'プリン界の重力を統べる者' },
  { min: 30, title: 'カラメル神拳 伝承者' },
  { min: 20, title: 'プッチンの申し子' },
  { min: 15, title: '頂点を知る者' },
  { min: 10, title: 'ぷるぷるハンター' },
  { min: 5, title: 'カラメル職人（自称）' },
  { min: 3, title: '茶色い雫の運び屋' },
  { min: 1, title: 'プリン見習い' },
  { min: 0, title: 'カラメルを床に捧げし者' },
];

export function titleFor(combo: number): string {
  const n = Math.max(0, Math.floor(combo));
  return (TITLES.find((t) => n >= t.min) ?? TITLES[TITLES.length - 1]).title;
}
