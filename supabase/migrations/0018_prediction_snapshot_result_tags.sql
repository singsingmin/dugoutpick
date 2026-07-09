-- ============================================================================
-- 0018 · 보상 시스템 P3 — predictions 스냅샷/result_tags + 경기성향형 칭호
-- 설계: docs/roadmap.md §G-P3.
--   - predictions.selected_game_snapshot(jsonb): 예측 제출 당시 경기 맥락(클라 제공).
--   - predictions.result_tags(text[]): 정산 시점 실제 경기 성격(파이프라인 계산).
--   - settle_prediction이 result_tags 저장 + special_tag_hit_count 룰 평가(P2 엔진 확장).
-- 시그니처 확장은 default 인자로 → 구 클라/파이프라인(인자 적게 보냄)도 그대로 동작(PostgREST 명명인자+default).
-- 순서: 0006 → … → 0017 → 0018.
-- ============================================================================

alter table public.predictions add column selected_game_snapshot jsonb;   -- 제출 시점 맥락(honey_score_at_pick·teams·start_time 등)
alter table public.predictions add column result_tags text[];             -- 정산 후 실제 경기 성격(walkoff·close_1·slugfest·daily_top 등)

-- ─────────────────────────────────────────────────────────────
-- 1. submit_prediction — 스냅샷 저장 추가(0010 로직 유지). 시그니처 변경 → drop 선행.
-- ─────────────────────────────────────────────────────────────
drop function if exists public.submit_prediction(text);
create function public.submit_prediction(p_game_id text, p_snapshot jsonb default '{}'::jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Asia/Seoul')::date;
  lock_at timestamptz;
  is_first boolean;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_game_id is null or length(p_game_id) = 0 or length(p_game_id) > 20 then
    raise exception 'bad game id';
  end if;

  select w.lock_at into lock_at from public.prediction_windows w where w.date = today;
  if not found then
    return json_build_object('success', false, 'reason', 'window_not_ready');
  end if;
  if now() >= lock_at then
    return json_build_object('success', false, 'reason', 'locked');
  end if;

  is_first := not exists (select 1 from public.predictions where user_id = uid);

  insert into public.prediction_stats (user_id) values (uid) on conflict (user_id) do nothing;

  insert into public.predictions (user_id, date, selected_game_id, selected_at, selected_game_snapshot)
  values (uid, today, p_game_id, now(), coalesce(p_snapshot, '{}'::jsonb))
  on conflict (user_id, date) do update
    set selected_game_id = excluded.selected_game_id, selected_at = now(),
        selected_game_snapshot = excluded.selected_game_snapshot
    where public.predictions.status = 'pending';

  if is_first then
    perform public.maybe_reward_referrer(uid);
  end if;

  return json_build_object('success', true, 'gameId', p_game_id);
end;
$$;
revoke execute on function public.submit_prediction(text, jsonb) from anon;

-- ─────────────────────────────────────────────────────────────
-- 2. 경기성향형 칭호 룰(special_tag_hit_count) 시드 — 표시명·등급은 titleConfig(SoT)
-- ─────────────────────────────────────────────────────────────
insert into public.title_achievement_rules (title_id, condition_type, threshold, tag) values
  ('title.walkoff_witness', 'special_tag_hit_count', 3, 'walkoff'),
  ('title.thriller_master', 'special_tag_hit_count', 5, 'close_1'),
  ('title.slugfest_lover',  'special_tag_hit_count', 3, 'slugfest')
on conflict (title_id) do update
  set condition_type = excluded.condition_type, threshold = excluded.threshold, tag = excluded.tag, active = true;

-- ─────────────────────────────────────────────────────────────
-- 3. settle_prediction — 0017(밀스톤·룰엔진) 유지 + result_tags 저장 + special_tag_hit_count 평가.
--    시그니처 확장(p_result_tags) → 기존 5-arg drop 후 6-arg 생성(default라 구 파이프라인도 호출됨).
-- ─────────────────────────────────────────────────────────────
drop function if exists public.settle_prediction(uuid, date, text, int, int);
create function public.settle_prediction(
  p_user_id uuid, p_date date, p_status text, p_reward int, p_points int, p_result_tags text[] default '{}'
) returns void language plpgsql security definer set search_path = public as $$
declare
  cur_streak int; best int; new_streak int;
  old_total_pred int; old_total_hits int; new_total_pred int; new_total_hits int;
  pmonth text; v_valid int; v_hits int;
  rule record; tagcount int;
begin
  if p_status not in ('hit','miss','void') then raise exception 'bad status %', p_status; end if;

  update public.predictions
    set status = p_status, reward_baseballs = coalesce(p_reward,0), ranking_points = coalesce(p_points,0),
        result_tags = coalesce(p_result_tags, '{}'), settled_at = now()
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

  -- 업적 칭호 — 데이터주도 룰 엔진. 누적 카운트형 + 경기성향형(special_tag_hit_count) 평가.
  for rule in select title_id, condition_type, threshold, tag from public.title_achievement_rules where active loop
    if (rule.condition_type = 'valid_predictions_count' and new_total_pred >= rule.threshold)
       or (rule.condition_type = 'hits_count' and new_total_hits >= rule.threshold)
       or (rule.condition_type = 'current_streak' and new_streak >= rule.threshold)
    then
      perform public._grant_achievement_title(p_user_id, rule.title_id);
    elsif rule.condition_type = 'special_tag_hit_count' and rule.tag is not null then
      select count(*) into tagcount
        from public.predictions
        where user_id = p_user_id and status = 'hit' and rule.tag = any(result_tags);
      if tagcount >= rule.threshold then
        perform public._grant_achievement_title(p_user_id, rule.title_id);
      end if;
    end if;
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
revoke execute on function public.settle_prediction(uuid,date,text,int,int,text[]) from public, anon, authenticated;
