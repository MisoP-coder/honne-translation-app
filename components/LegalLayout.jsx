import Link from 'next/link';

import { theme, FONT_HEAD } from '@/lib/theme';
import { OPERATOR, LEGAL_UPDATED_AT } from '@/lib/constants';

export const legalStyles = {
  h2: {
    fontFamily: FONT_HEAD,
    fontSize: 16,
    fontWeight: 700,
    color: theme.ink,
    margin: '28px 0 10px',
  },
  p: { fontSize: 13, lineHeight: 2, color: theme.ink, margin: '0 0 10px' },
  ul: { fontSize: 13, lineHeight: 2, color: theme.ink, margin: '0 0 10px', paddingLeft: 20 },
  note: { fontSize: 12, lineHeight: 1.9, color: theme.inkMuted, margin: '0 0 10px' },
};

export default function LegalLayout({ title, children }) {
  const missingOperator = !OPERATOR.name || !OPERATOR.contact;

  return (
    <div className="ht-shell">
      <Link
        href="/"
        style={{
          display: 'inline-block',
          color: theme.inkMuted,
          fontSize: 13,
          textDecoration: 'none',
          marginBottom: 14,
        }}
      >
        ← トップに戻る
      </Link>

      <h1 style={{ fontFamily: FONT_HEAD, fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>
        {title}
      </h1>
      <p style={{ fontSize: 12, color: theme.inkMuted, margin: '0 0 8px' }}>
        最終更新日: {LEGAL_UPDATED_AT}
      </p>

      {missingOperator && (
        <p
          style={{
            fontSize: 12,
            lineHeight: 1.8,
            color: theme.caution,
            background: theme.cautionSoft,
            padding: 12,
            borderRadius: 8,
            margin: '0 0 8px',
          }}
        >
          運営者名と連絡先が未記入です。公開前に <code>lib/constants.js</code> の{' '}
          <code>OPERATOR</code> を書き換えてください。
        </p>
      )}

      {children}

      <div
        style={{
          marginTop: 32,
          paddingTop: 16,
          borderTop: `1px solid ${theme.border}`,
          fontSize: 12,
          color: theme.inkMuted,
          lineHeight: 2,
        }}
      >
        <p style={{ margin: 0 }}>運営者: {OPERATOR.name || '(未記入)'}</p>
        <p style={{ margin: 0 }}>
          お問い合わせ:{' '}
          {OPERATOR.contact ? (
            <a href={`mailto:${OPERATOR.contact}`} style={{ color: theme.accent }}>
              {OPERATOR.contact}
            </a>
          ) : (
            '(未記入)'
          )}
        </p>
      </div>

      <div style={{ marginTop: 20, display: 'flex', gap: 16, fontSize: 12 }}>
        <Link href="/privacy" style={{ color: theme.accent }}>
          プライバシーポリシー
        </Link>
        <Link href="/terms" style={{ color: theme.accent }}>
          利用規約
        </Link>
      </div>
    </div>
  );
}
