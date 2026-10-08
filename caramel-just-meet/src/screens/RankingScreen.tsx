import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { useBgm } from '../audio/SoundContext';
import { GameButton } from '../components/GameButton';
import { NAME_MAX, type PlayerProfile, sanitizeName } from '../ranking/player';
import {
  type RankedEntry,
  RankingError,
  type RankingErrorKind,
  type RankingRepository,
  type SubmitResult,
} from '../ranking/types';
import { colors } from '../theme/colors';

export const RANKING_LIMIT = 20;

interface Props {
  repository: RankingRepository;
  /** 自分のハイスコア（ハイスコアを出したゲームの連続数と組で）。未プレイなら null */
  best: { score: number; combo: number } | null;
  /** この端末のプレイヤー（読み込み中は null） */
  player: PlayerProfile | null;
  /** 名前を決めて、自己ベストをランキングに登録する */
  onRegister: (name: string) => Promise<SubmitResult>;
  onBack: () => void;
}

const MEDALS = ['🥇', '🥈', '🥉'];

const ERROR_TEXT: Record<RankingErrorKind | 'load', string> = {
  load: 'ランキングを読み込めませんでした。電波のよいところでもう一度開いてください。',
  network: '通信できませんでした。電波のよいところでもう一度試してください。',
  'invalid-name': `名前は 1〜${NAME_MAX} 文字で入れてください。`,
  'invalid-score': 'この記録は登録できませんでした。',
  'too-many': '少し待ってから、もう一度試してください。',
  unknown: '登録できませんでした。時間をおいてもう一度試してください。',
};

export function RankingScreen({ repository, best, player, onRegister, onBack }: Props) {
  useBgm('bgm_title');
  const [top, setTop] = useState<RankedEntry[] | null>(null);
  const [myOutside, setMyOutside] = useState<RankedEntry | null>(null);
  const [loadError, setLoadError] = useState(false);
  const myPublicId = player?.publicId ?? null;
  // 読み込みが重なったとき、古い結果で新しい結果を上書きしないようにする
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    const isLatest = () => id === requestId.current;
    setLoadError(false);
    try {
      const entries = (await repository.fetchTop(RANKING_LIMIT)).map((e) => ({
        ...e,
        isMe: myPublicId !== null && e.id === myPublicId,
      }));
      if (!isLatest()) return;
      setTop(entries);
      // 自分が上位に入っていなければ、自分の順位だけ調べて下に出す
      if (myPublicId && player?.name && best && !entries.some((e) => e.isMe)) {
        const rank = await repository.rankOf(best.score, best.combo);
        if (!isLatest()) return;
        setMyOutside({
          id: myPublicId,
          name: player.name,
          flag: player.flag,
          score: best.score,
          combo: best.combo,
          rank,
          isMe: true,
        });
      } else {
        setMyOutside(null);
      }
    } catch {
      if (isLatest()) setLoadError(true);
    }
  }, [repository, myPublicId, player?.name, player?.flag, best]);

  useEffect(() => {
    void load();
  }, [load]);

  const myEntry = top?.find((e) => e.isMe) ?? myOutside;

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>🌍 世界ランキング</Text>
      <Text style={styles.sub}>全世界のカラメル職人たち</Text>
      {repository.isSample && (
        <Text style={styles.sample} testID="ranking-sample">
          ※ いまはサンプル表示です（本物の世界ランキングは準備中）
        </Text>
      )}

      {loadError ? (
        <Text style={styles.message} testID="ranking-error">
          {ERROR_TEXT.load}
        </Text>
      ) : !top ? (
        <ActivityIndicator style={styles.loading} color={colors.caramel} testID="ranking-loading" />
      ) : top.length === 0 ? (
        <Text style={styles.message} testID="ranking-empty">
          まだ誰も登録していません。一番乗りのチャンス！
        </Text>
      ) : (
        <FlatList
          testID="ranking-list"
          style={styles.list}
          data={top}
          // 20 人ぶんだけなので最初から全部描く（自分の行がすぐ見つかるように）
          initialNumToRender={RANKING_LIMIT}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <Row entry={item} />}
        />
      )}

      {myOutside && <Row entry={myOutside} />}

      <RegisterCard
        best={best}
        player={player}
        myRank={myEntry?.rank ?? null}
        // 登録すると名前と公開 ID が変わるので、上の useEffect が読み込み直す
        onRegister={onRegister}
      />

      <GameButton testID="ranking-back" label="もどる" variant="secondary" onPress={onBack} />
    </View>
  );
}

/** 名前を決めてランキングに参加する欄 */
function RegisterCard({
  best,
  player,
  myRank,
  onRegister,
}: {
  best: Props['best'];
  player: PlayerProfile | null;
  myRank: number | null;
  onRegister: (name: string) => Promise<SubmitResult>;
}) {
  const registered = Boolean(player?.name && player.publicId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(player?.name ?? '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (player?.name) setName(player.name);
  }, [player?.name]);

  if (!best || best.score <= 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardText} testID="my-rank">
          まずはプレイして記録を作ろう！記録ができたら名前を付けて登録できます。
        </Text>
      </View>
    );
  }

  if (registered && !editing) {
    return (
      <View style={styles.card}>
        <Text style={styles.myText} testID="my-rank">
          {myRank !== null ? `${player?.name} は世界 ${myRank} 位！` : `${player?.name} で参加中`}
        </Text>
        <Text style={styles.cardNote}>自己ベストを更新すると、自動でランキングに反映されます。</Text>
        <GameButton
          testID="ranking-rename"
          label="名前を変える"
          variant="secondary"
          onPress={() => setEditing(true)}
          style={styles.smallButton}
        />
      </View>
    );
  }

  const submit = async () => {
    const clean = sanitizeName(name);
    if (!clean) {
      setError(ERROR_TEXT['invalid-name']);
      return;
    }
    setSending(true);
    setError(null);
    try {
      await onRegister(clean);
      setEditing(false);
    } catch (e) {
      setError(ERROR_TEXT[e instanceof RankingError ? e.kind : 'unknown']);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        {registered ? '名前を変える' : `自己ベスト ${best.score.toLocaleString()} 点で参加する`}
      </Text>
      <View style={styles.inputRow}>
        <TextInput
          testID="ranking-name-input"
          value={name}
          onChangeText={(t) => {
            setName(t);
            setError(null);
          }}
          placeholder={`ニックネーム（${NAME_MAX} 文字まで）`}
          placeholderTextColor={colors.textSub}
          maxLength={NAME_MAX * 2}
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
          accessibilityLabel="ランキングに出す名前"
          style={styles.input}
        />
        <GameButton
          testID="ranking-register"
          label={sending ? '登録中…' : registered ? '変更' : '登録'}
          onPress={() => !sending && void submit()}
          style={styles.registerButton}
        />
      </View>
      {error && (
        <Text style={styles.error} testID="ranking-register-error">
          {error}
        </Text>
      )}
      <Text style={styles.cardNote}>
        名前・国旗・スコアは世界中に公開されます。本名など、あなただとわかる名前は使わないでください。
      </Text>
    </View>
  );
}

function Row({ entry }: { entry: RankedEntry }) {
  return (
    <View
      style={[styles.row, entry.isMe && styles.rowMe]}
      testID={entry.isMe ? 'ranking-row-me' : `ranking-row-${entry.id}`}
    >
      <Text style={styles.rank}>{MEDALS[entry.rank - 1] ?? entry.rank}</Text>
      <Text style={styles.flag}>{entry.flag}</Text>
      <View style={styles.nameBox}>
        <Text style={styles.name} numberOfLines={1}>
          {entry.name}
        </Text>
        <Text style={styles.combo}>{entry.combo} 連続</Text>
      </View>
      <Text style={styles.score}>{entry.score.toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, padding: 16, alignItems: 'center', gap: 8 },
  heading: { fontSize: 26, fontWeight: '900', color: colors.caramel, marginTop: 8 },
  sub: { fontSize: 13, color: colors.textSub },
  sample: {
    alignSelf: 'stretch',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: colors.caramel,
    backgroundColor: colors.backgroundDeep,
    borderRadius: 8,
    paddingVertical: 4,
  },
  loading: { flex: 1 },
  message: { flex: 1, color: colors.textSub, marginTop: 40, textAlign: 'center' },
  list: { flex: 1, alignSelf: 'stretch' },
  row: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  rowMe: { backgroundColor: colors.me, borderWidth: 2, borderColor: colors.accent },
  rank: { width: 36, fontSize: 18, fontWeight: '900', color: colors.text, textAlign: 'center' },
  flag: { fontSize: 20, marginHorizontal: 6 },
  nameBox: { flex: 1 },
  name: { fontSize: 15, fontWeight: '800', color: colors.text },
  combo: { fontSize: 12, color: colors.textSub },
  score: { fontSize: 17, fontWeight: '900', color: colors.caramel },
  card: {
    alignSelf: 'stretch',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    gap: 6,
  },
  cardTitle: { fontSize: 14, fontWeight: '900', color: colors.text },
  cardText: { fontSize: 14, fontWeight: '700', color: colors.textSub, textAlign: 'center' },
  cardNote: { fontSize: 11, color: colors.textSub },
  myText: { fontSize: 16, fontWeight: '900', color: colors.accent, textAlign: 'center' },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    minWidth: 0,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.backgroundDeep,
    paddingHorizontal: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },
  registerButton: { minWidth: 0, paddingVertical: 11, paddingHorizontal: 18 },
  smallButton: { alignSelf: 'center', minWidth: 0, paddingVertical: 8 },
  error: { fontSize: 13, fontWeight: '700', color: colors.accent },
});
