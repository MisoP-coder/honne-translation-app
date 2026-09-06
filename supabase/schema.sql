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
