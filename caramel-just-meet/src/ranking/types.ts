export interface RankingEntry {
  id: string;
  name: string;
  /** 国旗の絵文字 */
  flag: string;
  score: number;
  /** 最高連続数 */
  combo: number;
}

export interface RankedEntry extends RankingEntry {
  rank: number;
  isMe: boolean;
}

export interface MyRecord {
  name: string;
  score: number;
  combo: number;
}

/**
 * ランキングの取得・登録の窓口。
 * 今はダミーデータを返す MockRankingRepository を使い、
 * 後で Supabase などに繋ぐときはこのインターフェースを実装したものに差し替える。
 */
export interface RankingRepository {
  fetchTop(limit: number): Promise<RankingEntry[]>;
  submit(record: MyRecord): Promise<void>;
}
