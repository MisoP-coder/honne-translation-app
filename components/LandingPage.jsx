import Link from 'next/link';

import SceneIllustration from '@/components/SceneIllustration';
import { theme, FONT_HEAD, primaryBtn, card } from '@/lib/theme';

/** 初めて来た人に、何が出てくるかを見せるためのサンプル。実際の生成結果ではない */
const SAMPLE = {
  situation: '納期に3日遅れそうで、今日中に伝えないといけない',
  channel: 'メール',
  type: '結論先出し・簡潔報告型',
  message:
    '件名: 〇〇案件の納期についてのご相談\n\n田中課長\n\nお疲れさまです。〇〇案件について、現状のままですと納期を3日ほど超過する見込みです。原因と挽回案をまとめましたので、本日中に15分ほどお時間をいただけないでしょうか。',
  trust: '維持',
  tone: '平常',
};

const STEPS = [
  { title: '上司を登録する', body: '呼び名と、5つの質問に答えるだけ。30秒で終わります。' },
  { title: '状況を書く', body: '「納期に遅れそう」のような、思いつくままの一文で大丈夫です。' },
  { title: '3つの言い方が出る', body: 'それぞれが信頼や関係にどう響くかの予測つきで並びます。' },
];

const REASONS = [
  {
    title: '相手に合わせて変わります',
    body: '「結論から聞きたい人」と「経緯から聞きたい人」では、刺さる順番が違います。登録した5つの特性をもとに書き分けます。',
  },
  {
    title: '伝え方も選べます',
    body: '対面・電話・メール・チャットから選ぶと、その手段でそのまま使える文章になります。メールなら件名から、電話なら時間の確認から。',
  },
  {
    title: '使うほど、その上司に近づきます',
    body: '「うまくいった / 様子見 / こじれた」を記録すると、3件たまった時点で一般論ではなく、あなたとその上司の実績をもとに予測するようになります。',
  },
];

export default function LandingPage() {
  const cta = {
    ...primaryBtn,
    display: 'block',
    width: '100%',
    textAlign: 'center',
    textDecoration: 'none',
    padding: '15px 16px',
    fontSize: 15,
  };
  const sectionTitle = {
    fontFamily: FONT_HEAD,
    fontSize: 17,
    fontWeight: 700,
    margin: '0 0 14px',
    color: theme.ink,
  };

  return (
    <div className="ht-shell">
      {/* ヒーロー */}
      <div style={{ textAlign: 'center', paddingTop: 8 }}>
        <h1
          style={{
            fontFamily: FONT_HEAD,
            fontSize: 26,
            fontWeight: 700,
            margin: '0 0 10px',
            lineHeight: 1.4,
          }}
        >
          言いにくいことの翻訳
        </h1>
        <p style={{ fontSize: 15, color: theme.accent, fontWeight: 700, margin: '0 0 6px' }}>
          「これ、どう伝えよう…」を、3つの言い方に。
        </p>
        <p style={{ fontSize: 13, color: theme.inkMuted, margin: '0 0 16px', lineHeight: 1.8 }}>
          上司への報告や相談を、相手のタイプに合わせた
          <br />
          言い方に翻訳します。
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <SceneIllustration width={280} />
        </div>
      </div>

      <Link href="/login" style={cta}>
        無料ではじめる
      </Link>
      <p
        style={{
          fontSize: 11,
          color: theme.inkMuted,
          textAlign: 'center',
          margin: '10px 0 32px',
        }}
      >
        メールアドレスとパスワードだけ。30秒で始められます。
      </p>

      {/* 生成例。初めての人が一番知りたいのは「何が出てくるか」 */}
      <h2 style={sectionTitle}>こんな文章が出てきます</h2>
      <div style={{ ...card, marginBottom: 10, background: theme.surfaceAlt, border: 'none' }}>
        <p style={{ margin: '0 0 6px', fontSize: 11, color: theme.inkMuted }}>入力した状況</p>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7 }}>{SAMPLE.situation}</p>
        <p style={{ margin: '8px 0 0', fontSize: 11, color: theme.inkMuted }}>
          伝え方: {SAMPLE.channel}
        </p>
      </div>

      <div style={{ ...card, borderColor: theme.accent, borderWidth: 2, marginBottom: 12 }}>
        <span
          style={{
            display: 'inline-block',
            background: theme.accentSoft,
            color: theme.accent,
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 6,
            marginBottom: 8,
          }}
        >
          おすすめ
        </span>
        <p style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600 }}>{SAMPLE.type}</p>
        <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
          {SAMPLE.message}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <span
            style={{
              fontSize: 12,
              padding: '4px 10px',
              borderRadius: 6,
              background: theme.accentSoft,
              color: theme.accent,
            }}
          >
            信頼:{SAMPLE.trust}
          </span>
          <span
            style={{
              fontSize: 12,
              padding: '4px 10px',
              borderRadius: 6,
              background: theme.safeSoft,
              color: theme.safe,
            }}
          >
            温度感:{SAMPLE.tone}
          </span>
        </div>
      </div>
      <p style={{ fontSize: 11, color: theme.inkMuted, margin: '0 0 32px', lineHeight: 1.7 }}>
        実際にはトーンの違う3案が並び、それぞれに「なぜそう予測したか」が付きます。
      </p>

      {/* 使い方 */}
      <h2 style={sectionTitle}>使い方</h2>
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
        {STEPS.map((step, i) => (
          <div key={step.title} style={{ display: 'flex', gap: 10 }}>
            <span
              style={{
                flexShrink: 0,
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: theme.accentSoft,
                color: theme.accent,
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {i + 1}
            </span>
            <div>
              <p style={{ margin: '2px 0 4px', fontSize: 14, fontWeight: 600 }}>{step.title}</p>
              <p style={{ margin: 0, fontSize: 12, color: theme.inkMuted, lineHeight: 1.8 }}>
                {step.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 特徴 */}
      <h2 style={sectionTitle}>ただの文章生成と違うところ</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
        {REASONS.map((r) => (
          <div key={r.title} style={card}>
            <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600 }}>{r.title}</p>
            <p style={{ margin: 0, fontSize: 12, color: theme.inkMuted, lineHeight: 1.8 }}>
              {r.body}
            </p>
          </div>
        ))}
      </div>

      {/* 安心材料。上司の話を書く以上、ここが不安の中心になる */}
      <h2 style={sectionTitle}>入力した内容について</h2>
      <div style={{ ...card, marginBottom: 32 }}>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: theme.ink, lineHeight: 2 }}>
          <li>書いた内容は、あなたのアカウントからしか見られません</li>
          <li>上司本人に通知が届くことはありません</li>
          <li>記録した実績は、いつでも自分で削除できます</li>
        </ul>
      </div>

      <Link href="/login" style={cta}>
        無料ではじめる
      </Link>
      <p
        style={{
          fontSize: 11,
          color: theme.inkMuted,
          textAlign: 'center',
          margin: '10px 0 0',
        }}
      >
        すでに登録済みの方も、こちらからログインできます。
      </p>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
          marginTop: 28,
          paddingTop: 16,
          borderTop: `1px solid ${theme.border}`,
          fontSize: 12,
        }}
      >
        <Link href="/privacy" style={{ color: theme.inkMuted }}>
          プライバシーポリシー
        </Link>
        <Link href="/terms" style={{ color: theme.inkMuted }}>
          利用規約
        </Link>
      </div>
    </div>
  );
}
