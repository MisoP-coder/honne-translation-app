-- ============================================================================
-- 利用状況を見るための SQL
--
-- 使い方: Supabase ダッシュボード > SQL Editor に貼り付けて実行します。
--         SQL Editor は RLS を迂回するため、全ユーザーぶんが見えます。
--
--         【重要】ファイル全体を一度に貼らず、下の 1〜6 のブロックを
--         1つずつ貼って実行してください。まとめて実行すると、最後の
--         結果しか表示されません。
--
-- 料金の前提(2026年9月時点、claude-sonnet-5):
--   入力 $2 / 100万トークン、出力 $10 / 100万トークン、為替 150円/$
--   モデルや為替を変えたら、下の CTE の数値を書き換えてください。
-- ============================================================================

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
--    records_in_prompt が 3 以上なら、その上司専用の予測に切り替わっている
-- ----------------------------------------------------------------------------
select
  case when records_in_prompt >= 3 then '実績ベース' else '一般論ベース' end as 予測の種類,
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
