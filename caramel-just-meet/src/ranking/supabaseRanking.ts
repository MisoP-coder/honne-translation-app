import {
  type PlayerRecord,
  type RankedEntry,
  RankingError,
  type RankingRepository,
  type SubmitResult,
} from './types';

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

interface TopRow {
  public_id: string;
  player_name: string;
  flag: string;
  score: number;
  combo: number;
  rank: number | string;
}

const TIMEOUT_MS = 8000;

/**
 * Supabase の世界ランキング。テーブルは直接触らず、supabase/schema.sql の関数（RPC）だけを呼ぶ。
 * 依存を増やさないよう supabase-js は使わず、REST（PostgREST）を fetch で呼んでいる。
 */
export class SupabaseRankingRepository implements RankingRepository {
  readonly isSample = false;

  constructor(
    private readonly url: string,
    private readonly key: string,
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
  ) {}

  async fetchTop(limit: number): Promise<RankedEntry[]> {
    const rows = await this.rpc<TopRow[]>('caramel_top', { p_limit: limit });
    return rows.map((r) => ({
      id: r.public_id,
      name: r.player_name,
      flag: r.flag,
      score: r.score,
      combo: r.combo,
      rank: Number(r.rank),
      isMe: false,
    }));
  }

  async rankOf(score: number, combo: number): Promise<number> {
    const rank = await this.rpc<number | string>('caramel_rank', { p_score: score, p_combo: combo });
    return Number(rank);
  }

  async submit(record: PlayerRecord): Promise<SubmitResult> {
    const rows = await this.rpc<{ public_id: string; rank: number | string }[]>('caramel_submit', {
      p_player_id: record.playerId,
      p_name: record.name,
      p_flag: record.flag,
      p_score: record.score,
      p_combo: record.combo,
    });
    const row = rows[0];
    if (!row) throw new RankingError('unknown', 'empty response');
    return { publicId: row.public_id, rank: Number(row.rank) };
  }

  private async rpc<T>(fn: string, body: unknown): Promise<T> {
    const headers: Record<string, string> = {
      apikey: this.key,
      'Content-Type': 'application/json',
    };
    // 旧形式の anon キー（JWT）のときだけ Authorization にも付ける（新形式の publishable キーは apikey だけでよい）
    if (this.key.startsWith('eyJ')) headers.Authorization = `Bearer ${this.key}`;

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller?.signal,
      });
    } catch {
      throw new RankingError('network', 'network error');
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (!res.ok) {
      let message = '';
      try {
        message = String(((await res.json()) as { message?: string }).message ?? '');
      } catch {
        // 本文が JSON でないときは理由不明として扱う
      }
      throw new RankingError(errorKind(res.status, message), message || `HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  }
}

/** サーバーのエラー文（schema.sql の raise exception）から理由を判断する */
export function errorKind(status: number, message: string): RankingError['kind'] {
  if (message.includes('name')) return 'invalid-name';
  if (message.includes('invalid score')) return 'invalid-score';
  if (message.includes('too many')) return 'too-many';
  if (status >= 500 || status === 0) return 'network';
  return 'unknown';
}
