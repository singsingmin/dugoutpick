-- ============================================================================
-- 0015 · 랭킹 화면 순위를 보상 정산과 통일 — RANK() 서버 계산 + best_streak 노출
-- 문제: 기존 get_monthly_leaderboard/hitrate는 order by 점수/적중률만 하고 순위 컬럼이 없어,
--       앱이 배열 index+1로 순위를 매김 → 동점이 임의로 1/2/3위로 갈리고, 보상 정산(RANK())과 불일치.
-- 해결: RPC가 RANK()로 rank를 계산해 내려주고(동점=공동 순위), best_streak도 함께 반환.
--   타이브레이커는 grant_monthly_rewards와 동일:
--     포인트 랭킹  : 포인트 desc → 적중 수 desc → 적중률 desc → 최고 연속 desc
--     적중률 랭킹  : 적중률 desc → 적중 수 desc → 최고 연속 desc
--   반환 컬럼 변경(rank·best_streak 추가) → create or replace 불가, drop 선행 필수.
--   raw user_id는 여전히 미반환 — is_me boolean만.
-- 순서: 0006 → … → 0014 → 0015.
-- ============================================================================

drop function if exists public.get_monthly_leaderboard(text, int);
create function public.get_monthly_leaderboard(p_month text default null, p_limit int default 50)
returns table(rank int, nickname text, monthly_points int, hits int, participations int, best_streak int, is_me boolean)
language sql security definer set search_path = public as $$
  with agg as (
    select s.nickname,
           s.best_streak,
           (p.user_id = auth.uid()) as is_me,
           sum(p.ranking_points)::int as monthly_points,
           count(*) filter (where p.status = 'hit')::int as hits,
           count(*) filter (where p.status in ('hit','miss'))::int as participations,
           (count(*) filter (where p.status = 'hit'))::numeric
             / nullif(count(*) filter (where p.status in ('hit','miss')), 0) as hit_rate
    from public.predictions p
    join public.prediction_stats s on s.user_id = p.user_id
    where to_char(p.date, 'YYYYMM') = coalesce(p_month, to_char((now() at time zone 'Asia/Seoul')::date, 'YYYYMM'))
      and s.nickname is not null
    group by s.nickname, p.user_id, s.best_streak
  )
  select rank() over (order by monthly_points desc, hits desc, hit_rate desc, best_streak desc)::int as rank,
         nickname, monthly_points, hits, participations, best_streak, is_me
  from agg
  order by rank, nickname
  limit greatest(1, least(p_limit, 200));
$$;
revoke execute on function public.get_monthly_leaderboard(text,int) from anon;

drop function if exists public.get_monthly_hitrate_leaderboard(text, int, int);
create function public.get_monthly_hitrate_leaderboard(p_month text default null, p_min_participation int default 5, p_limit int default 50)
returns table(rank int, nickname text, hit_rate numeric, hits int, participations int, best_streak int, is_me boolean)
language sql security definer set search_path = public as $$
  with agg as (
    select s.nickname,
           s.best_streak,
           (p.user_id = auth.uid()) as is_me,
           count(*) filter (where p.status = 'hit')::int as hits,
           count(*) filter (where p.status in ('hit','miss'))::int as participations,
           (count(*) filter (where p.status = 'hit'))::numeric
             / nullif(count(*) filter (where p.status in ('hit','miss')), 0) as hit_rate_raw
    from public.predictions p
    join public.prediction_stats s on s.user_id = p.user_id
    where to_char(p.date, 'YYYYMM') = coalesce(p_month, to_char((now() at time zone 'Asia/Seoul')::date, 'YYYYMM'))
      and s.nickname is not null
    group by s.nickname, p.user_id, s.best_streak
    having count(*) filter (where p.status in ('hit','miss')) >= greatest(1, p_min_participation)
  )
  select rank() over (order by hit_rate_raw desc, hits desc, best_streak desc)::int as rank,
         nickname, round(100.0 * hit_rate_raw, 1) as hit_rate, hits, participations, best_streak, is_me
  from agg
  order by rank, nickname
  limit greatest(1, least(p_limit, 200));
$$;
revoke execute on function public.get_monthly_hitrate_leaderboard(text,int,int) from anon;
