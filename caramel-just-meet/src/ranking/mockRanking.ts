import type { MyRecord, RankedEntry, RankingEntry, RankingRepository } from './types';

export const MY_ENTRY_ID = 'me';

/** それっぽい世界ランキングのダミーデータ（スコア降順） */
export const DUMMY_RANKING: readonly RankingEntry[] = [
  { id: 'd01', name: 'CaramelGod_JP', flag: '🇯🇵', score: 48210, combo: 112 },
  { id: 'd02', name: 'FlanMaster', flag: '🇲🇽', score: 41570, combo: 101 },
  { id: 'd03', name: 'プッチン大魔王', flag: '🇯🇵', score: 36980, combo: 93 },
  { id: 'd04', name: 'PuddingSniper', flag: '🇺🇸', score: 31250, combo: 84 },
  { id: 'd05', name: 'CrèmeCaramel', flag: '🇫🇷', score: 27740, combo: 77 },
  { id: 'd06', name: '焦がし砂糖', flag: '🇯🇵', score: 23310, combo: 69 },
  { id: 'd07', name: 'Pudim_BR', flag: '🇧🇷', score: 19880, combo: 62 },
  { id: 'd08', name: 'WobbleKing', flag: '🇬🇧', score: 16420, combo: 55 },
  { id: 'd09', name: '布丁小王子', flag: '🇹🇼', score: 13960, combo: 49 },
  { id: 'd10', name: 'JustMeet_99', flag: '🇰🇷', score: 11730, combo: 44 },
  { id: 'd11', name: 'ぷるぷる会社員', flag: '🇯🇵', score: 9640, combo: 38 },
  { id: 'd12', name: 'Flan_Dad', flag: '🇪🇸', score: 7810, combo: 33 },
  { id: 'd13', name: 'SugarRush', flag: '🇦🇺', score: 6350, combo: 29 },
  { id: 'd14', name: 'Puddinator', flag: '🇩🇪', score: 5120, combo: 25 },
  { id: 'd15', name: 'カラメル見習い', flag: '🇯🇵', score: 4040, combo: 21 },
  { id: 'd16', name: 'BudinoBoy', flag: '🇮🇹', score: 3180, combo: 18 },
  { id: 'd17', name: 'TapTapFlan', flag: '🇨🇦', score: 2370, combo: 15 },
  { id: 'd18', name: 'プリン食べたい', flag: '🇯🇵', score: 1650, combo: 12 },
  { id: 'd19', name: 'leche_flan', flag: '🇵🇭', score: 1020, combo: 9 },
  { id: 'd20', name: 'NoCaramelNoLife', flag: '🇮🇳', score: 540, combo: 5 },
];

/**
 * ランキングに自分の記録を混ぜて順位を付ける。
 * スコアが高い順、同点なら連続数が多い順。完全に同じなら同じ順位（自分は後ろに並ぶ）。
 */
export function rankWithMe(
  entries: readonly RankingEntry[],
  me: MyRecord | null,
): { entries: RankedEntry[]; myRank: number | null } {
  const all: { entry: RankingEntry; isMe: boolean }[] = entries
    .filter((e) => e.id !== MY_ENTRY_ID)
    .map((entry) => ({ entry, isMe: false }));
  if (me && me.score > 0) {
    all.push({
      entry: { id: MY_ENTRY_ID, name: me.name, flag: '⭐', score: me.score, combo: me.combo },
      isMe: true,
    });
  }
  all.sort((a, b) => {
    if (b.entry.score !== a.entry.score) return b.entry.score - a.entry.score;
    if (b.entry.combo !== a.entry.combo) return b.entry.combo - a.entry.combo;
    return Number(a.isMe) - Number(b.isMe);
  });

  let myRank: number | null = null;
  const ranked: RankedEntry[] = [];
  all.forEach(({ entry, isMe }, i) => {
    const prev = ranked[i - 1];
    const rank =
      prev && prev.score === entry.score && prev.combo === entry.combo ? prev.rank : i + 1;
    ranked.push({ ...entry, rank, isMe });
    if (isMe) myRank = rank;
  });
  return { entries: ranked, myRank };
}

/** フロントエンドだけで動くモック。通信の待ち時間も再現できる */
export class MockRankingRepository implements RankingRepository {
  private submitted: MyRecord | null = null;

  constructor(
    private readonly data: readonly RankingEntry[] = DUMMY_RANKING,
    private readonly latencyMs = 0,
  ) {}

  private wait() {
    return new Promise<void>((resolve) => {
      if (this.latencyMs <= 0) resolve();
      else setTimeout(resolve, this.latencyMs);
    });
  }

  async fetchTop(limit: number): Promise<RankingEntry[]> {
    await this.wait();
    return [...this.data].sort((a, b) => b.score - a.score).slice(0, limit);
  }

  async submit(record: MyRecord): Promise<void> {
    await this.wait();
    if (!this.submitted || record.score > this.submitted.score) this.submitted = record;
  }
}
