export const theme = {
  bg: '#F1F5FA',
  surface: '#FFFFFF',
  surfaceAlt: '#E9F0F8',
  ink: '#1C2836',
  inkMuted: '#5E7186',
  accent: '#2B6099',
  accentSoft: '#E1ECF7',
  border: '#D3E0EC',
  safe: '#276B55',
  safeSoft: '#E2F1EC',
  caution: '#8A5F28',
  cautionSoft: '#F6EDDF',
  danger: '#9E423C',
  dangerSoft: '#F7E5E3',
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
