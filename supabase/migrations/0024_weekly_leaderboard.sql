-- ============================================================================
-- 0024 · 개인 주간 랭킹 (Phase 5) — 월간 리더보드(0015)의 KST 주(월~일) 윈도우판
-- 로드맵 Phase 5. 설계: 2026-07-13 논의(추천안 확정).
--   보드 3종: 주간 포인트("이번 주 예측왕") · 주간 적중률 · 내 응원팀 주간 랭킹
--   - 시간창 = KST 주(월요일 시작). 기본값 = 이번 주 월요일(Asia/Seoul).
--   - 로직·타이브레이커는 월간(0015)과 동일, 월 필터만 주 범위로 교체.
--   - 적중률 최소 참여는 주간이라 낮게(기본 3회. 월간은 5회).
--   - 보상 = 명예만(야구공 미지급, 2026-07-09 경제 결정). v1 = 뷰 전용(정산/칭호 없음).
--   - 응원팀 = profiles.favorite_team(서버 보관). 내 팀 팬끼리만 랭킹.
--   - user_id 미반환(is_me만). rank = 서버 RANK()(동점=공동 순위).
-- 순서: 0015 → … → 0023 → 0024.
-- ============================================================================

-- KST 이번 주 월요일 (기본 윈도우 시작일)
create or replace function public.kst_week_start()
returns date language sql stable set search_path = public as $$
  select (date_trunc('week', (now() at time zone 'Asia/Seoul')::date))::date;
$$;

-- 1) 주간 포인트 랭킹 ("이번 주 예측왕")
drop function if exists public.get_weekly_leaderboard(date, int);
create function public.get_weekly_leaderboard(p_week_start date default null, p_limit int default 50)
returns table(rank int, nickname text, weekly_points int, hits int, participations int, best_streak int, is_me boolean)
language sql security definer set search_path = public as $$
  with ws as (select coalesce(p_week_start, public.kst_week_start()) as d),
  agg as (
    select s.nickname,
           s.best_streak,
           (p.user_id = auth.uid()) as is_me,
           sum(p.ranking_points)::int as weekly_points,
           count(*) filter (where p.status = 'hit')::int as hits,
           count(*) filter (where p.status in ('hit','miss'))::int as participations,
           (count(*) filter (where p.status = 'hit'))::numeric
             / nullif(count(*) filter (where p.status in ('hit','miss')), 0) as hit_rate
    from public.predictions p
    join public.prediction_stats s on s.user_id = p.user_id
    cross join ws
    where p.date >= ws.d and p.date < ws.d + 7
      and s.nickname is not null
    group by s.nickname, p.user_id, s.best_streak
  )
  select rank() over (order by weekly_points desc, hits desc, hit_rate desc, best_streak desc)::int as rank,
         nickname, weekly_points, hits, participations, best_streak, is_me
  from agg
  order by rank, nickname
  limit greatest(1, least(p_limit, 200));
$$;
revoke execute on function public.get_weekly_leaderboard(date,int) from anon;

-- 2) 주간 적중률 랭킹 (최소 참여 기본 3회)
drop function if exists public.get_weekly_hitrate_leaderboard(date, int, int);
create function public.get_weekly_hitrate_leaderboard(p_week_start date default null, p_min_participation int default 3, p_limit int default 50)
returns table(rank int, nickname text, hit_rate numeric, hits int, participations int, best_streak int, is_me boolean)
language sql security definer set search_path = public as $$
  with ws as (select coalesce(p_week_start, public.kst_week_start()) as d),
  agg as (
    select s.nickname,
           s.best_streak,
           (p.user_id = auth.uid()) as is_me,
           count(*) filter (where p.status = 'hit')::int as hits,
           count(*) filter (where p.status in ('hit','miss'))::int as participations,
           (count(*) filter (where p.status = 'hit'))::numeric
             / nullif(count(*) filter (where p.status in ('hit','miss')), 0) as hit_rate_raw
    from public.predictions p
    join public.prediction_stats s on s.user_id = p.user_id
    cross join ws
    where p.date >= ws.d and p.date < ws.d + 7
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
revoke execute on function public.get_weekly_hitrate_leaderboard(date,int,int) from anon;

-- 3) 내 응원팀 주간 랭킹 (favorite_team = 내 팀인 사람끼리 포인트 랭킹)
--    응원팀 미설정(favorite_team null)이면 빈 결과.
drop function if exists public.get_weekly_team_leaderboard(date, int);
create function public.get_weekly_team_leaderboard(p_week_start date default null, p_limit int default 50)
returns table(rank int, nickname text, weekly_points int, hits int, participations int, best_streak int, is_me boolean)
language sql security definer set search_path = public as $$
  with ws as (select coalesce(p_week_start, public.kst_week_start()) as d),
       me as (select favorite_team as t from public.profiles where id = auth.uid()),
  agg as (
    select s.nickname,
           s.best_streak,
           (p.user_id = auth.uid()) as is_me,
           sum(p.ranking_points)::int as weekly_points,
           count(*) filter (where p.status = 'hit')::int as hits,
           count(*) filter (where p.status in ('hit','miss'))::int as participations,
           (count(*) filter (where p.status = 'hit'))::numeric
             / nullif(count(*) filter (where p.status in ('hit','miss')), 0) as hit_rate
    from public.predictions p
    join public.prediction_stats s on s.user_id = p.user_id
    join public.profiles pr on pr.id = p.user_id
    cross join ws, me
    where p.date >= ws.d and p.date < ws.d + 7
      and s.nickname is not null
      and me.t is not null and pr.favorite_team = me.t
    group by s.nickname, p.user_id, s.best_streak
  )
  select rank() over (order by weekly_points desc, hits desc, hit_rate desc, best_streak desc)::int as rank,
         nickname, weekly_points, hits, participations, best_streak, is_me
  from agg
  order by rank, nickname
  limit greatest(1, least(p_limit, 200));
$$;
revoke execute on function public.get_weekly_team_leaderboard(date,int) from anon;
