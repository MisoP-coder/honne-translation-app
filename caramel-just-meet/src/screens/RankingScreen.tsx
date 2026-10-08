import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { useBgm } from '../audio/SoundContext';
import { GameButton } from '../components/GameButton';
import { rankWithMe } from '../ranking/mockRanking';
import type { MyRecord, RankedEntry, RankingEntry, RankingRepository } from '../ranking/types';
import { colors } from '../theme/colors';

export const RANKING_LIMIT = 20;

interface Props {
  repository: RankingRepository;
  /** 自分のハイスコア（未プレイなら null） */
  myRecord: MyRecord | null;
  onBack: () => void;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function RankingScreen({ repository, myRecord, onBack }: Props) {
  useBgm('bgm_title');
  const [top, setTop] = useState<RankingEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    repository
      .fetchTop(RANKING_LIMIT)
      .then((entries) => alive && setTop(entries))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [repository]);

  const { shown, myEntry } = useMemo(() => {
    if (!top) return { shown: [] as RankedEntry[], myEntry: null };
    const { entries } = rankWithMe(top, myRecord);
    const me = entries.find((e) => e.isMe) ?? null;
    return { shown: entries.slice(0, RANKING_LIMIT), myEntry: me };
  }, [top, myRecord]);

  const meIsOutside = myEntry !== null && !shown.some((e) => e.isMe);

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>🌍 世界ランキング</Text>
      <Text style={styles.sub}>全世界のカラメル職人たち</Text>

      {error ? (
        <Text style={styles.message}>ランキングを読み込めませんでした</Text>
      ) : !top ? (
        <ActivityIndicator style={styles.loading} color={colors.caramel} testID="ranking-loading" />
      ) : (
        <FlatList
          testID="ranking-list"
          style={styles.list}
          data={shown}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <Row entry={item} />}
        />
      )}

      {top && (
        <View style={styles.myBox}>
          {myEntry ? (
            meIsOutside ? (
              <Row entry={myEntry} />
            ) : (
              <Text style={styles.myText} testID="my-rank">
                あなたは世界 {myEntry.rank} 位！
              </Text>
            )
          ) : (
            <Text style={styles.myText} testID="my-rank">
              まだ記録がありません。プレイしてランクインしよう！
            </Text>
          )}
        </View>
      )}

      <GameButton testID="ranking-back" label="もどる" variant="secondary" onPress={onBack} />
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
  root: { flex: 1, backgroundColor: colors.background, padding: 16, alignItems: 'center' },
  heading: { fontSize: 26, fontWeight: '900', color: colors.caramel, marginTop: 8 },
  sub: { fontSize: 13, color: colors.textSub, marginBottom: 12 },
  loading: { flex: 1 },
  message: { flex: 1, color: colors.textSub, marginTop: 40 },
  list: { flex: 1, alignSelf: 'stretch' },
  row: {
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
  myBox: { alignSelf: 'stretch', marginVertical: 12 },
  myText: { fontSize: 15, fontWeight: '800', color: colors.accent, textAlign: 'center' },
});
