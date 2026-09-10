-- ============================================================================
-- 「言いにくいことの翻訳」アプリ Supabase スキーマ
--
-- 使い方:
--   Supabase ダッシュボード > SQL Editor にこのファイルの内容を貼り付けて実行。
--   何度実行しても安全なように書いてあります(IF NOT EXISTS / DROP POLICY IF EXISTS)。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 上司プロフィール
-- ---------------------------------------------------------------------------
create table if not exists public.boss_profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 60),
  -- 5つの特性。アプリ側の TRAIT_QUESTIONS のキーと対応:
  -- { reaction, order, channel, detail, mistake }
  traits      jsonb not null default '{}'::jsonb,
  -- 地雷ワード・NGな言い方などの自由記述メモ
  note        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists boss_profiles_user_id_idx
  on public.boss_profiles (user_id, created_at);

-- ---------------------------------------------------------------------------
-- 実績データ(使った言い方とその結果)
-- ---------------------------------------------------------------------------
create table if not exists public.outcome_records (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  profile_id     uuid not null references public.boss_profiles (id) on delete cascade,
  situation      text not null,
  message        text not null,
  candidate_type text not null default '',
  outcome        text not null check (outcome in ('うまくいった', '様子見', 'こじれた')),
  created_at     timestamptz not null default now()
);

create index if not exists outcome_records_profile_idx
  on public.outcome_records (profile_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at の自動更新
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists boss_profiles_set_updated_at on public.boss_profiles;
create trigger boss_profiles_set_updated_at
  before update on public.boss_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
--   ブラウザからは anon key で直接アクセスするため、RLS が唯一の認可レイヤーです。
--   「自分の行だけ読める・書ける」を全操作に対して設定します。
-- ---------------------------------------------------------------------------
alter table public.boss_profiles  enable row level security;
alter table public.outcome_records enable row level security;

drop policy if exists "boss_profiles_select_own" on public.boss_profiles;
create policy "boss_profiles_select_own" on public.boss_profiles
  for select using (auth.uid() = user_id);

drop policy if exists "boss_profiles_insert_own" on public.boss_profiles;
create policy "boss_profiles_insert_own" on public.boss_profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "boss_profiles_update_own" on public.boss_profiles;
create policy "boss_profiles_update_own" on public.boss_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "boss_profiles_delete_own" on public.boss_profiles;
create policy "boss_profiles_delete_own" on public.boss_profiles
  for delete using (auth.uid() = user_id);

drop policy if exists "outcome_records_select_own" on public.outcome_records;
create policy "outcome_records_select_own" on public.outcome_records
  for select using (auth.uid() = user_id);

drop policy if exists "outcome_records_insert_own" on public.outcome_records;
create policy "outcome_records_insert_own" on public.outcome_records
  for insert with check (
    auth.uid() = user_id
    -- 他人のプロフィールに紐づく記録は作れない
    and exists (
      select 1 from public.boss_profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "outcome_records_delete_own" on public.outcome_records;
create policy "outcome_records_delete_own" on public.outcome_records
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 利用ログ
--   1回の候補生成ごとに1行。何人が何回使い、原価がいくらかかったかを見るため。
--   相談内容そのものは保存しない(必要な文面は outcome_records 側にある)。
-- ---------------------------------------------------------------------------
create table if not exists public.analysis_logs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  profile_id        uuid references public.boss_profiles (id) on delete set null,
  model             text not null,
  input_tokens      integer not null default 0,
  output_tokens     integer not null default 0,
  -- プロンプトに載せた実績データの件数。学習が効いているかの確認用
  records_in_prompt integer not null default 0,
  created_at        timestamptz not null default now()
);

create index if not exists analysis_logs_created_at_idx
  on public.analysis_logs (created_at desc);

create index if not exists analysis_logs_user_idx
  on public.analysis_logs (user_id, created_at desc);

alter table public.analysis_logs enable row level security;

-- 集計は SQL Editor(RLS を迂回する権限)から行う。
-- ユーザー自身には、自分の行の参照と追加だけを許可する。削除は許可しない。
drop policy if exists "analysis_logs_select_own" on public.analysis_logs;
create policy "analysis_logs_select_own" on public.analysis_logs
  for select using (auth.uid() = user_id);

drop policy if exists "analysis_logs_insert_own" on public.analysis_logs;
create policy "analysis_logs_insert_own" on public.analysis_logs
  for insert with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 伝え方(口頭 / メール・チャット)の記録
--   相談ごとに選ぶため、上司プロフィールの「好む連絡手段」とは別に持つ。
--   既存のテーブルに後から足すので alter で追加する。
-- ---------------------------------------------------------------------------
alter table public.outcome_records
  add column if not exists channel text not null default '';

-- ---------------------------------------------------------------------------
-- 結果待ちの記録
--   メールなど、伝えてすぐに反応が分かるとは限らないため、「使った言い方」を
--   先に保存し、結果は後から埋められるようにする。outcome が null の行が
--   「結果待ち」を表す。CHECK 制約は null では判定されないので、NOT NULL を
--   外すだけでよい。
-- ---------------------------------------------------------------------------
alter table public.outcome_records
  alter column outcome drop not null;

-- 結果待ちの行に、あとから結果を書き込むためのポリシー。
-- 他人のプロフィールへ付け替えられないよう、insert と同じ条件を課す。
drop policy if exists "outcome_records_update_own" on public.outcome_records;
create policy "outcome_records_update_own" on public.outcome_records
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.boss_profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 全体の1日あたりの利用回数
--   analysis_logs は RLS で「自分の行だけ」に絞られるため、普通に数えると
--   自分のぶんしか数えられない。全体に蓋をするには他人の行も数える必要が
--   あるので、security definer の関数で「件数だけ」を返す。
--   サービスロールキーを増やさずに済むぶん、こちらのほうが安全。
-- ---------------------------------------------------------------------------
create or replace function public.analysis_count_today()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int
  from public.analysis_logs
  where created_at >= (date_trunc('day', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo');
$$;

-- 返すのは件数だけだが、呼べる相手はログイン済みの利用者に限る
revoke all on function public.analysis_count_today() from public;
grant execute on function public.analysis_count_today() to authenticated;
