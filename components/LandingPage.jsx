import Link from 'next/link';

import { theme, FONT_HEAD, primaryBtn, card } from '@/lib/theme';
import { RECORDS_THRESHOLD, FREE_UNTIL } from '@/lib/constants';

/**
 * ヒーローに並べる2枚の場面イラスト。
 * 「上司の話だけのアプリ」と思われないよう、先生の場面も同じ大きさで見せる。
 */
const SCENES = [
  {
    src: '/scene-boss.jpg',
    caption: '職場の上司に',
    alt: '資料を持って立ち、机に座る上司に言いにくい報告をしている会社員のイラスト',
  },
  {
    src: '/scene-teacher.jpg',
    caption: '園・学校の先生に',
    alt: '教室の前で担任の先生に話しかけようとしている保護者のイラスト',
  },
];

/**
 * 初めて来た人に、何が出てくるかを見せるためのサンプル。実際の生成結果ではない。
 * 上司と先生を1つずつ並べるのは、「自分の場面もある」と一目で分かってもらうため。
 */
const SAMPLES = [
  {
    who: '職場の上司へ',
    situation: '納期に3日遅れそうで、今日中に伝えないといけない',
    channel: 'メール',
    type: '結論先出し・簡潔報告型',
    message:
      '件名: 〇〇案件の納期についてのご相談\n\n田中課長\n\nお疲れさまです。〇〇案件について、現状のままですと納期を3日ほど超過する見込みです。原因と挽回案をまとめましたので、本日中に15分ほどお時間をいただけないでしょうか。',
    trustLabel: '信頼',
    trust: '維持',
    toneLabel: '温度感',
    tone: '平常',
  },
  {
    who: '園・学校の先生へ',
    situation: '持ち物の連絡が配布物と食い違っていて子どもが困っている',
    channel: '連絡帳',
    type: '標準',
    message:
      '山田先生\n\nいつもお世話になっております。\n\n体育の持ち物について、連絡帳の記載と配布物の内容が異なっているようでした。お忙しいところ恐縮ですが、どちらが正しいかご確認いただけますと助かります。',
    trustLabel: '関係性',
    trust: '維持',
    toneLabel: '受け取られ方',
    tone: '平常',
  },
];

const STEPS = [
  {
    title: '相手を登録する',
    body: '職場の上司か、園・学校の先生か。呼び名といくつかの設問に答えるだけ。30秒で終わります。',
  },
  {
    title: '状況を書く',
    body: '「納期に遅れそう」「持ち物の連絡が食い違っている」のような、思いつくままの一文で大丈夫です。',
  },
  { title: '3つの言い方が出る', body: 'それぞれが関係にどう響くかの予測つきで並びます。' },
];

const REASONS = [
  {
    title: '相手に合わせて変わります',
    body: '同じ内容でも、相手によって刺さる順番は違います。上司なら「結論から聞きたい人か、経緯から聞きたい人か」。先生なら「担任か管理職か」「話しやすい相手かどうか」。登録した回答をもとに書き分けます。',
  },
  {
    title: '伝え方も選べます',
    body: '上司なら対面・電話・メール・チャット。先生なら連絡帳・口頭・電話・メール。選んだ手段でそのまま使える文章になります。連絡帳なら手で書き写せる長さに、メールなら件名から。',
  },
  {
    title: '強さを選べます',
    body: '先生に伝える場合は「控えめ / 標準 / はっきり」の3段階で出ます。断定を避けて事実の確認をお願いする形に整えるので、強く言いすぎて関係がこじれるのを防げます。',
  },
  {
    title: '使うほど、その相手に近づきます',
    body: `「うまくいった / 様子見 / こじれた」を記録すると、${RECORDS_THRESHOLD}件たまった時点で一般論ではなく、あなたとその相手の実績をもとに予測するようになります。`,
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
          言いにくい報告や相談を、相手に合わせた
          <br />
          言い方に翻訳します。
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginBottom: 20,
          }}
        >
          {SCENES.map((scene) => (
            <div key={scene.src}>
              <img
                src={scene.src}
                alt={scene.alt}
                width={800}
                height={600}
                style={{
                  display: 'block',
                  width: '100%',
                  height: 'auto',
                  aspectRatio: '4 / 3',
                  objectFit: 'cover',
                  borderRadius: 10,
                  border: `1px solid ${theme.border}`,
                }}
              />
              <p
                style={{
                  margin: '6px 0 0',
                  fontSize: 12,
                  fontWeight: 700,
                  color: theme.inkMuted,
                }}
              >
                {scene.caption}
              </p>
            </div>
          ))}
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
      <p
        style={{
          fontSize: 12,
          color: theme.accent,
          fontWeight: 700,
          textAlign: 'center',
          margin: '-22px 0 32px',
        }}
      >
        {FREE_UNTIL}まで無料で使えます
      </p>

      {/* 生成例。初めての人が一番知りたいのは「何が出てくるか」 */}
      <h2 style={sectionTitle}>こんな文章が出てきます</h2>
      {SAMPLES.map((sample) => (
        <div key={sample.who} style={{ marginBottom: 20 }}>
          <p
            style={{
              margin: '0 0 8px',
              fontSize: 13,
              fontWeight: 700,
              color: theme.accent,
            }}
          >
            {sample.who}
          </p>

          <div style={{ ...card, marginBottom: 10, background: theme.surfaceAlt, border: 'none' }}>
            <p style={{ margin: '0 0 6px', fontSize: 11, color: theme.inkMuted }}>入力した状況</p>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7 }}>{sample.situation}</p>
            <p style={{ margin: '8px 0 0', fontSize: 11, color: theme.inkMuted }}>
              伝え方: {sample.channel}
            </p>
          </div>

          <div style={{ ...card, borderColor: theme.accent, borderWidth: 2 }}>
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
            <p style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600 }}>{sample.type}</p>
            <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {sample.message}
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
                {sample.trustLabel}:{sample.trust}
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
                {sample.toneLabel}:{sample.tone}
              </span>
            </div>
          </div>
        </div>
      ))}
      <p style={{ fontSize: 11, color: theme.inkMuted, margin: '0 0 32px', lineHeight: 1.7 }}>
        実際にはトーンの違う3案が並び、それぞれに「なぜそう予測したか」が付きます。出てくるのは案なので、送る前にご自身で読み直してお使いください。
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

      {/* 安心材料。上司や先生の話を書く以上、ここが不安の中心になる */}
      <h2 style={sectionTitle}>入力した内容について</h2>
      <div style={{ ...card, marginBottom: 32 }}>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: theme.ink, lineHeight: 2 }}>
          <li>書いた内容は、あなたのアカウントからしか見られません</li>
          <li>上司や先生に通知が届くことはありません</li>
          <li>記録した実績は、いつでも自分で削除できます</li>
        </ul>
        <p style={{ margin: '10px 0 0', fontSize: 11, color: theme.inkMuted, lineHeight: 1.8 }}>
          なお、提示されるのは案であり、実際の相手の反応を保証するものではありません。利用によって生じた職場での結果について、運営者は責任を負いかねます。
        </p>
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
