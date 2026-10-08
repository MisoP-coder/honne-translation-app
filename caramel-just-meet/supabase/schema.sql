-- ============================================================================
-- 極限！カラメル・ジャスト・ミート 世界ランキング Supabase スキーマ
--
-- 使い方:
--   Supabase ダッシュボード > SQL Editor にこのファイルの内容を貼り付けて実行。
--   何度実行しても安全なように書いてあります（IF NOT EXISTS / CREATE OR REPLACE）。
--
-- しくみ:
--   - ログインはしない。端末ごとにランダムな「合言葉」（player_id）を作って端末に保存し、
--     それで自分の記録を更新する。player_id は誰にも見せない（他人の記録を書き換えられないように）。
--   - テーブルはブラウザから直接読み書きできない。読み書きは下の関数（RPC）だけ。
--   - 送られてきたスコアは、ゲームのルールでありえる値かどうかを確かめてから保存する。
--     （ブラウザで動くゲームなので完全には防げないが、雑な改ざんはここで弾く）
-- ============================================================================

create table if not exists public.caramel_scores (
  -- 端末ごとの合言葉（非公開）
  player_id   uuid primary key,
  -- ランキング表示用の公開 ID（自分の行を見分けるのに使う）
  public_id   uuid not null unique default gen_random_uuid(),
  player_name text not null check (char_length(player_name) between 1 and 12),
  flag        text not null default '🌏' check (char_length(flag) between 1 and 8),
  score       integer not null check (score >= 0),
  combo       integer not null check (combo >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists caramel_scores_rank_idx
  on public.caramel_scores (score desc, combo desc, updated_at asc);

-- ブラウザ（anon / authenticated）からはテーブルを直接触らせない。RLS を有効にしてポリシーは作らない
alter table public.caramel_scores enable row level security;
revoke all on public.caramel_scores from anon, authenticated;

-- ---------------------------------------------------------------------------
-- スコアがゲームのルール上ありえる値か
--   1 回の成功で入る点 = JUST MEET 300 / GOOD 100 ＋ それまでの連続数 × 10
--   → 連続 n 回のスコア = 100n + 200p + 5n(n-1)（p は JUST MEET の回数、0 ≦ p ≦ n）
-- ---------------------------------------------------------------------------
create or replace function public.caramel_is_valid_score(p_score integer, p_combo integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_combo between 1 and 10000
     and p_score - (100 * p_combo + 5 * p_combo * (p_combo - 1)) between 0 and 200 * p_combo
     and (p_score - (100 * p_combo + 5 * p_combo * (p_combo - 1))) % 200 = 0;
$$;

-- ---------------------------------------------------------------------------
-- 上位を取る（名前・国旗・スコア・連続数・順位だけを返す）
-- ---------------------------------------------------------------------------
create or replace function public.caramel_top(p_limit integer default 20)
returns table (public_id uuid, player_name text, flag text, score integer, combo integer, rank bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select s.public_id, s.player_name, s.flag, s.score, s.combo,
         rank() over (order by s.score desc, s.combo desc) as rank
  from public.caramel_scores s
  order by s.score desc, s.combo desc, s.updated_at asc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

-- ---------------------------------------------------------------------------
-- このスコアなら何位か（自分が上位に入っていないときの表示用）
-- ---------------------------------------------------------------------------
create or replace function public.caramel_rank(p_score integer, p_combo integer)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select 1 + count(*)
  from public.caramel_scores s
  where s.score > p_score or (s.score = p_score and s.combo > p_combo);
$$;

-- ---------------------------------------------------------------------------
-- 記録を登録する。自己ベストより良いときだけスコアを更新し、名前と国旗はいつでも変えられる。
-- 戻り値: 公開 ID と、登録後の順位
-- ---------------------------------------------------------------------------
create or replace function public.caramel_submit(
  p_player_id uuid,
  p_name text,
  p_flag text,
  p_score integer,
  p_combo integer
)
returns table (public_id uuid, rank bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '[[:cntrl:]]|\s+', ' ', 'g');
  v_flag text := coalesce(nullif(trim(p_flag), ''), '🌏');
  v_row public.caramel_scores;
begin
  if p_player_id is null then
    raise exception 'player_id is required' using errcode = '22023';
  end if;
  if char_length(v_name) not between 1 and 12 then
    raise exception 'name must be 1-12 characters' using errcode = '22023';
  end if;
  if char_length(v_flag) > 8 then
    v_flag := '🌏';
  end if;
  if not public.caramel_is_valid_score(p_score, p_combo) then
    raise exception 'invalid score' using errcode = '22023';
  end if;

  -- 連打で何度も送られないよう、同じ端末からは 2 秒に 1 回まで
  select * into v_row from public.caramel_scores s where s.player_id = p_player_id;
  if found and v_row.updated_at > now() - interval '2 seconds' then
    raise exception 'too many requests' using errcode = '22023';
  end if;

  insert into public.caramel_scores as s (player_id, player_name, flag, score, combo)
  values (p_player_id, v_name, v_flag, p_score, p_combo)
  on conflict (player_id) do update
    set player_name = excluded.player_name,
        flag        = excluded.flag,
        score       = case when (excluded.score, excluded.combo) > (s.score, s.combo)
                           then excluded.score else s.score end,
        combo       = case when (excluded.score, excluded.combo) > (s.score, s.combo)
                           then excluded.combo else s.combo end,
        updated_at  = now()
  returning * into v_row;

  return query
    select v_row.public_id, public.caramel_rank(v_row.score, v_row.combo);
end;
$$;

-- 関数はブラウザから呼べるようにする（テーブルそのものは触れない）
revoke all on function public.caramel_top(integer) from public;
revoke all on function public.caramel_rank(integer, integer) from public;
revoke all on function public.caramel_submit(uuid, text, text, integer, integer) from public;
revoke all on function public.caramel_is_valid_score(integer, integer) from public;
grant execute on function public.caramel_top(integer) to anon, authenticated;
grant execute on function public.caramel_rank(integer, integer) to anon, authenticated;
grant execute on function public.caramel_submit(uuid, text, text, integer, integer) to anon, authenticated;
