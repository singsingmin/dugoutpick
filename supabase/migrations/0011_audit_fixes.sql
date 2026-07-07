-- ============================================================================
-- 0011 · 감사 리포트 수정(docs/audit-prediction-league-2026-07.md)
-- 0006~0010 적용 후 마지막에 실행. 이 파일 하나로 P2 DB 수정을 원자 적용한다.
-- 포함:
--   P2-1  집계 필터를 status <> 'void' → status in ('hit','miss')로(pending 참여수 오염 방지)
--   P2-3  redeem_referral_code 브루트포스 방어(일일 실패시도 캡 + 시도 로그)
--   P2-4  referral_redemptions 직접 select 잠금 → referrer UUID 비노출(has_redeemed RPC로 대체)
--   P2-5  grant_season_rewards dry-run 모드(파라미터 실수 방지)
--   P2-6  batch_runs 정산 로그 테이블(월간/시즌 정산 실행 기록)
-- ============================================================================

-- ─────────────────────────────────────────────────────────────
-- P2-6. 정산 배치 실행 로그 (service_role/대시보드 전용)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.batch_runs (
  id           uuid primary key default gen_random_uuid(),
  job_type     text not null check (job_type in ('monthly_rewards','season_rewards')),
  period_label text,
  dry_run      boolean not null default false,
  result       jsonb,
  created_at   timestamptz not null default now()
);
alter table public.batch_runs enable row level security;
revoke all on public.batch_runs from anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- P2-4. referral_redemptions 직접 select 잠금 (referrer/referee UUID 비노출)
--   클라는 "내가 이미 입력했는가"만 필요 → has_redeemed_referral() 정의 함수로 대체.
--   테이블 자체는 잠그고(다른 민감 테이블과 동일), 지급 로직은 definer 함수만 접근.
-- ─────────────────────────────────────────────────────────────
drop policy if exists "referral_redemptions_select_own" on public.referral_redemptions;
revoke select on public.referral_redemptions from authenticated;

create or replace function public.has_redeemed_referral()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.referral_redemptions where referee_user_id = auth.uid()
  );
$$;
revoke execute on function public.has_redeemed_referral() from anon;

-- ─────────────────────────────────────────────────────────────
-- P2-3. 추천코드 입력 브루트포스 방어 — 잘못된 코드 시도 로그 + 일일 캡(20회).
-- ─────────────────────────────────────────────────────────────
create table if not exists public.referral_redeem_attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  succeeded    boolean not null,
  attempted_at timestamptz not null default now()
);
create index if not exists referral_redeem_attempts_user_idx
  on public.referral_redeem_attempts (user_id, attempted_at);
alter table public.referral_redeem_attempts enable row level security;
revoke all on public.referral_redeem_attempts from anon, authenticated;

-- redeem_referral_code 재작성(0010 로직 유지 + 캡). 코드 조회 실패(invalid_code)만 시도로 카운트.
create or replace function public.redeem_referral_code(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  referrer uuid;
  normalized text := upper(trim(coalesce(p_code, '')));
  is_anon boolean;
  today date := (now() at time zone 'Asia/Seoul')::date;
  daily_fails int;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  select is_anonymous into is_anon from auth.users where id = uid;
  if coalesce(is_anon, true) then
    return json_build_object('success', false, 'reason', 'not_protected');
  end if;

  if exists (select 1 from public.referral_redemptions where referee_user_id = uid) then
    return json_build_object('success', false, 'reason', 'already_redeemed');
  end if;

  -- 브루트포스 캡: 오늘 실패 시도 20회 이상이면 차단(코드 공간이 커 실질위협은 낮지만 흔적/제한 확보).
  select count(*) into daily_fails from public.referral_redeem_attempts
    where user_id = uid and not succeeded
      and (attempted_at at time zone 'Asia/Seoul')::date = today;
  if daily_fails >= 20 then
    return json_build_object('success', false, 'reason', 'too_many_attempts');
  end if;

  if length(normalized) = 0 then
    insert into public.referral_redeem_attempts (user_id, succeeded) values (uid, false);
    return json_build_object('success', false, 'reason', 'invalid_code');
  end if;

  select id into referrer from public.profiles where referral_code = normalized;
  if referrer is null then
    insert into public.referral_redeem_attempts (user_id, succeeded) values (uid, false);
    return json_build_object('success', false, 'reason', 'invalid_code');
  end if;
  if referrer = uid then
    return json_build_object('success', false, 'reason', 'self_referral');
  end if;

  insert into public.referral_redemptions (referrer_user_id, referee_user_id, referral_code_used, referee_reward, referrer_reward)
  values (referrer, uid, normalized, 10, 10);

  insert into public.baseball_ledger (user_id, type, amount, reason, label)
  values (uid, 'earn', 10, 'referral_referee', '추천코드 입력 보상');
  update public.profiles set balance = balance + 10, updated_at = now() where id = uid;

  insert into public.referral_redeem_attempts (user_id, succeeded) values (uid, true);
  return json_build_object('success', true, 'reward', 10);
end;
$$;
revoke execute on function public.redeem_referral_code(text) from anon;

-- ─────────────────────────────────────────────────────────────
-- P2-1. 리더보드 집계 필터: status <> 'void'(=pending 포함) → status in ('hit','miss')
--   반환 타입은 0008과 동일(is_me 포함) → create or replace로 교체 가능.
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_monthly_leaderboard(p_month text default null, p_limit int default 50)
returns table(nickname text, monthly_points int, hits int, participations int, is_me boolean)
language sql security definer set search_path = public as $$
  select s.nickname,
         sum(p.ranking_points)::int as monthly_points,
         count(*) filter (where p.status = 'hit')::int as hits,
         count(*) filter (where p.status in ('hit','miss'))::int as participations,
         (p.user_id = auth.uid()) as is_me
  from public.predictions p
  join public.prediction_stats s on s.user_id = p.user_id
  where to_char(p.date, 'YYYYMM') = coalesce(p_month, to_char((now() at time zone 'Asia/Seoul')::date, 'YYYYMM'))
    and s.nickname is not null
  group by s.nickname, p.user_id
  order by monthly_points desc
  limit greatest(1, least(p_limit, 200));
$$;
revoke execute on function public.get_monthly_leaderboard(text,int) from anon;

create or replace function public.get_monthly_hitrate_leaderboard(p_month text default null, p_min_participation int default 5, p_limit int default 50)
returns table(nickname text, hit_rate numeric, hits int, participations int, is_me boolean)
language sql security definer set search_path = public as $$
  select s.nickname,
         round(100.0 * count(*) filter (where p.status = 'hit') / nullif(count(*) filter (where p.status in ('hit','miss')), 0), 1) as hit_rate,
         count(*) filter (where p.status = 'hit')::int as hits,
         count(*) filter (where p.status in ('hit','miss'))::int as participations,
         (p.user_id = auth.uid()) as is_me
  from public.predictions p
  join public.prediction_stats s on s.user_id = p.user_id
  where to_char(p.date, 'YYYYMM') = coalesce(p_month, to_char((now() at time zone 'Asia/Seoul')::date, 'YYYYMM'))
    and s.nickname is not null
  group by s.nickname, p.user_id
  having count(*) filter (where p.status in ('hit','miss')) >= greatest(1, p_min_participation)
  order by hit_rate desc
  limit greatest(1, least(p_limit, 200));
$$;
revoke execute on function public.get_monthly_hitrate_leaderboard(text,int,int) from anon;

-- ─────────────────────────────────────────────────────────────
-- P2-1 + P2-6. grant_monthly_rewards 재작성 — 집계 필터 교체 + batch_runs 로그.
--   동점자 RANK() 로직·CTE 체인·멱등 제약은 0008과 동일(필터만 status in ('hit','miss')).
-- ─────────────────────────────────────────────────────────────
create or replace function public.grant_monthly_rewards(p_month text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  month text := coalesce(p_month, to_char((now() at time zone 'Asia/Seoul')::date - interval '1 day', 'YYYYMM'));
  champion_count int; top10_count int := 0; detective_count int; participant_count int;
  top10_granted boolean := false; result_json json;
begin
  with ranked as (
    select p.user_id, s.nickname,
      sum(p.ranking_points) as pts,
      count(*) filter (where p.status = 'hit') as hits,
      (count(*) filter (where p.status = 'hit'))::numeric / nullif(count(*) filter (where p.status in ('hit','miss')), 0) as hit_rate,
      s.best_streak,
      rank() over (order by sum(p.ranking_points) desc,
                   count(*) filter (where p.status = 'hit') desc,
                   (count(*) filter (where p.status = 'hit'))::numeric / nullif(count(*) filter (where p.status in ('hit','miss')), 0) desc,
                   s.best_streak desc) as rnk
    from public.predictions p join public.prediction_stats s on s.user_id = p.user_id
    where to_char(p.date, 'YYYYMM') = month and s.nickname is not null
    group by p.user_id, s.nickname, s.best_streak
  ),
  champions as (select * from ranked where rnk = 1),
  gt as (insert into public.owned_titles (user_id, title_id, acquired_via)
    select user_id, 'title.monthly_champion.' || month, 'monthly_rank' from champions
    on conflict (user_id, title_id) do nothing returning user_id),
  gb as (insert into public.owned_backgrounds (user_id, background_id, acquired_via)
    select user_id, 'lockerbg.monthly_champion', 'monthly_rank' from champions
    on conflict (user_id, background_id) do nothing returning user_id),
  hist as (insert into public.award_history (period_type, period_label, award_type, rank, granted_title_id, granted_background_id, user_id, display_name_snapshot)
    select 'monthly', month, 'champion', 1, 'title.monthly_champion.' || month, 'lockerbg.monthly_champion', user_id, nickname from champions
    on conflict (period_type, period_label, award_type, user_id) do nothing returning user_id)
  select count(*) into champion_count from champions;

  select count(distinct p.user_id) into participant_count
    from public.predictions p where to_char(p.date, 'YYYYMM') = month and p.status in ('hit','miss');

  if participant_count >= 20 then
    top10_granted := true;
    with ranked as (
      select p.user_id, s.nickname,
        rank() over (order by sum(p.ranking_points) desc,
                     count(*) filter (where p.status = 'hit') desc,
                     (count(*) filter (where p.status = 'hit'))::numeric / nullif(count(*) filter (where p.status in ('hit','miss')), 0) desc,
                     s.best_streak desc) as rnk
      from public.predictions p join public.prediction_stats s on s.user_id = p.user_id
      where to_char(p.date, 'YYYYMM') = month and s.nickname is not null
      group by p.user_id, s.nickname, s.best_streak
    ),
    top10 as (select * from ranked where rnk <= 10),
    gt as (insert into public.owned_titles (user_id, title_id, acquired_via)
      select user_id, 'title.monthly_top10.' || month, 'monthly_rank' from top10
      on conflict (user_id, title_id) do nothing returning user_id),
    hist as (insert into public.award_history (period_type, period_label, award_type, rank, granted_title_id, user_id, display_name_snapshot)
      select 'monthly', month, 'top10', rnk, 'title.monthly_top10.' || month, user_id, nickname from top10
      on conflict (period_type, period_label, award_type, user_id) do nothing returning user_id)
    select count(*) into top10_count from top10;
  end if;

  with ranked as (
    select p.user_id, s.nickname,
      (count(*) filter (where p.status='hit'))::numeric / nullif(count(*) filter (where p.status in ('hit','miss')),0) as hit_rate,
      count(*) filter (where p.status='hit') as hits, s.best_streak,
      rank() over (order by
        (count(*) filter (where p.status='hit'))::numeric / nullif(count(*) filter (where p.status in ('hit','miss')),0) desc,
        count(*) filter (where p.status='hit') desc, s.best_streak desc) as rnk
    from public.predictions p join public.prediction_stats s on s.user_id=p.user_id
    where to_char(p.date,'YYYYMM')=month and s.nickname is not null
    group by p.user_id, s.nickname, s.best_streak
    having count(*) filter (where p.status in ('hit','miss')) >= 5
  ),
  detectives as (select * from ranked where rnk = 1),
  gt as (insert into public.owned_titles (user_id, title_id, acquired_via)
    select user_id, 'title.monthly_detective.' || month, 'monthly_rank' from detectives
    on conflict (user_id, title_id) do nothing returning user_id),
  hist as (insert into public.award_history (period_type, period_label, award_type, rank, granted_title_id, user_id, display_name_snapshot)
    select 'monthly', month, 'detective', 1, 'title.monthly_detective.' || month, user_id, nickname from detectives
    on conflict (period_type, period_label, award_type, user_id) do nothing returning user_id)
  select count(*) into detective_count from detectives;

  result_json := json_build_object(
    'month', month, 'championCount', champion_count, 'top10Granted', top10_granted,
    'top10Count', top10_count, 'detectiveCount', detective_count, 'participantCount', participant_count
  );
  insert into public.batch_runs (job_type, period_label, dry_run, result)
    values ('monthly_rewards', month, false, result_json::jsonb);
  return result_json;
end;
$$;
revoke execute on function public.grant_monthly_rewards(text) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- P2-1 + P2-5 + P2-6. grant_season_rewards 재작성 — 필터 교체 + dry_run + batch_runs 로그.
--   시그니처 변경(p_dry_run 추가) → 기존 3-arg 버전 drop 후 재생성.
--   dry_run=true면 수상자 카운트만 계산하고 insert는 전부 스킵(각 insert-CTE에 where not p_dry_run).
-- ─────────────────────────────────────────────────────────────
drop function if exists public.grant_season_rewards(date, date, text);
create or replace function public.grant_season_rewards(p_start date, p_end date, p_label text, p_dry_run boolean default false)
returns json language plpgsql security definer set search_path = public as $$
declare
  champion_count int; top10_count int := 0; detective_count int; participant_count int;
  top10_granted boolean := false; result_json json;
begin
  with ranked as (
    select p.user_id, s.nickname,
      sum(p.ranking_points) as pts,
      count(*) filter (where p.status = 'hit') as hits,
      (count(*) filter (where p.status = 'hit'))::numeric / nullif(count(*) filter (where p.status in ('hit','miss')), 0) as hit_rate,
      s.best_streak,
      rank() over (order by sum(p.ranking_points) desc,
                   count(*) filter (where p.status = 'hit') desc,
                   (count(*) filter (where p.status = 'hit'))::numeric / nullif(count(*) filter (where p.status in ('hit','miss')), 0) desc,
                   s.best_streak desc) as rnk
    from public.predictions p join public.prediction_stats s on s.user_id = p.user_id
    where p.date between p_start and p_end and s.nickname is not null
    group by p.user_id, s.nickname, s.best_streak
  ),
  champions as (select * from ranked where rnk = 1),
  gt as (insert into public.owned_titles (user_id, title_id, acquired_via)
    select user_id, 'title.season_champion.' || p_label, 'season_rank' from champions where not p_dry_run
    on conflict (user_id, title_id) do nothing returning user_id),
  gl as (insert into public.owned_titles (user_id, title_id, acquired_via)
    select user_id, 'title.season_legend.' || p_label, 'season_rank' from champions where not p_dry_run
    on conflict (user_id, title_id) do nothing returning user_id),
  gb as (insert into public.owned_backgrounds (user_id, background_id, acquired_via)
    select user_id, 'lockerbg.season_trophy', 'season_rank' from champions where not p_dry_run
    on conflict (user_id, background_id) do nothing returning user_id),
  hist_c as (insert into public.award_history (period_type, period_label, award_type, rank, granted_title_id, granted_background_id, user_id, display_name_snapshot)
    select 'season', p_label, 'champion', 1, 'title.season_champion.' || p_label, 'lockerbg.season_trophy', user_id, nickname from champions where not p_dry_run
    on conflict (period_type, period_label, award_type, user_id) do nothing returning user_id),
  hist_l as (insert into public.award_history (period_type, period_label, award_type, rank, granted_title_id, user_id, display_name_snapshot)
    select 'season', p_label, 'legend', 1, 'title.season_legend.' || p_label, user_id, nickname from champions where not p_dry_run
    on conflict (period_type, period_label, award_type, user_id) do nothing returning user_id)
  select count(*) into champion_count from champions;

  select count(distinct p.user_id) into participant_count
    from public.predictions p where p.date between p_start and p_end and p.status in ('hit','miss');

  if participant_count >= 50 then
    top10_granted := true;
    with ranked as (
      select p.user_id, s.nickname,
        rank() over (order by sum(p.ranking_points) desc,
                     count(*) filter (where p.status = 'hit') desc,
                     (count(*) filter (where p.status = 'hit'))::numeric / nullif(count(*) filter (where p.status in ('hit','miss')), 0) desc,
                     s.best_streak desc) as rnk
      from public.predictions p join public.prediction_stats s on s.user_id = p.user_id
      where p.date between p_start and p_end and s.nickname is not null
      group by p.user_id, s.nickname, s.best_streak
    ),
    top10 as (select * from ranked where rnk <= 10),
    gt as (insert into public.owned_titles (user_id, title_id, acquired_via)
      select user_id, 'title.season_top10.' || p_label, 'season_rank' from top10 where not p_dry_run
      on conflict (user_id, title_id) do nothing returning user_id),
    hist as (insert into public.award_history (period_type, period_label, award_type, rank, granted_title_id, user_id, display_name_snapshot)
      select 'season', p_label, 'top10', rnk, 'title.season_top10.' || p_label, user_id, nickname from top10 where not p_dry_run
      on conflict (period_type, period_label, award_type, user_id) do nothing returning user_id)
    select count(*) into top10_count from top10;
  end if;

  with ranked as (
    select p.user_id, s.nickname,
      (count(*) filter (where p.status='hit'))::numeric / nullif(count(*) filter (where p.status in ('hit','miss')),0) as hit_rate,
      count(*) filter (where p.status='hit') as hits, s.best_streak,
      rank() over (order by
        (count(*) filter (where p.status='hit'))::numeric / nullif(count(*) filter (where p.status in ('hit','miss')),0) desc,
        count(*) filter (where p.status='hit') desc, s.best_streak desc) as rnk
    from public.predictions p join public.prediction_stats s on s.user_id=p.user_id
    where p.date between p_start and p_end and s.nickname is not null
    group by p.user_id, s.nickname, s.best_streak
    having count(*) filter (where p.status in ('hit','miss')) >= 30
  ),
  detectives as (select * from ranked where rnk = 1),
  gt as (insert into public.owned_titles (user_id, title_id, acquired_via)
    select user_id, 'title.season_detective.' || p_label, 'season_rank' from detectives where not p_dry_run
    on conflict (user_id, title_id) do nothing returning user_id),
  hist as (insert into public.award_history (period_type, period_label, award_type, rank, granted_title_id, user_id, display_name_snapshot)
    select 'season', p_label, 'detective', 1, 'title.season_detective.' || p_label, user_id, nickname from detectives where not p_dry_run
    on conflict (period_type, period_label, award_type, user_id) do nothing returning user_id)
  select count(*) into detective_count from detectives;

  result_json := json_build_object(
    'label', p_label, 'dryRun', p_dry_run, 'championCount', champion_count, 'top10Granted', top10_granted,
    'top10Count', top10_count, 'detectiveCount', detective_count, 'participantCount', participant_count
  );
  if not p_dry_run then
    insert into public.batch_runs (job_type, period_label, dry_run, result)
      values ('season_rewards', p_label, false, result_json::jsonb);
  end if;
  return result_json;
end;
$$;
revoke execute on function public.grant_season_rewards(date,date,text,boolean) from public, anon, authenticated;
