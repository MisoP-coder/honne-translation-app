export const theme = {
  bg: '#F6F5F1',
  surface: '#FFFFFF',
  surfaceAlt: '#EDEBE3',
  ink: '#22242A',
  inkMuted: '#6E717A',
  accent: '#2F4858',
  accentSoft: '#E3EAEC',
  border: '#DEDBD2',
  safe: '#3F7A5C',
  safeSoft: '#E4EFE9',
  caution: '#A9793A',
  cautionSoft: '#F3EADA',
  danger: '#AE4A41',
  dangerSoft: '#F5E4E1',
};

export const FONT_BODY =
  "'Zen Kaku Gothic New','Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif";
export const FONT_HEAD = "'Shippori Mincho',serif";

export function riskColors(level) {
  if (level === '向上' || level === '平常') return { fg: theme.safe, bg: theme.safeSoft };
  if (level === '維持') return { fg: theme.accent, bg: theme.accentSoft };
  if (level === 'やや気まずい') return { fg: theme.caution, bg: theme.cautionSoft };
  return { fg: theme.danger, bg: theme.dangerSoft };
}

export const primaryBtn = {
  background: theme.accent,
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '12px 16px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: FONT_BODY,
};

export const ghostBtn = {
  background: 'transparent',
  color: theme.accent,
  border: `1px solid ${theme.border}`,
  borderRadius: 10,
  padding: '10px 14px',
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: FONT_BODY,
};

export const card = {
  background: theme.surface,
  border: `1px solid ${theme.border}`,
  borderRadius: 12,
  padding: 16,
};

export const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: 8,
  border: `1px solid ${theme.border}`,
  fontSize: 14,
  fontFamily: FONT_BODY,
};
