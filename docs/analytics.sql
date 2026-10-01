-- ============================================================================
-- 利用状況を見るための SQL
--
-- 使い方: Supabase ダッシュボード > SQL Editor に貼り付けて実行します。
--         SQL Editor は RLS を迂回するため、全ユーザーぶんが見えます。
--
--         【重要】ファイル全体を一度に貼らず、下の 0〜10 のブロックを
--         1つずつ貼って実行してください。まとめて実行すると、最後の
--         結果しか表示されません。
--
--         続けるか / やめるか を決めたいだけなら、0 だけで足ります。
--
-- 料金の前提(2026年9月時点、claude-sonnet-5):
--   入力 $2 / 100万トークン、出力 $10 / 100万トークン、為替 150円/$
--   モデルや為替を変えたら、下の CTE の数値を書き換えてください。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. 続けるかどうかを決めるための1枚。これだけ実行すれば判断できる
--    スマホでも読めるよう、横に広げず縦に並べている
-- ----------------------------------------------------------------------------
with price as (
  select 2.0::numeric as usd_in, 10.0::numeric as usd_out, 150::numeric as jpy
),
per_user as (
  select user_id, count(*) as n from public.analysis_logs group by user_id
),
calc as (
  select
    (select count(*) from auth.users)                                    as 登録者,
    (select count(distinct user_id) from public.analysis_logs)           as 相談者,
    (select count(*) from public.analysis_logs)                          as 相談回数,
    (select count(*) from per_user where n >= 2)                         as 二回以上,
    (select count(*) from public.analysis_logs
      where created_at >= now() - interval '7 days')                     as 直近7日の回数,
    (select count(distinct user_id) from public.analysis_logs
      where created_at >= now() - interval '7 days')                     as 直近7日の人数,
    (select round(sum(((input_tokens * p.usd_in / 1000000)
                     + (output_tokens * p.usd_out / 1000000)) * p.jpy), 0)
       from public.analysis_logs, price p)                               as 累計原価,
    (select count(*) from public.outcome_records where outcome is not null) as 記録数,
    (select count(*) from public.analysis_logs where records_in_prompt >= 2) as 実績ベース
)
select v.項目, v.数字, v.見かた
from calc c,
lateral (values
  (1, '登録した人',       c.登録者::text || ' 人', '—'),
  (2, 'うち相談した人',   c.相談者::text || ' 人',
      coalesce(round(100.0 * c.相談者 / nullif(c.登録者, 0))::text || '% が相談まで到達', '—')),
  (3, '相談回数',         c.相談回数::text || ' 回', '—'),
  (4, '2回以上使った人',  c.二回以上::text || ' 人',
      coalesce(round(100.0 * c.二回以上 / nullif(c.相談者, 0), 1)::text || '%  … 3割超なら定着あり', '—')),
  (5, '直近7日の相談',    c.直近7日の回数::text || ' 回 / ' || c.直近7日の人数::text || ' 人',
      case when c.直近7日の回数 = 0 then '今は誰も使っていない' else 'まだ使われている' end),
  (6, '累計の原価',       coalesce(c.累計原価::text, '0') || ' 円',
      coalesce('1回あたり ' || round(c.累計原価 / nullif(c.相談回数, 0), 1)::text || ' 円', '—')),
  (7, '結果の記録率',     c.記録数::text || ' 件',
      coalesce(round(100.0 * c.記録数 / nullif(c.相談回数, 0), 1)::text || '%  … 学習が回っているか', '—')),
  (8, '実績ベースの予測', c.実績ベース::text || ' 回',
      coalesce(round(100.0 * c.実績ベース / nullif(c.相談回数, 0), 1)::text || '%  … 1割超ならこのアプリの価値が出ている', '—'))
) as v(n, 項目, 数字, 見かた)
order by v.n;

-- ----------------------------------------------------------------------------
-- 1. 全体サマリー。まずこれを見る
-- ----------------------------------------------------------------------------
with price as (
  select 2.0::numeric as usd_per_m_input, 10.0::numeric as usd_per_m_output, 150::numeric as jpy_per_usd
)
select
  count(*)                                          as 相談回数,
  count(distinct user_id)                           as 利用者数,
  round(count(*)::numeric / nullif(count(distinct user_id), 0), 1) as 一人あたり平均回数,
  round(avg(input_tokens))                          as 平均入力トークン,
  round(avg(output_tokens))                         as 平均出力トークン,
  -- 円換算は avg / sum の「中」で掛ける。外に出すと、集計していない列を
  -- 参照したことになり "must appear in the GROUP BY clause" で失敗する
  round(
    avg(
      ( (input_tokens  * p.usd_per_m_input  / 1000000)
      + (output_tokens * p.usd_per_m_output / 1000000) ) * p.jpy_per_usd
    )
  , 2)                                              as 平均原価_円,
  round(
    sum(
      ( (input_tokens  * p.usd_per_m_input  / 1000000)
      + (output_tokens * p.usd_per_m_output / 1000000) ) * p.jpy_per_usd
    )
  , 1)                                              as 累計原価_円
from public.analysis_logs, price p;

-- ----------------------------------------------------------------------------
-- 2. 日ごとの推移。使われ続けているかを見る
-- ----------------------------------------------------------------------------
with price as (
  select 2.0::numeric as i, 10.0::numeric as o, 150::numeric as jpy
)
select
  date_trunc('day', created_at at time zone 'Asia/Tokyo')::date as 日付,
  count(*)                as 相談回数,
  count(distinct user_id) as 利用者数,
  round(sum((((input_tokens * p.i / 1000000) + (output_tokens * p.o / 1000000)) * p.jpy)), 1) as 原価_円
from public.analysis_logs, price p
group by 1
order by 1 desc
limit 30;

-- ----------------------------------------------------------------------------
-- 3. ユーザーごとの利用回数。リピーターがいるかを見る
--    有料プランの回数上限を決めるとき、この分布が根拠になる
-- ----------------------------------------------------------------------------
select
  user_id,
  count(*)                                           as 相談回数,
  min(created_at at time zone 'Asia/Tokyo')::date     as 初回,
  max(created_at at time zone 'Asia/Tokyo')::date     as 最終,
  -- 初回・最終と同じ日本時間で引く(UTC のまま引くと日付がずれる)
  max(created_at at time zone 'Asia/Tokyo')::date
  - min(created_at at time zone 'Asia/Tokyo')::date     as 利用日数の幅
from public.analysis_logs
group by user_id
order by 相談回数 desc;

-- ----------------------------------------------------------------------------
-- 4. 定着率。「2回以上使った人」が何割いるか
--    1回で離脱するなら、課金以前に体験の見直しが必要
-- ----------------------------------------------------------------------------
with per_user as (
  select user_id, count(*) as n from public.analysis_logs group by user_id
)
select
  count(*)                                                          as 利用者数,
  count(*) filter (where n >= 2)                                    as 二回以上,
  count(*) filter (where n >= 5)                                    as 五回以上,
  round(100.0 * count(*) filter (where n >= 2) / nullif(count(*), 0), 1) as 二回以上の割合_パーセント
from per_user;

-- ----------------------------------------------------------------------------
-- 5. 実績データが予測に使われているか
--    records_in_prompt が 2 以上なら、その相手専用の予測に切り替わっている
--    (件数は lib/constants.js の RECORDS_THRESHOLD と合わせること)
-- ----------------------------------------------------------------------------
select
  case when records_in_prompt >= 2 then '実績ベース' else '一般論ベース' end as 予測の種類,
  count(*) as 回数
from public.analysis_logs
group by 1;

-- ----------------------------------------------------------------------------
-- 6. 結果の記録がどれくらい残されているか
--    相談したあと「うまくいった/様子見/こじれた」を押した割合。
--    学習の仕組みが回っているかの指標になる
-- ----------------------------------------------------------------------------
select
  (select count(*) from public.analysis_logs)   as 相談回数,
  (select count(*) from public.outcome_records) as 記録された回数,
  round(
    100.0 * (select count(*) from public.outcome_records)
          / nullif((select count(*) from public.analysis_logs), 0)
  , 1) as 記録率_パーセント;

-- ----------------------------------------------------------------------------
-- 7. どこで人が止まっているか(離脱の段階)
--    analysis_logs に載るのは「候補の生成に成功した人」だけなので、
--    登録したまま相談していない人は 1〜6 の数字には現れない。
--    人数が段階ごとに大きく落ちていたら、そこが直すべき場所。
-- ----------------------------------------------------------------------------
select '1. アカウント登録' as 段階, count(*)                as 人数 from auth.users
union all
select '2. 上司を登録',     count(distinct user_id)         from public.boss_profiles
union all
select '3. 相談した',       count(distinct user_id)         from public.analysis_logs
union all
select '4. 結果を記録した', count(distinct user_id)         from public.outcome_records
order by 1;

-- ----------------------------------------------------------------------------
-- 8. 相談まで進んでいない人の一覧
--    7 で落ち込みが見えたとき、いつ登録した人が止まっているのかを見る
-- ----------------------------------------------------------------------------
select
  u.id                                                as user_id,
  (u.created_at at time zone 'Asia/Tokyo')::date      as 登録日,
  count(distinct b.id)                                as 登録した上司の数
from auth.users u
left join public.boss_profiles b on b.user_id = u.id
where not exists (select 1 from public.analysis_logs a where a.user_id = u.id)
group by u.id, u.created_at
order by 登録日;

-- ----------------------------------------------------------------------------
-- 9. なぜ「実績ベース」に切り替わらないのかを調べる
--    5 が「一般論ベース」ばかりのときに実行する。
--    実績は相手ごとに数えるので、相談する相手が分散していると、
--    合計では2件を超えていても1人あたりでは2件に届かないことがある。
-- ----------------------------------------------------------------------------
select
  b.name                                             as 相手,
  count(distinct a.id)                               as 相談回数,
  count(distinct o.id)                               as 記録数,
  case when count(distinct o.id) >= 2
       then '実績が効く' else 'あと ' || (2 - count(distinct o.id)) || ' 件' end as 状態
from public.boss_profiles b
left join public.analysis_logs   a on a.profile_id = b.id
left join public.outcome_records o on o.profile_id = b.id
group by b.id, b.name
order by 記録数 desc;

-- ----------------------------------------------------------------------------
-- 10. 記録が上司に正しく結びついているかの確認
--     outcome_records に channel 列が無いと、実績の取得ごと失敗して
--     常に「一般論ベース」になる。列が出てこない場合は
--     supabase/schema.sql を貼り直すこと。
-- ----------------------------------------------------------------------------
select column_name as 列名
from information_schema.columns
where table_schema = 'public' and table_name = 'outcome_records'
order by ordinal_position;
