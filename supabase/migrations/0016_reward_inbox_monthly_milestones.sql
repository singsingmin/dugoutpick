-- ============================================================================
-- 0016 · 보상 시스템 확장 P1 — 통합 보상 인박스 + 월간 밀스톤
-- 설계: docs/roadmap.md §G, 대화 2026-07-09 확정.
--   - reward_events: 모든 보상 알림의 단일 인박스(seen 플래그). 서버(SECURITY DEFINER)만 insert.
--   - monthly_milestone_claims: 월간 밀스톤 멱등 지급 기록(중복 지급 차단).
--   - settle_prediction: 정산 1패스에서 예측 날짜 기준 period_month monthlyStats 1회 집계 후 밀스톤 지급.
--   밀스톤(정산 즉시): 유효예측 5회 +10, 유효예측 10회 +20, 적중 5회 +20 (월 최대 +50).
-- 순서: 0006 → … → 0015 → 0016.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. reward_events — 통합 보상 인박스
-- ─────────────────────────────────────────────────────────────
create table public.reward_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  event_type  text not null,   -- monthly_milestone | prediction_hit | referral | title_earned | background_earned | monthly_rank | season_rank | event | admin
  payload     jsonb not null default '{}'::jsonb,
  seen        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index reward_events_user_unseen on public.reward_events (user_id, seen, created_at);
alter table public.reward_events enable row level security;
-- 직접 write 불가 — 발행은 서버 정의함수만. seen 갱신은 mark_reward_events_seen RPC 경유.
revoke insert, update, delete on public.reward_events from anon, authenticated;
create policy "reward_events_select_own" on public.reward_events
  for select to authenticated using (user_id = auth.uid());

create or replace function public.mark_reward_events_seen(p_ids bigint[] default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update public.reward_events set seen = true
    where user_id = auth.uid() and seen = false
      and (p_ids is null or id = any(p_ids));
end;
$$;
revoke execute on function public.mark_reward_events_seen(bigint[]) from anon;

-- ─────────────────────────────────────────────────────────────
-- 2. monthly_milestone_claims — 월간 밀스톤 멱등 지급 기록
-- ─────────────────────────────────────────────────────────────
create table public.monthly_milestone_claims (
  user_id       uuid not null references auth.users(id) on delete cascade,
  period_month  text not null,       -- 'YYYYMM'(KST, 예측 날짜 기준)
  milestone_key text not null,       -- valid5 | valid10 | hit5
  reward        int  not null,
  claimed_at    timestamptz not null default now(),
  primary key (user_id, period_month, milestone_key)   -- 중복 지급 차단
);
alter table public.monthly_milestone_claims enable row level security;
revoke insert, update, delete on public.monthly_milestone_claims from anon, authenticated;
create policy "monthly_milestone_claims_select_own" on public.monthly_milestone_claims
  for select to authenticated using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 3. 밀스톤 지급 헬퍼 — 조건 충족 + 미청구일 때만 원자적 지급(잔액+원장+이벤트)
-- ─────────────────────────────────────────────────────────────
create or replace function public._grant_monthly_milestone(
  p_user_id uuid, p_month text, p_key text, p_reward int, p_label text, p_met boolean
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not p_met then return; end if;
  insert into public.monthly_milestone_claims (user_id, period_month, milestone_key, reward)
    values (p_user_id, p_month, p_key, p_reward)
    on conflict (user_id, period_month, milestone_key) do nothing;
  if not found then return; end if;   -- 이미 청구됨 → 지급 스킵(멱등)
  update public.profiles set balance = balance + p_reward, updated_at = now() where id = p_user_id;
  insert into public.baseball_ledger (user_id, type, amount, reason, label)
    values (p_user_id, 'earn', p_reward, 'monthly_milestone_reward', p_label);
  insert into public.reward_events (user_id, event_type, payload)
    values (p_user_id, 'monthly_milestone',
            jsonb_build_object('milestone_key', p_key, 'reward', p_reward, 'month', p_month, 'label', p_label));
end;
$$;
revoke execute on function public._grant_monthly_milestone(uuid,text,text,int,text,boolean) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. settle_prediction 재작성 — 0007 로직 유지 + 월간 밀스톤(정산 1패스 집계) 추가
-- ─────────────────────────────────────────────────────────────
create or replace function public.settle_prediction(
  p_user_id uuid, p_date date, p_status text, p_reward int, p_points int
) returns void language plpgsql security definer set search_path = public as $$
declare
  cur_streak int; best int; new_streak int;
  old_total_pred int; old_total_hits int; new_total_pred int; new_total_hits int;
  pmonth text; v_valid int; v_hits int;   -- 월간 밀스톤용(예측 날짜 기준 월 집계)
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

  -- 업적 칭호(정산 시점 지급분). 문턱값을 "넘어선 순간"만 지급(그랜트는 멱등이라 이중조건은 방어용).
  if coalesce(old_total_pred,0) < 1 and new_total_pred >= 1 then
    perform public.grant_title(p_user_id, 'title.first_prediction', 'achievement');
  end if;
  if coalesce(old_total_hits,0) < 1 and new_total_hits >= 1 then
    perform public.grant_title(p_user_id, 'title.first_hit', 'achievement');
  end if;
  if p_status = 'hit' and coalesce(cur_streak,0) < 3 and new_streak >= 3 then
    perform public.grant_title(p_user_id, 'title.streak3', 'achievement');
  end if;
  if p_status = 'hit' and coalesce(cur_streak,0) < 5 and new_streak >= 5 then
    perform public.grant_title(p_user_id, 'title.streak5', 'achievement');
  end if;
  if coalesce(old_total_hits,0) < 10 and new_total_hits >= 10 then
    perform public.grant_title(p_user_id, 'title.honey_detective', 'achievement');
  end if;
  if coalesce(old_total_pred,0) < 30 and new_total_pred >= 30 then
    perform public.grant_title(p_user_id, 'title.veteran30', 'achievement');
  end if;

  -- 월간 밀스톤 — 예측 날짜(p_date)의 월 기준으로 이번 달 유효/적중 수를 1회 집계 후 지급.
  -- (정산 실행월이 아니라 예측 월 기준 → 소급·재정산에도 올바른 달로 적립)
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
