import React, { useState, useEffect } from 'react';

const theme = {
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

const FONT_BODY = "'Zen Kaku Gothic New','Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif";
const FONT_HEAD = "'Shippori Mincho',serif";

const TRAIT_QUESTIONS = [
  { key: 'reaction', label: '反応のタイプ', options: ['感情的', '冷静'] },
  { key: 'order', label: '聞きたい順番', options: ['結論から', '経緯から'] },
  { key: 'channel', label: '好む連絡手段', options: ['対面・電話', 'チャット・メール'] },
  { key: 'detail', label: '確認の細かさ', options: ['細かく確認したい', '任せてほしい'] },
  { key: 'mistake', label: 'ミスへの反応', options: ['厳しめ', '寛容め'] },
];

const LOADING_MESSAGES = ['上司のタイプを確認中…', '言い回しの候補を作成中…', '関係性への影響を予測中…'];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function riskColors(level) {
  if (level === '向上' || level === '平常') return { fg: theme.safe, bg: theme.safeSoft };
  if (level === '維持') return { fg: theme.accent, bg: theme.accentSoft };
  if (level === 'やや気まずい') return { fg: theme.caution, bg: theme.cautionSoft };
  return { fg: theme.danger, bg: theme.dangerSoft };
}

function emptyTraits() {
  return {
    reaction: '冷静',
    order: '結論から',
    channel: 'チャット・メール',
    detail: '任せてほしい',
    mistake: '寛容め',
  };
}

export default function HonneTranslationApp() {
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState('home');
  const [profiles, setProfiles] = useState([]);
  const [records, setRecords] = useState([]);

  const [editingProfile, setEditingProfile] = useState(null);
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [situation, setSituation] = useState('');
  const [loadingStep, setLoadingStep] = useState(0);
  const [candidates, setCandidates] = useState(null);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [outcomes, setOutcomes] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      let p = [];
      let r = [];
      try {
        const res = await window.storage.get('boss-profiles');
        p = res ? JSON.parse(res.value) : [];
      } catch (e) {
        p = [];
      }
      try {
        const res = await window.storage.get('records');
        r = res ? JSON.parse(res.value) : [];
      } catch (e) {
        r = [];
      }
      setProfiles(p);
      setRecords(r);
      setLoaded(true);
    })();
  }, []);

  const saveProfiles = async (next) => {
    setProfiles(next);
    try {
      await window.storage.set('boss-profiles', JSON.stringify(next));
    } catch (e) {
      /* best effort */
    }
  };

  const saveRecords = async (next) => {
    setRecords(next);
    try {
      await window.storage.set('records', JSON.stringify(next));
    } catch (e) {
      /* best effort */
    }
  };

  const startNewProfile = () => {
    setEditingProfile({ id: uid(), name: '', traits: emptyTraits(), note: '' });
    setView('profileForm');
  };

  const startEditProfile = (profile) => {
    setEditingProfile({ ...profile, traits: { ...profile.traits } });
    setView('profileForm');
  };

  const saveProfile = () => {
    if (!editingProfile || !editingProfile.name.trim()) return;
    const exists = profiles.some((p) => p.id === editingProfile.id);
    const next = exists
      ? profiles.map((p) => (p.id === editingProfile.id ? editingProfile : p))
      : [...profiles, editingProfile];
    saveProfiles(next);
    setView('home');
  };

  const startInput = (profileId) => {
    setSelectedProfileId(profileId);
    setSituation('');
    setCandidates(null);
    setOutcomes({});
    setError(null);
    setView('input');
  };

  const runAnalysis = async () => {
    const profile = profiles.find((p) => p.id === selectedProfileId);
    if (!profile || !situation.trim()) return;
    setView('loading');
    setLoadingStep(0);
    setError(null);

    const stepTimer = setInterval(() => {
      setLoadingStep((s) => (s < LOADING_MESSAGES.length - 1 ? s + 1 : s));
    }, 650);

    const profileRecords = records.filter((r) => r.profileId === profile.id);
    const useRecords = profileRecords.length >= 3;
    const recordsText = profileRecords
      .slice(-8)
      .map(
        (r, i) => `${i + 1}. 状況: ${r.situation} / 使った言い方: ${r.message} / 結果: ${r.outcome}`
      )
      .join('\n');

    const systemPrompt =
      'あなたは、日本企業で働く会社員が上司に言いにくい報告・相談をする際に、言い方の候補とそのリスク予測を提示するアシスタントです。\n\n' +
      '# 判断の優先順位\n' +
      '1. 実績データ(このユーザーがこの上司に過去使った言い方とその結果)が3件以上ある場合、それを最優先の判断材料とする。\n' +
      '2. 実績データが3件未満、または存在しない場合は、一般的なビジネスコミュニケーションの定石を土台とし、上司プロフィールの回答で補正する。\n\n' +
      '# 出力ルール\n' +
      '- 言い方の候補を3つ提示する。トーンが明確に異なるものにすること\n' +
      '- 各候補の message は、そのままコピペして使える完成した文章にする\n' +
      '- 各候補に対し、以下の観点でリスクを予測する\n' +
      '  - trust(信頼への影響): level は 向上・維持・低下 のいずれか、reason は短い理由\n' +
      '  - tone(関係の温度感): level は 平常・やや気まずい・悪化 のいずれか、reason は短い理由\n' +
      '  - follow_up: 今後求められそうな対応を1文で\n' +
      '- 3つの候補のうち、最も適切と考えられるものに recommended: true を付ける(他は false)\n' +
      '- 出力は下記のJSON形式のみ。前置き・説明文・コードブロック記法は一切含めない\n\n' +
      '{"candidates":[{"type":"文字列","message":"文字列","recommended":true,"risk":{"trust":{"level":"文字列","reason":"文字列"},"tone":{"level":"文字列","reason":"文字列"},"follow_up":"文字列"}}]}';

    const userPrompt =
      '# 上司プロフィール\n' +
      `反応のタイプ: ${profile.traits.reaction}\n` +
      `聞きたい順番: ${profile.traits.order}\n` +
      `好む連絡手段: ${profile.traits.channel}\n` +
      `確認の細かさ: ${profile.traits.detail}\n` +
      `ミスへの反応: ${profile.traits.mistake}\n` +
      `地雷ワード・NGな言い方: ${profile.note ? profile.note : '特になし'}\n\n` +
      `# 実績データ${useRecords ? '' : '(3件未満のため参考程度とし、判断の主軸にはしないこと)'}\n` +
      `${recordsText || 'なし'}\n\n` +
      '# 今回の状況\n' +
      `${situation}\n\n` +
      '上記を踏まえて、指定のJSON形式で言い方の候補とリスク予測を出力してください。';

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      const data = await response.json();
      const text = (data.content || [])
        .map((b) => (b.type === 'text' ? b.text : ''))
        .join('\n')
        .trim();
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      clearInterval(stepTimer);
      setCandidates(parsed.candidates || []);
      setExpandedIdx(null);
      setView('results');
    } catch (e) {
      clearInterval(stepTimer);
      setError('候補の生成に失敗しました。もう一度お試しください。');
      setView('input');
    }
  };

  const recordOutcome = async (idx, candidate, outcome) => {
    setOutcomes((prev) => ({ ...prev, [idx]: outcome }));
    const next = [
      ...records,
      {
        profileId: selectedProfileId,
        situation,
        message: candidate.message,
        type: candidate.type,
        outcome,
        timestamp: Date.now(),
      },
    ];
    await saveRecords(next);
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      /* clipboard may be unavailable in this environment */
    }
  };

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);

  const page = {
    minHeight: 480,
    background: theme.bg,
    fontFamily: FONT_BODY,
    color: theme.ink,
    padding: '20px 16px 32px',
    boxSizing: 'border-box',
  };

  const h1 = { fontFamily: FONT_HEAD, fontSize: 22, fontWeight: 700, margin: '0 0 4px' };
  const sub = { fontSize: 13, color: theme.inkMuted, margin: '0 0 20px' };
  const primaryBtn = {
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
  const ghostBtn = {
    background: 'transparent',
    color: theme.accent,
    border: `1px solid ${theme.border}`,
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: FONT_BODY,
  };
  const card = {
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    padding: 16,
  };

  if (!loaded) {
    return (
      <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        読み込み中…
      </div>
    );
  }

  return (
    <div style={page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@600;800&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap');
        @keyframes htDot { 0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; } }
        .ht-toggle { transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease; }
      `}</style>

      {view === 'home' && (
        <>
          <h1 style={h1}>言いにくいことの翻訳</h1>
          <p style={sub}>上司を選んで、今の状況を相談してみましょう。</p>

          {profiles.length === 0 && (
            <div style={{ ...card, textAlign: 'center', color: theme.inkMuted, marginBottom: 16 }}>
              <p style={{ margin: '0 0 12px', fontSize: 14 }}>
                まだ上司が登録されていません。まずは1人登録してみましょう。
              </p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {profiles.map((p) => (
              <div key={p.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{p.name}</p>
                  <button
                    style={{ background: 'none', border: 'none', color: theme.inkMuted, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => startEditProfile(p)}
                  >
                    編集
                  </button>
                </div>
                <p style={{ margin: '0 0 12px', fontSize: 12, color: theme.inkMuted }}>
                  {p.traits.reaction} ・ {p.traits.order} ・ {p.traits.channel}
                </p>
                <button style={{ ...primaryBtn, width: '100%' }} onClick={() => startInput(p.id)}>
                  この上司に相談する
                </button>
              </div>
            ))}
          </div>

          <button style={{ ...ghostBtn, width: '100%' }} onClick={startNewProfile}>
            + 新しい上司を登録する
          </button>
        </>
      )}

      {view === 'profileForm' && editingProfile && (
        <>
          <h1 style={h1}>上司プロフィール登録</h1>
          <p style={sub}>簡単な設問に答えるだけで登録できます。</p>

          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, color: theme.inkMuted, display: 'block', marginBottom: 6 }}>
                呼び名
              </label>
              <input
                value={editingProfile.name}
                onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
                placeholder="例:田中部長"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${theme.border}`,
                  fontSize: 14,
                  fontFamily: FONT_BODY,
                }}
              />
            </div>

            {TRAIT_QUESTIONS.map((q) => (
              <div key={q.key}>
                <p style={{ fontSize: 13, color: theme.inkMuted, margin: '0 0 8px' }}>{q.label}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {q.options.map((opt) => {
                    const active = editingProfile.traits[q.key] === opt;
                    return (
                      <button
                        key={opt}
                        className="ht-toggle"
                        onClick={() =>
                          setEditingProfile({
                            ...editingProfile,
                            traits: { ...editingProfile.traits, [q.key]: opt },
                          })
                        }
                        style={{
                          padding: '10px 8px',
                          borderRadius: 8,
                          border: `1px solid ${active ? theme.accent : theme.border}`,
                          background: active ? theme.accentSoft : '#fff',
                          color: active ? theme.accent : theme.ink,
                          fontSize: 13,
                          cursor: 'pointer',
                          fontFamily: FONT_BODY,
                        }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div>
              <p style={{ fontSize: 13, color: theme.inkMuted, margin: '0 0 8px' }}>
                地雷ワード・NGな言い方(任意)
              </p>
              <textarea
                rows={3}
                value={editingProfile.note}
                onChange={(e) => setEditingProfile({ ...editingProfile, note: e.target.value })}
                placeholder="例:「できません」という言い方をすると特に不機嫌になる"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${theme.border}`,
                  fontSize: 13,
                  fontFamily: FONT_BODY,
                  resize: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button style={{ ...ghostBtn, flex: 1 }} onClick={() => setView('home')}>
              キャンセル
            </button>
            <button style={{ ...primaryBtn, flex: 2 }} onClick={saveProfile} disabled={!editingProfile.name.trim()}>
              保存する
            </button>
          </div>
        </>
      )}

      {view === 'input' && selectedProfile && (
        <>
          <button
            style={{ background: 'none', border: 'none', color: theme.inkMuted, fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 12 }}
            onClick={() => setView('home')}
          >
            ← 上司一覧に戻る
          </button>
          <h1 style={h1}>{selectedProfile.name}への相談</h1>
          <p style={sub}>今の状況を、思いつくままで大丈夫です。</p>

          <div style={card}>
            <textarea
              rows={5}
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              placeholder="例:納期に3日遅れそうと今日中に伝える必要がある"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${theme.border}`,
                fontSize: 14,
                fontFamily: FONT_BODY,
                resize: 'none',
              }}
            />
            {error && <p style={{ color: theme.danger, fontSize: 13, margin: '10px 0 0' }}>{error}</p>}
            <button
              style={{ ...primaryBtn, width: '100%', marginTop: 12, opacity: situation.trim() ? 1 : 0.5 }}
              onClick={runAnalysis}
              disabled={!situation.trim()}
            >
              言い方の候補を見る
            </button>
          </div>
        </>
      )}

      {view === 'loading' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 360 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: theme.accent,
                  display: 'inline-block',
                  animation: 'htDot 1.2s infinite',
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
            {LOADING_MESSAGES.map((msg, i) => (
              <p
                key={msg}
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: i <= loadingStep ? theme.ink : theme.inkMuted,
                  opacity: i <= loadingStep ? 1 : 0.4,
                }}
              >
                {i < loadingStep ? '✓ ' : i === loadingStep ? '・ ' : '　 '}
                {msg}
              </p>
            ))}
          </div>
        </div>
      )}

      {view === 'results' && candidates && (
        <>
          <button
            style={{ background: 'none', border: 'none', color: theme.inkMuted, fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 12 }}
            onClick={() => setView('input')}
          >
            ← 状況を入力し直す
          </button>
          <h1 style={h1}>言い方の候補</h1>
          <p style={sub}>タップすると、リスク予測の根拠が開きます。</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {candidates.map((c, idx) => {
              const trust = riskColors(c.risk?.trust?.level);
              const tone = riskColors(c.risk?.tone?.level);
              const expanded = expandedIdx === idx;
              const outcome = outcomes[idx];
              return (
                <div
                  key={idx}
                  style={{
                    ...card,
                    borderColor: c.recommended ? theme.accent : theme.border,
                    borderWidth: c.recommended ? 2 : 1,
                  }}
                >
                  {c.recommended && (
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
                  )}
                  <p style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600 }}>{c.type}</p>
                  <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.7, color: theme.ink }}>{c.message}</p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: trust.bg, color: trust.fg }}>
                      信頼:{c.risk?.trust?.level}
                    </span>
                    <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: tone.bg, color: tone.fg }}>
                      温度感:{c.risk?.tone?.level}
                    </span>
                  </div>

                  <button
                    style={{ background: 'none', border: 'none', color: theme.accent, fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: expanded ? 10 : 0 }}
                    onClick={() => setExpandedIdx(expanded ? null : idx)}
                  >
                    {expanded ? '詳細を閉じる ▲' : 'なぜそう予測したか見る ▼'}
                  </button>

                  {expanded && (
                    <div style={{ background: theme.surfaceAlt, borderRadius: 8, padding: 12, marginBottom: 10, fontSize: 13, color: theme.ink, lineHeight: 1.7 }}>
                      <p style={{ margin: '0 0 6px' }}>信頼: {c.risk?.trust?.reason}</p>
                      <p style={{ margin: '0 0 6px' }}>温度感: {c.risk?.tone?.reason}</p>
                      <p style={{ margin: 0 }}>今後の対応: {c.risk?.follow_up}</p>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ ...ghostBtn, flex: 1, padding: '8px 10px', fontSize: 12 }} onClick={() => copyText(c.message)}>
                      コピーする
                    </button>
                  </div>

                  <div style={{ marginTop: 10, borderTop: `1px solid ${theme.border}`, paddingTop: 10 }}>
                    <p style={{ margin: '0 0 8px', fontSize: 12, color: theme.inkMuted }}>
                      {outcome ? '記録しました。次回の予測に活かします。' : 'これを使った場合、結果を記録しておくと次回の精度が上がります。'}
                    </p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['うまくいった', '様子見', 'こじれた'].map((label) => (
                        <button
                          key={label}
                          onClick={() => recordOutcome(idx, c, label)}
                          style={{
                            flex: 1,
                            fontSize: 12,
                            padding: '7px 4px',
                            borderRadius: 8,
                            border: `1px solid ${outcome === label ? theme.accent : theme.border}`,
                            background: outcome === label ? theme.accentSoft : '#fff',
                            color: outcome === label ? theme.accent : theme.inkMuted,
                            cursor: 'pointer',
                            fontFamily: FONT_BODY,
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
