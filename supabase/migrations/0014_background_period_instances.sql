-- ============================================================================
-- 0014 · 명예형 라커룸 배경을 period 인스턴스로 (월간 챔피언 룸 / 시즌 트로피룸)
-- 방식 1: 이미지 에셋은 카탈로그 공용 1개 유지, 월/시즌은 별도 "보상 인스턴스"로 저장.
--   예) 2026.07 월간 챔피언 룸, 2026.08 월간 챔피언 룸 — 이미지 동일, period_label만 다름.
--   년월 텍스트는 이미지에 넣지 않고 UI 라벨로 처리.
-- 스키마 요지:
--   - owned_backgrounds: 대리키 id(인스턴스 식별자) + period_type/period_label/display_name.
--   - 구매형 = (user_id, background_id) 배경당 1개 / 명예형 = (user_id, background_id, period_type, period_label) 다중.
--     → coalesce 표현식 유니크 하나로 둘 다 커버.
--   - 장착 상태는 background_id(text)가 아니라 equipped_owned_background_id(인스턴스 id)로 저장.
-- 순서: 0006 → … → 0013 → 0014.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. owned_backgrounds 재구성 — 대리키 + period 컬럼 + 통합 유니크
-- ─────────────────────────────────────────────────────────────
alter table public.owned_backgrounds add column id bigint generated always as identity;
alter table public.owned_backgrounds add column period_type text;   -- null=구매형, 'monthly'|'season'=명예형
alter table public.owned_backgrounds add column period_label text;  -- 'YYYYMM'(월간) | 'YYYY'(시즌)
alter table public.owned_backgrounds add column display_name text;  -- 카탈로그 기본명 스냅샷(년월은 UI가 합성)

-- 복합 PK(user_id, background_id) → 대리키 id PK 로 교체
alter table public.owned_backgrounds drop constraint owned_backgrounds_pkey;
alter table public.owned_backgrounds add constraint owned_backgrounds_pkey primary key (id);

-- 중복 방지: 구매형(period null → '')은 배경당 1개, 명예형은 (배경+type+label)별 1개
create unique index owned_backgrounds_dedup
  on public.owned_backgrounds (user_id, background_id, coalesce(period_type, ''), coalesce(period_label, ''));

-- ─────────────────────────────────────────────────────────────
-- 2. prediction_stats 장착 컬럼 — background_id(text) → owned_background_id(인스턴스) 로 전환
-- ─────────────────────────────────────────────────────────────
alter table public.prediction_stats
  add column equipped_owned_background_id bigint references public.owned_backgrounds(id) on delete set null;

-- 기존 장착(equipped_background text) → 해당 소유 인스턴스 id로 이전(기존 데이터는 전부 period null)
update public.prediction_stats ps
  set equipped_owned_background_id = ob.id
  from public.owned_backgrounds ob
  where ob.user_id = ps.user_id
    and ob.background_id = ps.equipped_background
    and ob.period_type is null;

-- ─────────────────────────────────────────────────────────────
-- 3. 보유 검증 트리거 — equipped_owned_background_id 기준으로 재작성(칭호 분기는 그대로)
-- ─────────────────────────────────────────────────────────────
create or replace function public.validate_equipped_cosmetics()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.equipped_title is not null and new.equipped_title is distinct from old.equipped_title then
    if not exists (select 1 from public.owned_titles where user_id = new.user_id and title_id = new.equipped_title) then
      raise exception 'equipped_title "%" is not owned', new.equipped_title;
    end if;
  end if;
  if new.equipped_owned_background_id is not null
     and new.equipped_owned_background_id is distinct from old.equipped_owned_background_id then
    if not exists (select 1 from public.owned_backgrounds
                   where id = new.equipped_owned_background_id and user_id = new.user_id) then
      raise exception 'equipped_owned_background_id "%" is not owned', new.equipped_owned_background_id;
    end if;
  end if;
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. equip_background RPC — 시그니처 변경(text → bigint) → 기존 버전 drop 선행
-- ─────────────────────────────────────────────────────────────
drop function if exists public.equip_background(text);
create or replace function public.equip_background(p_owned_background_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.prediction_stats (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  if p_owned_background_id is not null and not exists (
    select 1 from public.owned_backgrounds where id = p_owned_background_id and user_id = auth.uid()
  ) then
    raise exception 'background instance % not owned', p_owned_background_id;
  end if;
  update public.prediction_stats set equipped_owned_background_id = p_owned_background_id, updated_at = now()
    where user_id = auth.uid();
end;
$$;
revoke execute on function public.equip_background(bigint) from anon;

-- ─────────────────────────────────────────────────────────────
-- 5. admin_revoke_background — 삭제 시 FK(on delete set null)가 장착 해제 처리 → equipped 수동 null 제거
-- ─────────────────────────────────────────────────────────────
create or replace function public.admin_revoke_background(p_user_id uuid, p_background_id text, p_reason text, p_performed_by text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'reason required'; end if;
  delete from public.owned_backgrounds where user_id = p_user_id and background_id = p_background_id;
  insert into public.cosmetic_admin_events (action, target_user_id, item_id, reason, performed_by)
    values ('revoke_background', p_user_id, p_background_id, p_reason, p_performed_by);
end;
$$;
revoke execute on function public.admin_revoke_background(uuid,text,text,text) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 6. 이제 구 equipped_background(text) 컬럼 제거 — 위 함수/트리거가 더 이상 참조 안 함
-- ─────────────────────────────────────────────────────────────
alter table public.prediction_stats drop column equipped_background;

-- ─────────────────────────────────────────────────────────────
-- 7. grant_background 헬퍼 — 새 유니크(coalesce) 기준으로 conflict target 교체
-- ─────────────────────────────────────────────────────────────
create or replace function public.grant_background(p_user_id uuid, p_background_id text, p_via text)
returns void language sql security definer set search_path = public as $$
  insert into public.owned_backgrounds (user_id, background_id, acquired_via)
  values (p_user_id, p_background_id, p_via)
  on conflict (user_id, background_id, coalesce(period_type, ''), coalesce(period_label, '')) do nothing;
$$;
revoke execute on function public.grant_background(uuid,text,text) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 8. purchase_background — 인스턴스 id 반환 + 보유 검사(구매형=period null) 갱신
-- ─────────────────────────────────────────────────────────────
create or replace function public.purchase_background(p_background_id text)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); bg_price int; bg_unlock text; bal int; owned_id bigint;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select price, unlock_type into bg_price, bg_unlock from public.backgrounds where id = p_background_id;
  if not found then return json_build_object('success', false, 'reason', 'unknown_background'); end if;
  select balance into bal from public.profiles where id = uid for update;
  if not found then raise exception 'profile not found'; end if;
  select id into owned_id from public.owned_backgrounds
    where user_id = uid and background_id = p_background_id and period_type is null limit 1;
  if owned_id is not null then
    return json_build_object('success', true, 'reason', 'already', 'balance', bal, 'ownedBackgroundId', owned_id);
  end if;
  if bg_unlock <> 'currency' then
    return json_build_object('success', false, 'reason', 'not_purchasable', 'balance', bal);
  end if;
  if bal < bg_price then
    return json_build_object('success', false, 'reason', 'insufficient', 'balance', bal);
  end if;
  update public.profiles set balance = balance - bg_price, updated_at = now() where id = uid;
  insert into public.owned_backgrounds (user_id, background_id, acquired_via)
    values (uid, p_background_id, 'purchase') returning id into owned_id;
  insert into public.baseball_ledger (user_id, type, amount, reason, label, related_background_id)
  values (uid, 'spend', bg_price, 'background_purchase', p_background_id || ' 구매', p_background_id);
  return json_build_object('success', true, 'balance', bal - bg_price, 'ownedBackgroundId', owned_id);
end;
$$;
revoke execute on function public.purchase_background(text) from anon;

-- ─────────────────────────────────────────────────────────────
-- 9. grant_monthly_rewards — 0011 정의 기준, 챔피언 배경을 period 인스턴스로 지급
--    (집계 필터 status in ('hit','miss')·batch_runs 로그 등 0011 로직 그대로 유지)
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
  gb as (insert into public.owned_backgrounds (user_id, background_id, acquired_via, period_type, period_label, display_name)
    select user_id, 'lockerbg.monthly_champion', 'monthly_rank', 'monthly', month, '월간 챔피언 룸' from champions
    on conflict (user_id, background_id, coalesce(period_type, ''), coalesce(period_label, '')) do nothing returning user_id),
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
-- 10. grant_season_rewards — 0011 정의 기준, 챔피언 트로피 배경을 시즌 인스턴스로 지급
-- ─────────────────────────────────────────────────────────────
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
  gb as (insert into public.owned_backgrounds (user_id, background_id, acquired_via, period_type, period_label, display_name)
    select user_id, 'lockerbg.season_trophy', 'season_rank', 'season', p_label, '시즌 트로피룸' from champions where not p_dry_run
    on conflict (user_id, background_id, coalesce(period_type, ''), coalesce(period_label, '')) do nothing returning user_id),
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
