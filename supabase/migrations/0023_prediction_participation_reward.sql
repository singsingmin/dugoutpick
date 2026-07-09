-- ============================================================================
-- 0023 · 예측 참여 보상 — 정산 원장 라벨을 상태별로(적중/참여)
-- 배경: 적중이 어려워 매일 참여 유인이 약함 → 빗나감(유효 참여)에도 야구공 소량 지급(파이프라인 rewardFor: miss reward 3).
--   서버 정산 로직(settle_prediction)은 이미 p_reward>0면 지급하므로 금액 변경은 파이프라인만으로 반영됨.
--   단, 원장 라벨이 '예측 적중 보상'으로 하드코딩돼 있어 참여(miss)에도 "적중"으로 오표기 → 상태별 라벨로 교정.
--     hit → '예측 적중 보상' / miss → '예측 참여 보상'.
-- 0018 settle_prediction과 동일 시그니처(create or replace) — 라벨 한 줄만 변경, 나머지 로직 동일.
-- 순서: … → 0022 → 0023.
-- ============================================================================

create or replace function public.settle_prediction(
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

  -- 보상 지급(적중·참여 공통). 라벨만 상태별로: 적중=예측 적중 보상 / 빗나감=예측 참여 보상.
  if coalesce(p_reward,0) > 0 then
    insert into public.baseball_ledger (user_id, type, amount, reason, label)
    values (p_user_id, 'earn', p_reward, 'prediction_reward',
            case when p_status = 'hit' then '예측 적중 보상' else '예측 참여 보상' end);
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
