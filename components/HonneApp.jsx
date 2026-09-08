'use client';

import { useState, useRef, useEffect } from 'react';

import { createClient } from '@/lib/supabase/client';
import HeaderIllustration from '@/components/HeaderIllustration';
import {
  TRAIT_QUESTIONS,
  OUTCOMES,
  LOADING_MESSAGES,
  RECORDS_THRESHOLD,
  CHANNELS,
  defaultChannel,
  SHARE_TARGETS,
  SHARE_TEXT,
  SITE_URL,
  emptyTraits,
  normalizeTraits,
} from '@/lib/constants';
import {
  theme,
  FONT_HEAD,
  riskColors,
  primaryBtn,
  ghostBtn,
  card,
  inputStyle,
} from '@/lib/theme';

const GUIDE_STEPS = [
  {
    title: '上司を登録する',
    body: '呼び名と、5つの質問に答えるだけです。あとから何度でも編集できます。',
  },
  {
    title: '状況を書いて候補を見る',
    body: '「納期に3日遅れそう」のような書きかけの文章で大丈夫です。トーンの違う言い方が3つと、それぞれの影響予測が出ます。',
  },
  {
    title: '使った結果を記録する',
    body: 'うまくいった / 様子見 / こじれた の3択です。同じ上司で3件たまると、一般論ではなくその人に効いた言い方をもとに予測するようになります。',
  },
];

export default function HonneApp({ userEmail, initialProfiles, initialRecords }) {
  const supabaseRef = useRef(null);
  const getSupabase = () => {
    if (!supabaseRef.current) supabaseRef.current = createClient();
    return supabaseRef.current;
  };

  const [view, setView] = useState('home');
  const [showGuide, setShowGuide] = useState(initialProfiles.length === 0);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [records, setRecords] = useState(initialRecords);

  const [editingProfile, setEditingProfile] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [situation, setSituation] = useState('');
  const [channel, setChannel] = useState(CHANNELS[0]);
  const [loadingStep, setLoadingStep] = useState(0);
  const [candidates, setCandidates] = useState(null);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [recorded, setRecorded] = useState(null);
  const [historyProfileId, setHistoryProfileId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);

  const stepTimerRef = useRef(null);
  useEffect(() => () => clearInterval(stepTimerRef.current), []);

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);
  const recordCount = (profileId) => records.filter((r) => r.profile_id === profileId).length;

  // --- 上司プロフィール -----------------------------------------------------

  const startNewProfile = () => {
    setError(null);
    setEditingProfile({ id: null, name: '', traits: emptyTraits(), note: '' });
    setView('profileForm');
  };

  const startEditProfile = (profile) => {
    setError(null);
    setEditingProfile({
      id: profile.id,
      name: profile.name,
      traits: normalizeTraits(profile.traits),
      note: profile.note ?? '',
    });
    setView('profileForm');
  };

  const saveProfile = async () => {
    if (!editingProfile || !editingProfile.name.trim() || savingProfile) return;

    setSavingProfile(true);
    setError(null);

    const supabase = getSupabase();
    const payload = {
      name: editingProfile.name.trim(),
      traits: editingProfile.traits,
      note: editingProfile.note.trim(),
    };

    try {
      if (editingProfile.id) {
        const { data, error: updateError } = await supabase
          .from('boss_profiles')
          .update(payload)
          .eq('id', editingProfile.id)
          .select('id, name, traits, note, created_at')
          .single();
        if (updateError) throw updateError;
        setProfiles((prev) => prev.map((p) => (p.id === data.id ? data : p)));
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('セッションが切れました。もう一度ログインしてください。');

        const { data, error: insertError } = await supabase
          .from('boss_profiles')
          .insert({ ...payload, user_id: user.id })
          .select('id, name, traits, note, created_at')
          .single();
        if (insertError) throw insertError;
        setProfiles((prev) => [...prev, data]);
      }
      setEditingProfile(null);
      setView('home');
    } catch (e) {
      setError(e?.message || '保存に失敗しました。もう一度お試しください。');
    } finally {
      setSavingProfile(false);
    }
  };

  // --- 相談 ---------------------------------------------------------------

  const startInput = (profileId) => {
    const profile = profiles.find((p) => p.id === profileId);
    setSelectedProfileId(profileId);
    setChannel(defaultChannel(profile?.traits));
    setSituation('');
    setCandidates(null);
    setRecorded(null);
    setError(null);
    setView('input');
  };

  const runAnalysis = async () => {
    if (!selectedProfile || !situation.trim()) return;

    setView('loading');
    setLoadingStep(0);
    setError(null);

    clearInterval(stepTimerRef.current);
    stepTimerRef.current = setInterval(() => {
      setLoadingStep((s) => (s < LOADING_MESSAGES.length - 1 ? s + 1 : s));
    }, 650);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: selectedProfile.id,
          situation: situation.trim(),
          channel,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '候補の生成に失敗しました。');

      clearInterval(stepTimerRef.current);
      setCandidates(data.candidates || []);
      setExpandedIdx(null);
      setRecorded(null);
      setView('results');
    } catch (e) {
      clearInterval(stepTimerRef.current);
      setError(e?.message || '候補の生成に失敗しました。もう一度お試しください。');
      setView('input');
    }
  };

  const recordOutcome = async (candidate, outcome) => {
    // 1回の相談につき記録は1件。保存中の連打も、保存後の押し直しも受け付けない
    if (!selectedProfile || savingOutcome || recorded) return;

    setSavingOutcome(true);
    setError(null);

    const supabase = getSupabase();
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('セッションが切れました。もう一度ログインしてください。');

      const { data, error: insertError } = await supabase
        .from('outcome_records')
        .insert({
          user_id: user.id,
          profile_id: selectedProfile.id,
          situation: situation.trim(),
          message: candidate.message,
          candidate_type: candidate.type ?? '',
          channel,
          outcome,
        })
        .select('id, profile_id, situation, message, candidate_type, channel, outcome, created_at')
        .single();
      if (insertError) throw insertError;

      setRecords((prev) => [data, ...prev]);
      setRecorded({ outcome, type: candidate.type ?? '' });
      setView('recorded');
    } catch (e) {
      setError(e?.message || '記録の保存に失敗しました。');
    } finally {
      setSavingOutcome(false);
    }
  };

  // --- 実績の確認と削除 -----------------------------------------------------

  const openHistory = (profileId) => {
    setHistoryProfileId(profileId);
    setError(null);
    setView('history');
  };

  const profileRecords = (profileId) =>
    records
      .filter((r) => r.profile_id === profileId)
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const deleteRecord = async (recordId) => {
    if (deletingId) return;
    if (!window.confirm('この実績を削除しますか?次回以降の予測から除かれます。')) return;

    setDeletingId(recordId);
    setError(null);
    try {
      const { error: deleteError } = await getSupabase()
        .from('outcome_records')
        .delete()
        .eq('id', recordId);
      if (deleteError) throw deleteError;
      setRecords((prev) => prev.filter((r) => r.id !== recordId));
    } catch (e) {
      setError(e?.message || '削除に失敗しました。');
    } finally {
      setDeletingId(null);
    }
  };

  const shareUrl = () => (typeof window === 'undefined' ? SITE_URL : window.location.origin);

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* クリップボードが使えない環境ではそのまま */
    }
  };

  // --- スタイル -----------------------------------------------------------

  const h1 = { fontFamily: FONT_HEAD, fontSize: 22, fontWeight: 700, margin: '0 0 4px' };
  const sub = { fontSize: 13, color: theme.inkMuted, margin: '0 0 20px' };
  const backBtn = {
    background: 'none',
    border: 'none',
    color: theme.inkMuted,
    fontSize: 13,
    cursor: 'pointer',
    padding: 0,
    marginBottom: 12,
  };

  return (
    <div className="ht-shell">
      {view === 'home' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 2 }}>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                style={{
                  background: 'none',
                  border: 'none',
                  color: theme.inkMuted,
                  fontSize: 12,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  whiteSpace: 'nowrap',
                }}
              >
                ログアウト
              </button>
            </form>
          </div>

          <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={h1}>言いにくいことの翻訳</h1>
              <p style={{ ...sub, margin: 0 }}>上司を選んで、今の状況を相談してみましょう。</p>
            </div>
            <HeaderIllustration />
          </header>

          {userEmail && (
            <p style={{ fontSize: 11, color: theme.inkMuted, margin: '0 0 16px' }}>{userEmail}</p>
          )}

          {error && <p style={{ color: theme.danger, fontSize: 13, margin: '0 0 12px' }}>{error}</p>}

          <div style={{ ...card, padding: showGuide ? 16 : '12px 16px', marginBottom: 16 }}>
            <button
              onClick={() => setShowGuide((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: theme.ink,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              使い方
              <span style={{ color: theme.inkMuted, fontSize: 12, fontWeight: 400 }}>
                {showGuide ? '閉じる ▲' : '開く ▼'}
              </span>
            </button>

            {showGuide && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
                {GUIDE_STEPS.map((step, i) => (
                  <div key={step.title} style={{ display: 'flex', gap: 10 }}>
                    <span
                      style={{
                        flexShrink: 0,
                        width: 22,
                        height: 22,
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
                      <p style={{ margin: '2px 0 4px', fontSize: 13, fontWeight: 600 }}>{step.title}</p>
                      <p style={{ margin: 0, fontSize: 12, color: theme.inkMuted, lineHeight: 1.7 }}>
                        {step.body}
                      </p>
                    </div>
                  </div>
                ))}
                <p
                  style={{
                    margin: 0,
                    paddingTop: 12,
                    borderTop: `1px solid ${theme.border}`,
                    fontSize: 11,
                    color: theme.inkMuted,
                    lineHeight: 1.7,
                  }}
                >
                  入力した内容は、あなたのアカウントからのみ見られます。上司本人に通知が行くことはありません。
                </p>
              </div>
            )}
          </div>

          {profiles.length === 0 && (
            <div style={{ ...card, textAlign: 'center', color: theme.inkMuted, marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 14 }}>
                まだ上司が登録されていません。まずは1人登録してみましょう。
              </p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {profiles.map((p) => {
              const traits = normalizeTraits(p.traits);
              const count = recordCount(p.id);
              return (
                <div key={p.id} style={card}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{p.name}</p>
                    <button
                      style={{
                        background: 'none',
                        border: 'none',
                        color: theme.inkMuted,
                        fontSize: 12,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                      onClick={() => startEditProfile(p)}
                    >
                      編集
                    </button>
                  </div>
                  <p style={{ margin: '0 0 6px', fontSize: 12, color: theme.inkMuted }}>
                    {traits.reaction} ・ {traits.order} ・ {traits.channel}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px' }}>
                    <p style={{ margin: 0, fontSize: 11, color: theme.inkMuted }}>
                      {count >= RECORDS_THRESHOLD
                        ? `実績${count}件をもとに予測します`
                        : `実績${count}件(あと${RECORDS_THRESHOLD - count}件でこの上司専用の予測になります)`}
                    </p>
                    {count > 0 && (
                      <button
                        onClick={() => openHistory(p.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: theme.accent,
                          fontSize: 11,
                          cursor: 'pointer',
                          padding: 0,
                          textDecoration: 'underline',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        確認・削除
                      </button>
                    )}
                  </div>
                  <button style={{ ...primaryBtn, width: '100%' }} onClick={() => startInput(p.id)}>
                    この上司に相談する
                  </button>
                </div>
              );
            })}
          </div>

          <button style={{ ...ghostBtn, width: '100%' }} onClick={startNewProfile}>
            + 新しい上司を登録する
          </button>

          <div style={{ ...card, marginTop: 24 }}>
            <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600 }}>このアプリをシェアする</p>
            <p style={{ margin: '0 0 12px', fontSize: 11, color: theme.inkMuted, lineHeight: 1.7 }}>
              紹介文が自動で入ります。あなたの上司の情報や相談内容は含まれません。
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              {SHARE_TARGETS.map((target) => (
                <a
                  key={target.key}
                  href={target.build(shareUrl(), SHARE_TEXT)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    ...ghostBtn,
                    flex: 1,
                    padding: '9px 4px',
                    fontSize: 12,
                    textAlign: 'center',
                    textDecoration: 'none',
                  }}
                >
                  {target.label}
                </a>
              ))}
            </div>
          </div>
        </>
      )}

      {view === 'history' && historyProfileId && (
        <>
          <button
            style={backBtn}
            onClick={() => {
              setHistoryProfileId(null);
              setView('home');
            }}
          >
            ← 上司一覧に戻る
          </button>
          <h1 style={h1}>{profiles.find((p) => p.id === historyProfileId)?.name}の実績</h1>
          <p style={sub}>
            ここに残っている記録が、次回の予測の材料になります。誤って記録したものは削除できます。
          </p>

          {error && <p style={{ color: theme.danger, fontSize: 13, margin: '0 0 12px' }}>{error}</p>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {profileRecords(historyProfileId).map((r) => {
              const colors = riskColors(r.outcome === 'うまくいった' ? '向上' : r.outcome === '様子見' ? '維持' : '悪化');
              return (
                <div key={r.id} style={{ ...card, padding: 14 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        padding: '3px 10px',
                        borderRadius: 6,
                        background: colors.bg,
                        color: colors.fg,
                      }}
                    >
                      {r.outcome}
                    </span>
                    <span style={{ fontSize: 11, color: theme.inkMuted }}>
                      {new Date(r.created_at).toLocaleString('ja-JP', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <p style={{ margin: '0 0 6px', fontSize: 13, lineHeight: 1.6 }}>{r.situation}</p>
                  <p style={{ margin: '0 0 10px', fontSize: 11, color: theme.inkMuted, lineHeight: 1.6 }}>
                    {r.channel ? `${r.channel} / ` : ''}
                    {r.candidate_type ? `${r.candidate_type}:` : ''}
                    {r.message.length > 60 ? `${r.message.slice(0, 60)}…` : r.message}
                  </p>

                  <button
                    onClick={() => deleteRecord(r.id)}
                    disabled={deletingId === r.id}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: theme.danger,
                      fontSize: 12,
                      cursor: 'pointer',
                      padding: 0,
                      textDecoration: 'underline',
                      opacity: deletingId === r.id ? 0.5 : 1,
                    }}
                  >
                    {deletingId === r.id ? '削除中…' : 'この実績を削除する'}
                  </button>
                </div>
              );
            })}
          </div>

          {profileRecords(historyProfileId).length === 0 && (
            <div style={{ ...card, textAlign: 'center', color: theme.inkMuted, fontSize: 13 }}>
              実績はまだありません。
            </div>
          )}
        </>
      )}

      {view === 'profileForm' && editingProfile && (
        <>
          <h1 style={h1}>{editingProfile.id ? '上司プロフィール編集' : '上司プロフィール登録'}</h1>
          <p style={sub}>簡単な設問に答えるだけで登録できます。</p>

          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label
                htmlFor="boss-name"
                style={{ fontSize: 13, color: theme.inkMuted, display: 'block', marginBottom: 6 }}
              >
                呼び名
              </label>
              <input
                id="boss-name"
                value={editingProfile.name}
                onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
                placeholder="例:田中部長"
                maxLength={60}
                style={inputStyle}
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
                style={{ ...inputStyle, fontSize: 13, resize: 'none' }}
              />
            </div>
          </div>

          {error && <p style={{ color: theme.danger, fontSize: 13, margin: '12px 0 0' }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              style={{ ...ghostBtn, flex: 1 }}
              onClick={() => {
                setEditingProfile(null);
                setError(null);
                setView('home');
              }}
            >
              キャンセル
            </button>
            <button
              style={{
                ...primaryBtn,
                flex: 2,
                opacity: editingProfile.name.trim() && !savingProfile ? 1 : 0.5,
              }}
              onClick={saveProfile}
              disabled={!editingProfile.name.trim() || savingProfile}
            >
              {savingProfile ? '保存中…' : '保存する'}
            </button>
          </div>
        </>
      )}

      {view === 'input' && selectedProfile && (
        <>
          <button style={backBtn} onClick={() => setView('home')}>
            ← 上司一覧に戻る
          </button>
          <h1 style={h1}>{selectedProfile.name}への相談</h1>
          <p style={sub}>今の状況を、思いつくままで大丈夫です。</p>

          <div style={card}>
            <p style={{ fontSize: 13, color: theme.inkMuted, margin: '0 0 8px' }}>今回の伝え方</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {CHANNELS.map((c) => {
                const active = channel === c;
                return (
                  <button
                    key={c}
                    className="ht-toggle"
                    onClick={() => setChannel(c)}
                    style={{
                      padding: '10px 8px',
                      borderRadius: 8,
                      border: `1px solid ${active ? theme.accent : theme.border}`,
                      background: active ? theme.accentSoft : '#fff',
                      color: active ? theme.accent : theme.ink,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            {channel !== defaultChannel(selectedProfile.traits) && (
              <p style={{ fontSize: 11, color: theme.caution, margin: '-8px 0 14px', lineHeight: 1.6 }}>
                {selectedProfile.name}が好むのは
                {normalizeTraits(selectedProfile.traits).channel}です。その点も踏まえて予測します。
              </p>
            )}

            <p style={{ fontSize: 13, color: theme.inkMuted, margin: '0 0 8px' }}>今の状況</p>
            <textarea
              rows={5}
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              placeholder="例:納期に3日遅れそうと今日中に伝える必要がある"
              maxLength={2000}
              style={{ ...inputStyle, resize: 'none' }}
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
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 360,
          }}
        >
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
          <button style={backBtn} onClick={() => setView('input')}>
            ← 状況を入力し直す
          </button>
          <h1 style={h1}>言い方の候補</h1>
          <p style={sub}>タップすると、リスク予測の根拠が開きます。</p>

          {error && <p style={{ color: theme.danger, fontSize: 13, margin: '0 0 12px' }}>{error}</p>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {candidates.map((c, idx) => {
              const trust = riskColors(c.risk?.trust?.level);
              const tone = riskColors(c.risk?.tone?.level);
              const expanded = expandedIdx === idx;
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
                  <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {c.message}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    <span
                      style={{
                        fontSize: 12,
                        padding: '4px 10px',
                        borderRadius: 6,
                        background: trust.bg,
                        color: trust.fg,
                      }}
                    >
                      信頼:{c.risk?.trust?.level}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        padding: '4px 10px',
                        borderRadius: 6,
                        background: tone.bg,
                        color: tone.fg,
                      }}
                    >
                      温度感:{c.risk?.tone?.level}
                    </span>
                  </div>

                  <button
                    style={{
                      background: 'none',
                      border: 'none',
                      color: theme.accent,
                      fontSize: 12,
                      cursor: 'pointer',
                      padding: 0,
                      marginBottom: expanded ? 10 : 0,
                    }}
                    onClick={() => setExpandedIdx(expanded ? null : idx)}
                  >
                    {expanded ? '詳細を閉じる ▲' : 'なぜそう予測したか見る ▼'}
                  </button>

                  {expanded && (
                    <div
                      style={{
                        background: theme.surfaceAlt,
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 10,
                        fontSize: 13,
                        lineHeight: 1.7,
                      }}
                    >
                      <p style={{ margin: '0 0 6px' }}>信頼: {c.risk?.trust?.reason}</p>
                      <p style={{ margin: '0 0 6px' }}>温度感: {c.risk?.tone?.reason}</p>
                      <p style={{ margin: 0 }}>今後の対応: {c.risk?.follow_up}</p>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      style={{ ...ghostBtn, flex: 1, padding: '8px 10px', fontSize: 12 }}
                      onClick={() => copyText(c.message)}
                    >
                      コピーする
                    </button>
                  </div>

                  <div style={{ marginTop: 10, borderTop: `1px solid ${theme.border}`, paddingTop: 10 }}>
                    <p style={{ margin: '0 0 8px', fontSize: 12, color: theme.inkMuted }}>
                      この言い方を使ったら、結果を記録しておくと次回の精度が上がります。
                    </p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {OUTCOMES.map((label) => (
                        <button
                          key={label}
                          onClick={() => recordOutcome(c, label)}
                          disabled={savingOutcome}
                          style={{
                            flex: 1,
                            fontSize: 12,
                            padding: '7px 4px',
                            borderRadius: 8,
                            border: `1px solid ${theme.border}`,
                            background: '#fff',
                            color: theme.inkMuted,
                            opacity: savingOutcome ? 0.5 : 1,
                            cursor: 'pointer',
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

      {view === 'recorded' && recorded && selectedProfile && (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 420, justifyContent: 'center' }}>
          <div style={{ ...card, textAlign: 'center', padding: '28px 20px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: theme.accentSoft,
                color: theme.accent,
                fontSize: 22,
                marginBottom: 14,
              }}
            >
              ✓
            </span>
            <h1 style={{ ...h1, fontSize: 19, margin: '0 0 8px' }}>記録しました</h1>
            <p style={{ margin: '0 0 4px', fontSize: 14 }}>
              {selectedProfile.name}への「{recorded.type}」を
              <br />
              「{recorded.outcome}」として記録しました。
            </p>
            <p style={{ margin: '12px 0 0', fontSize: 12, color: theme.inkMuted, lineHeight: 1.7 }}>
              {(() => {
                const count = recordCount(selectedProfile.id);
                return count >= RECORDS_THRESHOLD
                  ? `実績は${count}件になりました。次回からもこの実績をもとに予測します。`
                  : `実績は${count}件になりました。あと${RECORDS_THRESHOLD - count}件で、この上司専用の予測に切り替わります。`;
              })()}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            <button style={{ ...primaryBtn, width: '100%' }} onClick={() => startInput(selectedProfile.id)}>
              同じ上司にもう一度相談する
            </button>
            <button
              style={{ ...ghostBtn, width: '100%' }}
              onClick={() => {
                setRecorded(null);
                setView('home');
              }}
            >
              上司一覧に戻る
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
