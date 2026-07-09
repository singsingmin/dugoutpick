-- ============================================================================
-- 0017 · 보상 시스템 P2 — 데이터주도 업적 룰 엔진 + title_earned 이벤트
-- 설계: docs/roadmap.md §G-P2.
--   - settle_prediction의 하드코딩 업적 if 6개 → title_achievement_rules 테이블 기반 평가로 이관.
--   - condition_type은 임의 SQL이 아니라 코드가 아는 enum(안전): valid_predictions_count | hits_count |
--     current_streak | special_tag_hit_count(P3에서 result_tags 도입 후 평가). threshold 넘으면 지급.
--   - 신규 획득 칭호는 P1 인박스(reward_events, type=title_earned)로 알림.
-- 순서: 0006 → … → 0016 → 0017.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. title_achievement_rules — 업적 칭호 획득조건 단일 출처(SoT)
-- ─────────────────────────────────────────────────────────────
create table public.title_achievement_rules (
  title_id       text primary key,
  condition_type text not null,        -- valid_predictions_count | hits_count | current_streak | special_tag_hit_count
  threshold      int  not null default 1,
  tag            text,                  -- special_tag_hit_count 대상 태그(P3)
  active         boolean not null default true
);
alter table public.title_achievement_rules enable row level security;
-- 클라 비노출(표시는 titleConfig가 SoT). settle_prediction(SECURITY DEFINER)만 읽음.
revoke select, insert, update, delete on public.title_achievement_rules from anon, authenticated;

-- 기존 6종 이관(0007 하드코딩과 동일 의미)
insert into public.title_achievement_rules (title_id, condition_type, threshold) values
  ('title.first_prediction',  'valid_predictions_count', 1),
  ('title.first_hit',         'hits_count',              1),
  ('title.streak3',           'current_streak',          3),
  ('title.streak5',           'current_streak',          5),
  ('title.honey_detective',   'hits_count',              10),
  ('title.veteran30',         'valid_predictions_count', 30)
on conflict (title_id) do update set condition_type = excluded.condition_type, threshold = excluded.threshold, active = true;

-- ─────────────────────────────────────────────────────────────
-- 2. 업적 칭호 지급 헬퍼 — 신규 획득이면 title_earned 이벤트 발행
-- ─────────────────────────────────────────────────────────────
create or replace function public._grant_achievement_title(p_user_id uuid, p_title_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.owned_titles (user_id, title_id, acquired_via)
    values (p_user_id, p_title_id, 'achievement')
    on conflict (user_id, title_id) do nothing;
  if not found then return; end if;   -- 이미 보유 → 이벤트 없음(멱등)
  insert into public.reward_events (user_id, event_type, payload)
    values (p_user_id, 'title_earned', jsonb_build_object('title_id', p_title_id));
end;
$$;
revoke execute on function public._grant_achievement_title(uuid,text) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. settle_prediction 재작성 — 0016(밀스톤) 유지 + 업적을 룰 엔진으로 교체
-- ─────────────────────────────────────────────────────────────
create or replace function public.settle_prediction(
  p_user_id uuid, p_date date, p_status text, p_reward int, p_points int
) returns void language plpgsql security definer set search_path = public as $$
declare
  cur_streak int; best int; new_streak int;
  old_total_pred int; old_total_hits int; new_total_pred int; new_total_hits int;
  pmonth text; v_valid int; v_hits int;   -- 월간 밀스톤용(예측 날짜 기준 월 집계)
  rule record;                            -- 업적 룰 평가용
begin
  if p_status not in ('hit','miss','void') then raise exception 'bad status %', p_status; end if;

  update public.predictions
    set status = p_status, reward_baseballs = coalesce(p_reward,0), ranking_points = coalesce(p_points,0), settled_at = now()
    where user_id = p_user_id and date = p_date and status = 'pending';
  if not found then return; end if;  -- 이미 정산됐거나 예측 자체가 없음(멱등)

  insert into public.prediction_stats (user_id) values (p_user_id) on conflict (user_id) do nothing;
  select current_streak, best_streak, total_predictions, total_hits
    into cur_streak, best, old_total_pred, old_total_hits
    from public.prediction_stats where user_id = p_user_id for update;

  if p_status = 'hit' then new_streak := coalesce(cur_streak,0) + 1;
  elsif p_status = 'miss' then new_streak := 0;
  else new_streak := coalesce(cur_streak,0); end if;  -- void: 연속 유지(설계 §8)

  new_total_pred := coalesce(old_total_pred,0) + (case when p_status = 'void' then 0 else 1 end);
  new_total_hits := coalesce(old_total_hits,0) + (case when p_status = 'hit' then 1 else 0 end);

  update public.prediction_stats set
    total_predictions = new_total_pred,
    total_hits        = new_total_hits,
    current_streak     = new_streak,
    best_streak        = greatest(coalesce(best,0), new_streak),
    updated_at          = now()
  where user_id = p_user_id;

  if coalesce(p_reward,0) > 0 then
    insert into public.baseball_ledger (user_id, type, amount, reason, label)
    values (p_user_id, 'earn', p_reward, 'prediction_reward', '예측 적중 보상');
    update public.profiles set balance = balance + p_reward, updated_at = now() where id = p_user_id;
  end if;

  -- 업적 칭호 — 데이터주도 룰 엔진(title_achievement_rules). 정산 후 누적치로 평가, 신규 획득만 이벤트.
  --   grant는 멱등(owned_titles 유니크)이라 문턱 이상이면 매번 평가해도 중복 지급/이벤트 없음.
  for rule in select title_id, condition_type, threshold from public.title_achievement_rules where active loop
    if (rule.condition_type = 'valid_predictions_count' and new_total_pred >= rule.threshold)
       or (rule.condition_type = 'hits_count' and new_total_hits >= rule.threshold)
       or (rule.condition_type = 'current_streak' and new_streak >= rule.threshold)
    then
      perform public._grant_achievement_title(p_user_id, rule.title_id);
    end if;
    -- special_tag_hit_count는 P3(result_tags) 도입 후 평가 — 지금은 매칭 안 됨.
  end loop;

  -- 월간 밀스톤 — 예측 날짜(p_date)의 월 기준으로 이번 달 유효/적중 수를 1회 집계 후 지급.
  pmonth := to_char(p_date, 'YYYYMM');
  select count(*) filter (where status in ('hit','miss')),
         count(*) filter (where status = 'hit')
    into v_valid, v_hits
    from public.predictions
    where user_id = p_user_id and to_char(date, 'YYYYMM') = pmonth;

  perform public._grant_monthly_milestone(p_user_id, pmonth, 'valid5',  10, '월간 유효 예측 5회 달성',  v_valid >= 5);
  perform public._grant_monthly_milestone(p_user_id, pmonth, 'valid10', 20, '월간 유효 예측 10회 달성', v_valid >= 10);
  perform public._grant_monthly_milestone(p_user_id, pmonth, 'hit5',    20, '월간 적중 5회 달성',       v_hits  >= 5);
end;
$$;
revoke execute on function public.settle_prediction(uuid,date,text,int,int) from public, anon, authenticated;
