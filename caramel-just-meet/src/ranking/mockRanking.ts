import { isPossibleScore } from '../game/engine';
import { sanitizeName } from './player';
import {
  type MyRecord,
  type PlayerRecord,
  type RankedEntry,
  type RankingEntry,
  RankingError,
  type RankingRepository,
  type SubmitResult,
} from './types';

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

/** サンプルのランキングで、自分の記録に付ける公開 ID */
export const SAMPLE_MY_PUBLIC_ID = 'sample-me';

/**
 * サーバーの設定がないときに使うサンプルのランキング（ダミーの 20 人）。
 * 登録した記録はこの端末の中だけで並ぶ。画面には「サンプル」と表示する。
 */
export class MockRankingRepository implements RankingRepository {
  readonly isSample = true;
  private submitted: PlayerRecord | null = null;

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

  private all(): RankingEntry[] {
    const me = this.submitted;
    return me
      ? [...this.data, { id: SAMPLE_MY_PUBLIC_ID, name: me.name, flag: me.flag, score: me.score, combo: me.combo }]
      : [...this.data];
  }

  async fetchTop(limit: number): Promise<RankedEntry[]> {
    await this.wait();
    return rankWithMe(this.all(), null).entries.slice(0, limit);
  }

  async rankOf(score: number, combo: number): Promise<number> {
    await this.wait();
    return 1 + this.all().filter((e) => e.score > score || (e.score === score && e.combo > combo)).length;
  }

  async submit(record: PlayerRecord): Promise<SubmitResult> {
    await this.wait();
    // サーバーと同じ確認をする
    const name = sanitizeName(record.name);
    if (!name) throw new RankingError('invalid-name', 'name must be 1-12 characters');
    if (!isPossibleScore(record.score, record.combo)) throw new RankingError('invalid-score', 'invalid score');
    const prev = this.submitted;
    const better =
      !prev || record.score > prev.score || (record.score === prev.score && record.combo > prev.combo);
    this.submitted = better ? { ...record, name } : { ...prev, name, flag: record.flag };
    const best = this.submitted;
    const rank = 1 + this.data.filter((e) => e.score > best.score || (e.score === best.score && e.combo > best.combo)).length;
    return { publicId: SAMPLE_MY_PUBLIC_ID, rank };
  }
}
