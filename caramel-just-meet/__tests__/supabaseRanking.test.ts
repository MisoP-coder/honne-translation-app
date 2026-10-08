import { errorKind, SupabaseRankingRepository } from '../src/ranking/supabaseRanking';
import { RankingError } from '../src/ranking/types';
import { flagFromLocale, sanitizeName } from '../src/ranking/player';
import { buildXShareUrl } from '../src/share/xShare';

type Call = { url: string; init: RequestInit };

function fakeFetch(responses: { status?: number; body: unknown }[]) {
  const calls: Call[] = [];
  const fn = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = responses.shift() ?? { body: [] };
    return {
      ok: (r.status ?? 200) < 400,
      status: r.status ?? 200,
      json: async () => r.body,
    } as Response;
  });
  return { fn, calls };
}

const URL = 'https://abc.supabase.co';

describe('SupabaseRankingRepository', () => {
  it('本物のランキング（サンプルではない）', () => {
    expect(new SupabaseRankingRepository(URL, 'k').isSample).toBe(false);
  });

  it('上位はサーバーの関数（caramel_top）から順位付きで取る', async () => {
    const { fn, calls } = fakeFetch([
      { body: [{ public_id: 'p1', player_name: 'A', flag: '🇯🇵', score: 930, combo: 3, rank: '1' }] },
    ]);
    const repo = new SupabaseRankingRepository(URL, 'sb_publishable_x', fn);
    const top = await repo.fetchTop(20);
    expect(top).toEqual([{ id: 'p1', name: 'A', flag: '🇯🇵', score: 930, combo: 3, rank: 1, isMe: false }]);
    expect(calls[0].url).toBe(`${URL}/rest/v1/rpc/caramel_top`);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ p_limit: 20 });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.apikey).toBe('sb_publishable_x');
    // 新しい形式の公開キーは JWT ではないので Authorization には付けない
    expect(headers.Authorization).toBeUndefined();
  });

  it('旧形式の anon キー（JWT）のときは Authorization にも付ける', async () => {
    const { fn, calls } = fakeFetch([{ body: 3 }]);
    const repo = new SupabaseRankingRepository(URL, 'eyJhbGciOi.x.y', fn);
    await expect(repo.rankOf(930, 3)).resolves.toBe(3);
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer eyJhbGciOi.x.y');
  });

  it('登録は合言葉・名前・国旗・スコア・連続数を送り、公開 ID と順位を受け取る', async () => {
    const { fn, calls } = fakeFetch([{ body: [{ public_id: 'pub', rank: 7 }] }]);
    const repo = new SupabaseRankingRepository(URL, 'k', fn);
    const r = await repo.submit({ playerId: 'secret', name: 'テスト', flag: '🇯🇵', score: 930, combo: 3 });
    expect(r).toEqual({ publicId: 'pub', rank: 7 });
    expect(calls[0].url).toBe(`${URL}/rest/v1/rpc/caramel_submit`);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      p_player_id: 'secret',
      p_name: 'テスト',
      p_flag: '🇯🇵',
      p_score: 930,
      p_combo: 3,
    });
  });

  it('サーバーが断った理由を見分ける', async () => {
    const { fn } = fakeFetch([{ status: 400, body: { code: '22023', message: 'invalid score' } }]);
    const repo = new SupabaseRankingRepository(URL, 'k', fn);
    await expect(repo.submit({ playerId: 's', name: 'x', flag: '🌏', score: 1, combo: 1 })).rejects.toMatchObject({
      kind: 'invalid-score',
    });
    expect(errorKind(400, 'name must be 1-12 characters')).toBe('invalid-name');
    expect(errorKind(400, 'too many requests')).toBe('too-many');
    expect(errorKind(503, '')).toBe('network');
  });

  it('つながらないときは network エラーにする', async () => {
    const repo = new SupabaseRankingRepository(URL, 'k', async () => {
      throw new TypeError('Failed to fetch');
    });
    const e = await repo.fetchTop(20).catch((err) => err);
    expect(e).toBeInstanceOf(RankingError);
    expect(e.kind).toBe('network');
  });
});

describe('プレイヤー情報', () => {
  it('名前は空白をまとめ、1〜12 文字だけ受け付ける（絵文字も 1 文字と数える）', () => {
    expect(sanitizeName('  プリン   太郎  ')).toBe('プリン 太郎');
    expect(sanitizeName('   ')).toBeNull();
    expect(sanitizeName('あいうえおかきくけこさし')).toBe('あいうえおかきくけこさし');
    expect(sanitizeName('あいうえおかきくけこさしす')).toBeNull();
    expect(sanitizeName('🍮🍮🍮🍮🍮🍮🍮🍮🍮🍮🍮🍮')).toBe('🍮🍮🍮🍮🍮🍮🍮🍮🍮🍮🍮🍮');
  });

  it('言語設定の地域から国旗を出す', () => {
    expect(flagFromLocale('ja-JP')).toBe('🇯🇵');
    expect(flagFromLocale('en_US')).toBe('🇺🇸');
    expect(flagFromLocale('zh-Hant-TW')).toBe('🇹🇼');
    expect(flagFromLocale('ja')).toBe('🌏');
    expect(flagFromLocale(undefined)).toBe('🌏');
  });
});

describe('シェアにゲームの URL を付ける', () => {
  it('URL があれば url パラメータに入れる', () => {
    const u = buildXShareUrl('本文', 'https://caramel.example.com');
    expect(u).toBe('https://x.com/intent/tweet?text=%E6%9C%AC%E6%96%87&url=https%3A%2F%2Fcaramel.example.com');
  });

  it('URL がなければ付けない', () => {
    expect(buildXShareUrl('本文', '')).toBe('https://x.com/intent/tweet?text=%E6%9C%AC%E6%96%87');
  });
});
