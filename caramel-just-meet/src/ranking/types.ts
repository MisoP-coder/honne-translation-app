export interface RankingEntry {
  /** 公開 ID（自分の行を見分けるのに使う） */
  id: string;
  name: string;
  /** 国旗の絵文字 */
  flag: string;
  score: number;
  /** その記録の連続数 */
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

/** ランキングに登録する記録 */
export interface PlayerRecord {
  /** 端末ごとの合言葉（サーバー以外には見せない） */
  playerId: string;
  name: string;
  flag: string;
  score: number;
  combo: number;
}

export interface SubmitResult {
  /** 公開 ID（ランキングで自分の行を見分けるのに使う） */
  publicId: string;
  rank: number;
}

/** 登録に失敗した理由（画面に出す文言を選ぶのに使う） */
export type RankingErrorKind = 'network' | 'invalid-name' | 'invalid-score' | 'too-many' | 'unknown';

export class RankingError extends Error {
  constructor(
    readonly kind: RankingErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'RankingError';
  }
}

/**
 * ランキングの取得・登録の窓口。
 * 本番は SupabaseRankingRepository、サーバーの設定がないときは MockRankingRepository（サンプル）。
 */
export interface RankingRepository {
  /** 本物ではなくサンプルのデータなら true（画面に「サンプル」と出す） */
  readonly isSample: boolean;
  /** 上位を順位付きで取る */
  fetchTop(limit: number): Promise<RankedEntry[]>;
  /** このスコアなら何位か */
  rankOf(score: number, combo: number): Promise<number>;
  /** 記録を登録する（自己ベストより良いときだけスコアが更新され、名前はいつでも変わる） */
  submit(record: PlayerRecord): Promise<SubmitResult>;
}
