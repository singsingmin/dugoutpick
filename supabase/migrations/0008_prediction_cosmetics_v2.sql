-- ============================================================================
-- Phase 4 · Stage 6 v2: 랭킹 동점자·탈퇴 명예기록·admin 지급·닉네임 정책
-- 설계: docs/stage6-cosmetics-design.md (2026-07-07 3차 리비전, 전 항목 결정 완료)
-- ============================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. prediction_stats 변경 — 닉네임 정책(월1회 제한·중복허용·2~10자)
-- ─────────────────────────────────────────────────────────────
alter table public.prediction_stats drop constraint prediction_stats_nickname_key;
alter table public.prediction_stats drop constraint prediction_stats_nickname_len;
alter table public.prediction_stats add constraint prediction_stats_nickname_len
  check (nickname is null or (length(nickname) between 2 and 10));
alter table public.prediction_stats add column nickname_changed_month text;

-- 닉네임은 이제 컬럼 GRANT 제거 — set_nickname RPC로만 변경 가능.
revoke update (nickname) on public.prediction_stats from authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. award_history — 명예 기록 영구 보존(탈퇴해도 익명 스냅샷으로 남음)
-- ─────────────────────────────────────────────────────────────
create table public.award_history (
  id                     uuid primary key default gen_random_uuid(),
  period_type            text not null check (period_type in ('monthly','season')),
  period_label           text not null,        -- "202608" 또는 시즌 라벨 "2026"
  award_type             text not null check (award_type in ('champion','top10','detective','legend')),
  rank                   int not null,          -- champion/detective/legend=1 고정, top10=1~10(동점 시 초과 가능)
  granted_title_id       text,
  granted_background_id  text,
  user_id                uuid references auth.users(id) on delete set null,  -- 안전망(실제 null화는 트리거가 명시적으로)
  display_name_snapshot  text not null,
  is_user_deleted        boolean not null default false,
  awarded_at             timestamptz not null default now()
);
-- 같은 달/시즌 정산을 재실행해도(멱등) 명예 기록이 중복 적재되지 않게.
alter table public.award_history add constraint award_history_unique_award
  unique (period_type, period_label, award_type, user_id);
alter table public.award_history enable row level security;
revoke all on public.award_history from anon, authenticated;  -- 원본은 user_id 포함이라 완전 비공개

-- 명예의 전당 전용 뷰 — user_id 컬럼 자체가 없음(RLS는 행 단위라 컬럼을 못 가려서 뷰로 분리).
create view public.award_history_public as
  select period_type, period_label, award_type, rank,
         granted_title_id, granted_background_id,
         case when is_user_deleted then '탈퇴한 사용자' else display_name_snapshot end as display_name,
         is_user_deleted, awarded_at
  from public.award_history;
grant select on public.award_history_public to anon, authenticated;

-- 탈퇴 시 명시적 익명화(BEFORE DELETE — FK의 암묵적 처리 타이밍에 의존하지 않음).
create or replace function public.anonymize_award_history_on_user_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.award_history set user_id = null, is_user_deleted = true where user_id = old.id;
  return old;
end;
$$;
create trigger on_auth_user_deleted
  before delete on auth.users
  for each row execute function public.anonymize_award_history_on_user_delete();

-- ─────────────────────────────────────────────────────────────
-- 3. cosmetic_admin_events — 관리자 지급/회수 감사 로그
-- ─────────────────────────────────────────────────────────────
create table public.cosmetic_admin_events (
  id             uuid primary key default gen_random_uuid(),
  action         text not null check (action in ('grant_title','grant_background','revoke_title','revoke_background')),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  item_id        text not null,
  reason         text not null,
  performed_by   text,
  created_at     timestamptz not null default now()
);
alter table public.cosmetic_admin_events enable row level security;
revoke all on public.cosmetic_admin_events from anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. 관리자 RPC 4종(service_role/대시보드 전용 — anon·authenticated 실행 불가)
-- ─────────────────────────────────────────────────────────────
create or replace function public.admin_grant_title(p_user_id uuid, p_title_id text, p_reason text, p_performed_by text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'reason required'; end if;
  perform public.grant_title(p_user_id, p_title_id, 'admin');
  insert into public.cosmetic_admin_events (action, target_user_id, item_id, reason, performed_by)
    values ('grant_title', p_user_id, p_title_id, p_reason, p_performed_by);
end;
$$;

create or replace function public.admin_grant_background(p_user_id uuid, p_background_id text, p_reason text, p_performed_by text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'reason required'; end if;
  perform public.grant_background(p_user_id, p_background_id, 'admin');
  insert into public.cosmetic_admin_events (action, target_user_id, item_id, reason, performed_by)
    values ('grant_background', p_user_id, p_background_id, p_reason, p_performed_by);
end;
$$;

create or replace function public.admin_revoke_title(p_user_id uuid, p_title_id text, p_reason text, p_performed_by text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'reason required'; end if;
  delete from public.owned_titles where user_id = p_user_id and title_id = p_title_id;
  update public.prediction_stats set equipped_title = null
    where user_id = p_user_id and equipped_title = p_title_id;
  insert into public.cosmetic_admin_events (action, target_user_id, item_id, reason, performed_by)
    values ('revoke_title', p_user_id, p_title_id, p_reason, p_performed_by);
end;
$$;

create or replace function public.admin_revoke_background(p_user_id uuid, p_background_id text, p_reason text, p_performed_by text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'reason required'; end if;
  delete from public.owned_backgrounds where user_id = p_user_id and background_id = p_background_id;
  update public.prediction_stats set equipped_background = null
    where user_id = p_user_id and equipped_background = p_background_id;
  insert into public.cosmetic_admin_events (action, target_user_id, item_id, reason, performed_by)
    values ('revoke_background', p_user_id, p_background_id, p_reason, p_performed_by);
end;
$$;

revoke execute on function public.admin_grant_title(uuid,text,text,text) from public, anon, authenticated;
revoke execute on function public.admin_grant_background(uuid,text,text,text) from public, anon, authenticated;
revoke execute on function public.admin_revoke_title(uuid,text,text,text) from public, anon, authenticated;
revoke execute on function public.admin_revoke_background(uuid,text,text,text) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5. set_nickname 재작성 — 월 1회 변경 제한(KST), 2~10자, 중복 허용
-- ─────────────────────────────────────────────────────────────
create or replace function public.set_nickname(p_nickname text)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cur_nickname text; cur_month text;
  this_month text := to_char((now() at time zone 'Asia/Seoul')::date, 'YYYYMM');
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_nickname is null or length(p_nickname) < 2 or length(p_nickname) > 10 then
    return json_build_object('success', false, 'reason', 'bad_length');
  end if;

  insert into public.prediction_stats (user_id) values (uid) on conflict (user_id) do nothing;
  select nickname, nickname_changed_month into cur_nickname, cur_month
    from public.prediction_stats where user_id = uid for update;

  if cur_nickname is not null and cur_month = this_month then
    return json_build_object('success', false, 'reason', 'rate_limited');
  end if;

  update public.prediction_stats
    set nickname = p_nickname,
        nickname_changed_month = case when cur_nickname is null then nickname_changed_month else this_month end,
        updated_at = now()
    where user_id = uid;

  if cur_nickname is null then
    perform public.grant_title(uid, 'title.rookie_watcher', 'default');
  end if;

  return json_build_object('success', true, 'nickname', p_nickname);
end;
$$;
revoke execute on function public.set_nickname(text) from anon;

-- ─────────────────────────────────────────────────────────────
-- 6. 리더보드 RPC — is_me 방식(raw user_id 절대 반환 안 함), group by를 user_id 기준으로 수정
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_monthly_leaderboard(p_month text default null, p_limit int default 50)
returns table(nickname text, monthly_points int, hits int, participations int, is_me boolean)
language sql security definer set search_path = public as $$
  select s.nickname,
         sum(p.ranking_points)::int as monthly_points,
         count(*) filter (where p.status = 'hit')::int as hits,
         count(*) filter (where p.status <> 'void')::int as participations,
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
         round(100.0 * count(*) filter (where p.status = 'hit') / nullif(count(*) filter (where p.status <> 'void'), 0), 1) as hit_rate,
         count(*) filter (where p.status = 'hit')::int as hits,
         count(*) filter (where p.status <> 'void')::int as participations,
         (p.user_id = auth.uid()) as is_me
  from public.predictions p
  join public.prediction_stats s on s.user_id = p.user_id
  where to_char(p.date, 'YYYYMM') = coalesce(p_month, to_char((now() at time zone 'Asia/Seoul')::date, 'YYYYMM'))
    and s.nickname is not null
  group by s.nickname, p.user_id
  having count(*) filter (where p.status <> 'void') >= greatest(1, p_min_participation)
  order by hit_rate desc
  limit greatest(1, least(p_limit, 200));
$$;
revoke execute on function public.get_monthly_hitrate_leaderboard(text,int,int) from anon;

-- ─────────────────────────────────────────────────────────────
-- 7. grant_monthly_rewards 재작성 — RANK() 동점자 처리 + award_history 기록
--    CTE 체인(단일 statement)으로 owned_titles/owned_backgrounds/award_history를 한 번에 insert.
--    temp table 대신 CTE 반복 사용(Supabase pgbouncer transaction-mode 풀링에서 임시테이블 잔존 리스크 회피).
-- ─────────────────────────────────────────────────────────────
create or replace function public.grant_monthly_rewards(p_month text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  month text := coalesce(p_month, to_char((now() at time zone 'Asia/Seoul')::date - interval '1 day', 'YYYYMM'));
  champion_count int; top10_count int := 0; detective_count int; participant_count int;
  top10_granted boolean := false;
begin
  -- 챔피언(포인트 1위, 동점 전원) — 칭호+배경+명예기록 한 번에.
  with ranked as (
    select p.user_id, s.nickname,
      sum(p.ranking_points) as pts,
      count(*) filter (where p.status = 'hit') as hits,
      (count(*) filter (where p.status = 'hit'))::numeric / nullif(count(*) filter (where p.status <> 'void'), 0) as hit_rate,
      s.best_streak,
      rank() over (order by sum(p.ranking_points) desc,
                   count(*) filter (where p.status = 'hit') desc,
                   (count(*) filter (where p.status = 'hit'))::numeric / nullif(count(*) filter (where p.status <> 'void'), 0) desc,
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

  -- TOP10(참여자 20명 이상일 때만, 동점 경계 포함)
  select count(distinct p.user_id) into participant_count
    from public.predictions p where to_char(p.date, 'YYYYMM') = month and p.status <> 'void';

  if participant_count >= 20 then
    top10_granted := true;
    with ranked as (
      select p.user_id, s.nickname,
        rank() over (order by sum(p.ranking_points) desc,
                     count(*) filter (where p.status = 'hit') desc,
                     (count(*) filter (where p.status = 'hit'))::numeric / nullif(count(*) filter (where p.status <> 'void'), 0) desc,
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

  -- 감별왕(적중률 1위, 최소 참여 5회, 동점 전원)
  with ranked as (
    select p.user_id, s.nickname,
      (count(*) filter (where p.status='hit'))::numeric / nullif(count(*) filter (where p.status<>'void'),0) as hit_rate,
      count(*) filter (where p.status='hit') as hits, s.best_streak,
      rank() over (order by
        (count(*) filter (where p.status='hit'))::numeric / nullif(count(*) filter (where p.status<>'void'),0) desc,
        count(*) filter (where p.status='hit') desc, s.best_streak desc) as rnk
    from public.predictions p join public.prediction_stats s on s.user_id=p.user_id
    where to_char(p.date,'YYYYMM')=month and s.nickname is not null
    group by p.user_id, s.nickname, s.best_streak
    having count(*) filter (where p.status<>'void') >= 5
  ),
  detectives as (select * from ranked where rnk = 1),
  gt as (insert into public.owned_titles (user_id, title_id, acquired_via)
    select user_id, 'title.monthly_detective.' || month, 'monthly_rank' from detectives
    on conflict (user_id, title_id) do nothing returning user_id),
  hist as (insert into public.award_history (period_type, period_label, award_type, rank, granted_title_id, user_id, display_name_snapshot)
    select 'monthly', month, 'detective', 1, 'title.monthly_detective.' || month, user_id, nickname from detectives
    on conflict (period_type, period_label, award_type, user_id) do nothing returning user_id)
  select count(*) into detective_count from detectives;

  return json_build_object(
    'month', month, 'championCount', champion_count, 'top10Granted', top10_granted,
    'top10Count', top10_count, 'detectiveCount', detective_count, 'participantCount', participant_count
  );
end;
$$;
revoke execute on function public.grant_monthly_rewards(text) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 8. grant_season_rewards 재작성 — 동일 원칙, 날짜 범위 기준 + 꿀잼 레전드 추가
-- ─────────────────────────────────────────────────────────────
create or replace function public.grant_season_rewards(p_start date, p_end date, p_label text)
returns json language plpgsql security definer set search_path = public as $$
declare
  champion_count int; top10_count int := 0; detective_count int; participant_count int;
  top10_granted boolean := false;
begin
  with ranked as (
    select p.user_id, s.nickname,
      sum(p.ranking_points) as pts,
      count(*) filter (where p.status = 'hit') as hits,
      (count(*) filter (where p.status = 'hit'))::numeric / nullif(count(*) filter (where p.status <> 'void'), 0) as hit_rate,
      s.best_streak,
      rank() over (order by sum(p.ranking_points) desc,
                   count(*) filter (where p.status = 'hit') desc,
                   (count(*) filter (where p.status = 'hit'))::numeric / nullif(count(*) filter (where p.status <> 'void'), 0) desc,
                   s.best_streak desc) as rnk
    from public.predictions p join public.prediction_stats s on s.user_id = p.user_id
    where p.date between p_start and p_end and s.nickname is not null
    group by p.user_id, s.nickname, s.best_streak
  ),
  champions as (select * from ranked where rnk = 1),
  gt as (insert into public.owned_titles (user_id, title_id, acquired_via)
    select user_id, 'title.season_champion.' || p_label, 'season_rank' from champions
    on conflict (user_id, title_id) do nothing returning user_id),
  gl as (insert into public.owned_titles (user_id, title_id, acquired_via)
    select user_id, 'title.season_legend.' || p_label, 'season_rank' from champions
    on conflict (user_id, title_id) do nothing returning user_id),
  gb as (insert into public.owned_backgrounds (user_id, background_id, acquired_via)
    select user_id, 'lockerbg.season_trophy', 'season_rank' from champions
    on conflict (user_id, background_id) do nothing returning user_id),
  hist_c as (insert into public.award_history (period_type, period_label, award_type, rank, granted_title_id, granted_background_id, user_id, display_name_snapshot)
    select 'season', p_label, 'champion', 1, 'title.season_champion.' || p_label, 'lockerbg.season_trophy', user_id, nickname from champions
    on conflict (period_type, period_label, award_type, user_id) do nothing returning user_id),
  hist_l as (insert into public.award_history (period_type, period_label, award_type, rank, granted_title_id, user_id, display_name_snapshot)
    select 'season', p_label, 'legend', 1, 'title.season_legend.' || p_label, user_id, nickname from champions
    on conflict (period_type, period_label, award_type, user_id) do nothing returning user_id)
  select count(*) into champion_count from champions;

  select count(distinct p.user_id) into participant_count
    from public.predictions p where p.date between p_start and p_end and p.status <> 'void';

  if participant_count >= 50 then
    top10_granted := true;
    with ranked as (
      select p.user_id, s.nickname,
        rank() over (order by sum(p.ranking_points) desc,
                     count(*) filter (where p.status = 'hit') desc,
                     (count(*) filter (where p.status = 'hit'))::numeric / nullif(count(*) filter (where p.status <> 'void'), 0) desc,
                     s.best_streak desc) as rnk
      from public.predictions p join public.prediction_stats s on s.user_id = p.user_id
      where p.date between p_start and p_end and s.nickname is not null
      group by p.user_id, s.nickname, s.best_streak
    ),
    top10 as (select * from ranked where rnk <= 10),
    gt as (insert into public.owned_titles (user_id, title_id, acquired_via)
      select user_id, 'title.season_top10.' || p_label, 'season_rank' from top10
      on conflict (user_id, title_id) do nothing returning user_id),
    hist as (insert into public.award_history (period_type, period_label, award_type, rank, granted_title_id, user_id, display_name_snapshot)
      select 'season', p_label, 'top10', rnk, 'title.season_top10.' || p_label, user_id, nickname from top10
      on conflict (period_type, period_label, award_type, user_id) do nothing returning user_id)
    select count(*) into top10_count from top10;
  end if;

  with ranked as (
    select p.user_id, s.nickname,
      (count(*) filter (where p.status='hit'))::numeric / nullif(count(*) filter (where p.status<>'void'),0) as hit_rate,
      count(*) filter (where p.status='hit') as hits, s.best_streak,
      rank() over (order by
        (count(*) filter (where p.status='hit'))::numeric / nullif(count(*) filter (where p.status<>'void'),0) desc,
        count(*) filter (where p.status='hit') desc, s.best_streak desc) as rnk
    from public.predictions p join public.prediction_stats s on s.user_id=p.user_id
    where p.date between p_start and p_end and s.nickname is not null
    group by p.user_id, s.nickname, s.best_streak
    having count(*) filter (where p.status<>'void') >= 30
  ),
  detectives as (select * from ranked where rnk = 1),
  gt as (insert into public.owned_titles (user_id, title_id, acquired_via)
    select user_id, 'title.season_detective.' || p_label, 'season_rank' from detectives
    on conflict (user_id, title_id) do nothing returning user_id),
  hist as (insert into public.award_history (period_type, period_label, award_type, rank, granted_title_id, user_id, display_name_snapshot)
    select 'season', p_label, 'detective', 1, 'title.season_detective.' || p_label, user_id, nickname from detectives
    on conflict (period_type, period_label, award_type, user_id) do nothing returning user_id)
  select count(*) into detective_count from detectives;

  return json_build_object(
    'label', p_label, 'championCount', champion_count, 'top10Granted', top10_granted,
    'top10Count', top10_count, 'detectiveCount', detective_count, 'participantCount', participant_count
  );
end;
$$;
revoke execute on function public.grant_season_rewards(date,date,text) from public, anon, authenticated;
