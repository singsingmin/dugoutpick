-- ============================================================================
-- 추천코드 v1 (Discord 논의 2026-07-07 확정 정책)
-- 정책 요약:
--   - 코드 발급 = 보호된 계정(소셜 연동)만. 코드 입력(피추천인) = 익명 포함 누구나, 평생 1회.
--   - 피추천인 보상 = 코드 입력 즉시 +10. 추천인 보상 = 피추천인 첫 예측 참여 시 +10.
--   - 추천인 보상 캡: 하루 2명 / 월 10명. 초과분은 기록만 남기고 지급 안 함(capped).
--   - 자기 추천 금지. 동일 소셜계정 재사용은 Supabase 자체가 차단.
--   - 동일 기기 반복 추천은 기술적으로 완전 차단 불가 — 의심 패턴은 admin이 사후 취소.
-- ============================================================================

alter table public.profiles add column referral_code text unique;

-- 코드 생성기: 6자, 혼동 문자(0,O,1,I,L) 제외. 충돌 시 재시도.
create or replace function public.generate_referral_code()
returns text language plpgsql as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where referral_code = code);
  end loop;
  return code;
end;
$$;

-- 익명→소셜 연동 전환 순간(is_anonymous: true→false) 자동으로 코드 발급.
create or replace function public.handle_user_protected()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.is_anonymous = true and new.is_anonymous = false then
    update public.profiles set referral_code = public.generate_referral_code()
      where id = new.id and referral_code is null;
  end if;
  return new;
end;
$$;
create trigger on_auth_user_protected
  after update on auth.users
  for each row execute function public.handle_user_protected();

-- 추천 redemption 기록 — 피추천인은 평생 1회(unique).
create table public.referral_redemptions (
  id                      uuid primary key default gen_random_uuid(),
  referrer_user_id        uuid not null references auth.users(id) on delete cascade,
  referee_user_id         uuid not null unique references auth.users(id) on delete cascade,
  referral_code_used      text not null,
  referee_reward          int not null default 0,
  referrer_reward         int not null default 0,
  referrer_reward_status  text not null default 'pending'
                            check (referrer_reward_status in ('pending','rewarded','capped','blocked')),
  redeemed_at             timestamptz not null default now(),
  referrer_rewarded_at    timestamptz
);
create index referral_redemptions_referrer_idx on public.referral_redemptions (referrer_user_id, referrer_reward_status);
alter table public.referral_redemptions enable row level security;
revoke all on public.referral_redemptions from anon, authenticated;
create policy "referral_redemptions_select_own" on public.referral_redemptions
  for select to authenticated using (referrer_user_id = auth.uid() or referee_user_id = auth.uid());

-- 코드 입력(피추천인 전용, RPC만). 즉시 +10 야구공.
create or replace function public.redeem_referral_code(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  referrer uuid;
  normalized text := upper(trim(coalesce(p_code, '')));
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if length(normalized) = 0 then
    return json_build_object('success', false, 'reason', 'invalid_code');
  end if;
  if exists (select 1 from public.referral_redemptions where referee_user_id = uid) then
    return json_build_object('success', false, 'reason', 'already_redeemed');
  end if;

  select id into referrer from public.profiles where referral_code = normalized;
  if referrer is null then
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

  return json_build_object('success', true, 'reward', 10);
end;
$$;
revoke execute on function public.redeem_referral_code(text) from anon;

-- 추천인 보상 — 피추천인 첫 예측 참여 시 submit_prediction이 호출. 하루2/월10 캡, 초과는 capped로 표시만.
create or replace function public.maybe_reward_referrer(p_referee_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  today date := (now() at time zone 'Asia/Seoul')::date;
  daily_count int; monthly_count int;
begin
  select * into r from public.referral_redemptions
    where referee_user_id = p_referee_user_id and referrer_reward_status = 'pending'
    for update;
  if not found then return; end if;

  select count(*) into daily_count from public.referral_redemptions
    where referrer_user_id = r.referrer_user_id and referrer_reward_status = 'rewarded'
      and (referrer_rewarded_at at time zone 'Asia/Seoul')::date = today;
  select count(*) into monthly_count from public.referral_redemptions
    where referrer_user_id = r.referrer_user_id and referrer_reward_status = 'rewarded'
      and to_char(referrer_rewarded_at at time zone 'Asia/Seoul', 'YYYYMM') = to_char(today, 'YYYYMM');

  if daily_count >= 2 or monthly_count >= 10 then
    update public.referral_redemptions set referrer_reward_status = 'capped' where id = r.id;
    return;
  end if;

  update public.referral_redemptions
    set referrer_reward_status = 'rewarded', referrer_rewarded_at = now()
    where id = r.id;
  insert into public.baseball_ledger (user_id, type, amount, reason, label)
  values (r.referrer_user_id, 'earn', r.referrer_reward, 'referral_referrer', '추천 보상(피추천인 첫 참여)');
  update public.profiles set balance = balance + r.referrer_reward, updated_at = now() where id = r.referrer_user_id;
end;
$$;
revoke execute on function public.maybe_reward_referrer(uuid) from public, anon, authenticated;

-- submit_prediction 재작성 — 첫 예측이면 추천인 보상 체크를 추가로 호출(그 외 로직은 0006과 동일).
create or replace function public.submit_prediction(p_game_id text)
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

  insert into public.predictions (user_id, date, selected_game_id, selected_at)
  values (uid, today, p_game_id, now())
  on conflict (user_id, date) do update
    set selected_game_id = excluded.selected_game_id, selected_at = now()
    where public.predictions.status = 'pending';

  if is_first then
    perform public.maybe_reward_referrer(uid);
  end if;

  return json_build_object('success', true, 'gameId', p_game_id);
end;
$$;
revoke execute on function public.submit_prediction(text) from anon;

-- 관리자: 의심 추천 보상 취소(이미 지급됐으면 잔액 회수 포함). 대시보드에서만 호출.
create or replace function public.admin_cancel_referral_reward(p_redemption_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'reason required'; end if;
  select * into r from public.referral_redemptions where id = p_redemption_id for update;
  if not found then raise exception 'redemption not found'; end if;

  if r.referrer_reward_status = 'rewarded' then
    update public.profiles set balance = greatest(0, balance - r.referrer_reward), updated_at = now() where id = r.referrer_user_id;
    insert into public.baseball_ledger (user_id, type, amount, reason, label)
    values (r.referrer_user_id, 'spend', r.referrer_reward, 'referral_reward_reversed', '추천 보상 회수: ' || p_reason);
  end if;
  update public.referral_redemptions set referrer_reward_status = 'blocked' where id = p_redemption_id;
end;
$$;
revoke execute on function public.admin_cancel_referral_reward(uuid,text) from public, anon, authenticated;
