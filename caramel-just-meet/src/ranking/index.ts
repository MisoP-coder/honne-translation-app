import { config, hasSupabase } from '../config';
import { MockRankingRepository } from './mockRanking';
import { SupabaseRankingRepository } from './supabaseRanking';
import type { RankingRepository } from './types';

/** サーバー（Supabase）の設定があれば本物の世界ランキング、なければサンプル */
export function createRankingRepository(): RankingRepository {
  if (hasSupabase()) return new SupabaseRankingRepository(config.supabaseUrl, config.supabaseAnonKey);
  return new MockRankingRepository(undefined, 400);
}
