-- ============================================================================
-- Phase 4 · Stage 6: 예측 리그 칭호·라커룸 배경 (2026-07-07 제품 결정 반영)
-- 결정 요약:
--   - 칭호(titles)는 구매 불가. default/achievement/monthly_rank/season_rank/event/admin 경로로만 획득.
--   - 라커룸 배경은 구매형(backgrounds 카탈로그+purchase_background) + 명예 보상형(비구매) 이원화.
--   - achievement 칭호는 settle_prediction 시점(신입 관전러만 예외 — set_nickname 시점, "리그 참여" 순간).
--   - monthly_rank/season_rank 칭호·명예 배경은 월간/시즌 정산 배치(grant_monthly_rewards/grant_season_rewards)에서 지급.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. owned_titles.acquired_via 값 제한(DB 강제)
-- ─────────────────────────────────────────────────────────────
alter table public.owned_titles add constraint owned_titles_acquired_via_chk
  check (acquired_via in ('default','achievement','monthly_rank','season_rank','event','admin'));

-- ─────────────────────────────────────────────────────────────
-- 2. backgrounds 카탈로그 — skins과 동일 패턴(구매 검증 SSOT, 클라 비노출)
-- ─────────────────────────────────────────────────────────────
create table public.backgrounds (
  id          text primary key,
  price       int  not null,
  unlock_type text not null     -- currency(구매형) | monthly_rank | season_rank(명예 보상형, 구매불가)
);
alter table public.backgrounds enable row level security;
revoke select, insert, update, delete on public.backgrounds from anon, authenticated;

insert into public.backgrounds (id, price, unlock_type) values
  ('lockerbg.classic_dugout',    40, 'currency'),
  ('lockerbg.green_field',       40, 'currency'),
  ('lockerbg.night_stadium',     50, 'currency'),
  ('lockerbg.lineup_boardroom',  50, 'currency'),
  ('lockerbg.monthly_champion',   0, 'monthly_rank'),
  ('lockerbg.season_trophy',      0, 'season_rank')
on conflict (id) do update set price = excluded.price, unlock_type = excluded.unlock_type;

-- baseball_ledger에 배경 구매 추적 컬럼 추가(related_skin_id를 배경에 재사용하지 않음 — 의미 명확화).
alter table public.baseball_ledger add column related_background_id text;

-- 배경 구매 — unlock_type='currency'만 구매 가능(purchase_skin의 M1 하드닝과 동일 원칙).
create or replace function public.purchase_background(p_background_id text)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); bg_price int; bg_unlock text; bal int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select price, unlock_type into bg_price, bg_unlock from public.backgrounds where id = p_background_id;
  if not found then return json_build_object('success', false, 'reason', 'unknown_background'); end if;
  select balance into bal from public.profiles where id = uid for update;
  if not found then raise exception 'profile not found'; end if;
  if exists (select 1 from public.owned_backgrounds where user_id = uid and background_id = p_background_id) then
    return json_build_object('success', true, 'reason', 'already', 'balance', bal);
  end if;
  if bg_unlock <> 'currency' then
    return json_build_object('success', false, 'reason', 'not_purchasable', 'balance', bal);
  end if;
  if bal < bg_price then
    return json_build_object('success', false, 'reason', 'insufficient', 'balance', bal);
  end if;
  update public.profiles set balance = balance - bg_price, updated_at = now() where id = uid;
  insert into public.owned_backgrounds (user_id, background_id, acquired_via) values (uid, p_background_id, 'purchase');
  insert into public.baseball_ledger (user_id, type, amount, reason, label, related_background_id)
  values (uid, 'spend', bg_price, 'background_purchase', p_background_id || ' 구매', p_background_id);
  return json_build_object('success', true, 'balance', bal - bg_price);
end;
$$;
revoke execute on function public.purchase_background(text) from anon;

-- ─────────────────────────────────────────────────────────────
-- 3. 지급 헬퍼(멱등 — unique(user_id,title_id/background_id)가 중복 방지)
-- ─────────────────────────────────────────────────────────────
create or replace function public.grant_title(p_user_id uuid, p_title_id text, p_via text)
returns void language sql security definer set search_path = public as $$
  insert into public.owned_titles (user_id, title_id, acquired_via) values (p_user_id, p_title_id, p_via)
  on conflict (user_id, title_id) do nothing;
$$;
revoke execute on function public.grant_title(uuid,text,text) from public, anon, authenticated;

create or replace function public.grant_background(p_user_id uuid, p_background_id text, p_via text)
returns void language sql security definer set search_path = public as $$
  insert into public.owned_backgrounds (user_id, background_id, acquired_via) values (p_user_id, p_background_id, p_via)
  on conflict (user_id, background_id) do nothing;
$$;
revoke execute on function public.grant_background(uuid,text,text) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. settle_prediction 교체 — 업적 칭호 6종 자동 지급 추가(신입 관전러 제외, §5 참고)
-- ─────────────────────────────────────────────────────────────
create or replace function public.settle_prediction(
  p_user_id uuid, p_date date, p_status text, p_reward int, p_points int
) returns void language plpgsql security definer set search_path = public as $$
declare
  cur_streak int; best int; new_streak int;
  old_total_pred int; old_total_hits int; new_total_pred int; new_total_hits int;
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
end;
$$;
revoke execute on function public.settle_prediction(uuid,date,text,int,int) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5. set_nickname 교체 — "신입 관전러"는 리그 참여(닉네임 설정) 순간에 지급
-- ─────────────────────────────────────────────────────────────
create or replace function public.set_nickname(p_nickname text)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_nickname is null or length(p_nickname) < 2 or length(p_nickname) > 16 then
    return json_build_object('success', false, 'reason', 'bad_length');
  end if;
  insert into public.prediction_stats (user_id) values (uid) on conflict (user_id) do nothing;
  update public.prediction_stats set nickname = p_nickname, updated_at = now() where user_id = uid;
  perform public.grant_title(uid, 'title.rookie_watcher', 'default');
  return json_build_object('success', true, 'nickname', p_nickname);
exception
  when unique_violation then
    return json_build_object('success', false, 'reason', 'taken');
end;
$$;
revoke execute on function public.set_nickname(text) from anon;

-- ─────────────────────────────────────────────────────────────
-- 6. 월간 정산 배치(service_role 전용) — 매월 1일 03:00 KST 파이프라인이 호출.
--    title_id에 월(YYYYMM)을 박아 매달 새 칭호로 취급(배경은 동일 id 재획득=멱등 no-op).
-- ─────────────────────────────────────────────────────────────
create or replace function public.grant_monthly_rewards(p_month text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  month text := coalesce(p_month, to_char((now() at time zone 'Asia/Seoul')::date - interval '1 day', 'YYYYMM'));
  champion record; detective record; participant_count int; granted_top10 boolean := false;
begin
  -- 포인트 랭킹 1위
  select p.user_id, s.nickname into champion
    from public.predictions p join public.prediction_stats s on s.user_id = p.user_id
    where to_char(p.date, 'YYYYMM') = month and s.nickname is not null
    group by p.user_id, s.nickname
    order by sum(p.ranking_points) desc limit 1;

  if champion.user_id is not null then
    perform public.grant_title(champion.user_id, 'title.monthly_champion.' || month, 'monthly_rank');
    perform public.grant_background(champion.user_id, 'lockerbg.monthly_champion', 'monthly_rank');
  end if;

  -- 유효 참여자 수(이번달 void 아닌 참여가 1건이라도 있는 유저 수) — TOP10 자동지급 조건(20명 이상)
  select count(distinct p.user_id) into participant_count
    from public.predictions p
    where to_char(p.date, 'YYYYMM') = month and p.status <> 'void';

  if participant_count >= 20 then
    granted_top10 := true;
    perform public.grant_title(x.user_id, 'title.monthly_top10.' || month, 'monthly_rank')
      from (
        select p.user_id
          from public.predictions p join public.prediction_stats s on s.user_id = p.user_id
          where to_char(p.date, 'YYYYMM') = month and s.nickname is not null
          group by p.user_id
          order by sum(p.ranking_points) desc limit 10
      ) x;
  end if;

  -- 적중률 랭킹 1위(최소 참여 5회 — get_monthly_hitrate_leaderboard와 동일 기준)
  select p.user_id, s.nickname into detective
    from public.predictions p join public.prediction_stats s on s.user_id = p.user_id
    where to_char(p.date, 'YYYYMM') = month and s.nickname is not null
    group by p.user_id, s.nickname
    having count(*) filter (where p.status <> 'void') >= 5
    order by (count(*) filter (where p.status = 'hit'))::numeric / nullif(count(*) filter (where p.status <> 'void'), 0) desc
    limit 1;

  if detective.user_id is not null then
    perform public.grant_title(detective.user_id, 'title.monthly_detective.' || month, 'monthly_rank');
  end if;

  return json_build_object(
    'month', month,
    'champion', champion.nickname,
    'detective', detective.nickname,
    'top10Granted', granted_top10,
    'participantCount', participant_count
  );
end;
$$;
revoke execute on function public.grant_monthly_rewards(text) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 7. 시즌 정산 배치(service_role 전용) — KBO 정규시즌 종료 다음날 03:00 KST 수동/파이프라인 호출.
--    시즌 경계는 달력월이 아니라 실제 시즌 기간이라 호출자가 명시적으로 넘김(자동 감지 안 함 — 후속 검토).
-- ─────────────────────────────────────────────────────────────
create or replace function public.grant_season_rewards(p_start date, p_end date, p_label text)
returns json language plpgsql security definer set search_path = public as $$
declare
  champion record; detective record; participant_count int; granted_top10 boolean := false;
begin
  select p.user_id, s.nickname into champion
    from public.predictions p join public.prediction_stats s on s.user_id = p.user_id
    where p.date between p_start and p_end and s.nickname is not null
    group by p.user_id, s.nickname
    order by sum(p.ranking_points) desc limit 1;

  if champion.user_id is not null then
    perform public.grant_title(champion.user_id, 'title.season_champion.' || p_label, 'season_rank');
    -- "꿀잼 레전드"(시즌 특별 최상위 보상) = 시즌 포인트 1위에게 함께 지급(규칙 미세분 — 별도 기준 없으면 챔피언과 동일 인물).
    perform public.grant_title(champion.user_id, 'title.season_legend.' || p_label, 'season_rank');
    perform public.grant_background(champion.user_id, 'lockerbg.season_trophy', 'season_rank');
  end if;

  select count(distinct p.user_id) into participant_count
    from public.predictions p where p.date between p_start and p_end and p.status <> 'void';

  if participant_count >= 50 then
    granted_top10 := true;
    perform public.grant_title(x.user_id, 'title.season_top10.' || p_label, 'season_rank')
      from (
        select p.user_id
          from public.predictions p join public.prediction_stats s on s.user_id = p.user_id
          where p.date between p_start and p_end and s.nickname is not null
          group by p.user_id
          order by sum(p.ranking_points) desc limit 10
      ) x;
  end if;

  select p.user_id, s.nickname into detective
    from public.predictions p join public.prediction_stats s on s.user_id = p.user_id
    where p.date between p_start and p_end and s.nickname is not null
    group by p.user_id, s.nickname
    having count(*) filter (where p.status <> 'void') >= 30
    order by (count(*) filter (where p.status = 'hit'))::numeric / nullif(count(*) filter (where p.status <> 'void'), 0) desc
    limit 1;

  if detective.user_id is not null then
    perform public.grant_title(detective.user_id, 'title.season_detective.' || p_label, 'season_rank');
  end if;

  return json_build_object(
    'label', p_label, 'champion', champion.nickname, 'detective', detective.nickname,
    'top10Granted', granted_top10, 'participantCount', participant_count
  );
end;
$$;
revoke execute on function public.grant_season_rewards(date,date,text) from public, anon, authenticated;
