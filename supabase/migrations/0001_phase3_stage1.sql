-- ============================================================================
-- Phase 3 · Stage 1: 계정/DB 기반 스키마 (Layer 1)
-- 설계: docs/phase3-account-design.md §3 · 결정: docs/adr.md ADR-023
-- 원칙: 서버=진실, 재화 이동은 RPC(definer)만, 클라는 자기 행 read + 비민감 컬럼만 write.
-- 2026-07-04 Supabase 대시보드에서 실행·검증 완료(잔액 위조 차단 + RPC 작동).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. 테이블 6종
-- ─────────────────────────────────────────────────────────────

-- profiles — 유저당 1행, auth.users에 1:1
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  balance         int  not null default 0,               -- 캐시(원장이 진실)
  applied_skin_id text not null default 'jersey.classic.team',
  favorite_team   text,
  att_streak      int  not null default 0,               -- 캐시
  att_count       int  not null default 0,               -- 캐시
  att_last_date   date,                                   -- KST
  starter_granted boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- baseball_ledger — append-only, 잔액의 진실 원천
create table public.baseball_ledger (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  type            text not null check (type in ('earn','spend')),
  amount          int  not null check (amount > 0),
  reason          text not null,                          -- initial_grant|attendance|attendance_bonus|skin_purchase|(향후)prediction_reward
  label           text,
  related_skin_id text,
  created_at      timestamptz not null default now()
);
create index baseball_ledger_user_created_idx on public.baseball_ledger (user_id, created_at desc);

-- owned_skins — 조인 테이블(획득 경로·시점 보존)
create table public.owned_skins (
  user_id      uuid not null references auth.users(id) on delete cascade,
  skin_id      text not null,
  acquired_via text not null,                             -- purchase|event|reward|starter
  acquired_at  timestamptz not null default now(),
  primary key (user_id, skin_id)
);

-- attendance_claims — 출석한 날마다 1행 (PK가 "하루 1회" 강제)
create table public.attendance_claims (
  user_id    uuid not null references auth.users(id) on delete cascade,
  claim_date date not null,                               -- KST
  base       int  not null,
  bonus      int  not null default 0,
  streak_at  int  not null,
  created_at timestamptz not null default now(),
  primary key (user_id, claim_date)
);

-- skins — 구매 검증 SSOT (scoreSkinConfig.ts 동기화, 클라 비노출)
create table public.skins (
  id          text primary key,
  price       int  not null,
  unlock_type text not null                               -- free|currency|event|premium
);

-- feedback — 경기 후 피드백 (Discord 웹훅과 병행)
create table public.feedback (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  game_id         text not null,
  thumbs          text not null check (thumbs in ('up','down')),
  reason_tag      text,
  reason_label    text,
  predicted_score int,
  factors         jsonb,
  created_at      timestamptz not null default now(),
  unique (user_id, game_id)
);

alter table public.profiles          enable row level security;
alter table public.baseball_ledger   enable row level security;
alter table public.owned_skins       enable row level security;
alter table public.attendance_claims enable row level security;
alter table public.skins             enable row level security;
alter table public.feedback          enable row level security;

-- ─────────────────────────────────────────────────────────────
-- 2. 트리거 2종
-- ─────────────────────────────────────────────────────────────

-- 신규 유저(익명 포함) → profiles 생성 + 스타터 15 지급
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, balance, starter_granted) values (new.id, 15, true);
  insert into public.baseball_ledger (user_id, type, amount, reason, label)
  values (new.id, 'earn', 15, 'initial_grant', '첫 지급');
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- applied_skin_id 변경 시 free 또는 owned인지 검증 (definer: 잠긴 skins 읽기 위함)
create or replace function public.validate_applied_skin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.applied_skin_id is distinct from old.applied_skin_id then
    if not exists (select 1 from public.skins s where s.id = new.applied_skin_id and s.unlock_type = 'free')
       and not exists (select 1 from public.owned_skins o where o.user_id = new.id and o.skin_id = new.applied_skin_id) then
      raise exception 'applied_skin_id "%" is not free or owned', new.applied_skin_id;
    end if;
  end if;
  return new;
end;
$$;
create trigger validate_applied_skin_trigger
  before update on public.profiles for each row execute function public.validate_applied_skin();

-- ─────────────────────────────────────────────────────────────
-- 3. 재화 RPC 2종 (SECURITY DEFINER)
-- ─────────────────────────────────────────────────────────────

-- 출석 보상 — KST 날짜·streak 계산, 하루 1회, 원장+잔액 원자적 갱신
create or replace function public.claim_attendance()
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Asia/Seoul')::date;
  last date; strk int; new_streak int;
  base int := 5; bonus int := 0; earned int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select att_last_date, att_streak into last, strk from public.profiles where id = uid for update;
  if not found then raise exception 'profile not found'; end if;
  if last = today then
    return json_build_object('claimed', false, 'earned', 0, 'base', 0, 'bonus', 0, 'streak', strk);
  end if;
  if last = today - 1 then new_streak := strk + 1; else new_streak := 1; end if;
  if new_streak % 7 = 0 then bonus := 20; end if;
  earned := base + bonus;
  insert into public.attendance_claims (user_id, claim_date, base, bonus, streak_at)
  values (uid, today, base, bonus, new_streak);
  insert into public.baseball_ledger (user_id, type, amount, reason, label)
  values (uid, 'earn', base, 'attendance', '출석 보상');
  if bonus > 0 then
    insert into public.baseball_ledger (user_id, type, amount, reason, label)
    values (uid, 'earn', bonus, 'attendance_bonus', '7일 연속 보너스');
  end if;
  update public.profiles
    set balance = balance + earned, att_streak = new_streak,
        att_count = att_count + 1, att_last_date = today, updated_at = now()
    where id = uid;
  return json_build_object('claimed', true, 'earned', earned, 'base', base, 'bonus', bonus, 'streak', new_streak);
end;
$$;

-- 스킨 구매 — 서버 가격 검증(클라 price 불신)·잔액 차감·보유 추가·원장
create or replace function public.purchase_skin(p_skin_id text)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); sk_price int; sk_unlock text; bal int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select price, unlock_type into sk_price, sk_unlock from public.skins where id = p_skin_id;
  if not found then return json_build_object('success', false, 'reason', 'unknown_skin'); end if;
  select balance into bal from public.profiles where id = uid for update;
  if not found then raise exception 'profile not found'; end if;
  if sk_unlock = 'free'
     or exists (select 1 from public.owned_skins where user_id = uid and skin_id = p_skin_id) then
    return json_build_object('success', true, 'reason', 'already', 'balance', bal);
  end if;
  if bal < sk_price then
    return json_build_object('success', false, 'reason', 'insufficient', 'balance', bal);
  end if;
  update public.profiles set balance = balance - sk_price, updated_at = now() where id = uid;
  insert into public.owned_skins (user_id, skin_id, acquired_via) values (uid, p_skin_id, 'purchase');
  insert into public.baseball_ledger (user_id, type, amount, reason, label, related_skin_id)
  values (uid, 'spend', sk_price, 'skin_purchase', p_skin_id || ' 구매', p_skin_id);
  return json_build_object('success', true, 'balance', bal - sk_price);
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. RLS 정책 + 컬럼 GRANT (무결성 핵심)
-- ─────────────────────────────────────────────────────────────

-- profiles: write는 favorite_team·applied_skin_id 컬럼만 (balance·att_* 는 함수만)
revoke insert, update, delete on public.profiles from anon, authenticated;
grant  update (favorite_team, applied_skin_id) on public.profiles to authenticated;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- baseball_ledger / owned_skins / attendance_claims: 읽기만(쓰기=RPC definer)
revoke insert, update, delete on public.baseball_ledger from anon, authenticated;
create policy "ledger_select_own" on public.baseball_ledger
  for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.owned_skins from anon, authenticated;
create policy "owned_select_own" on public.owned_skins
  for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.attendance_claims from anon, authenticated;
create policy "attendance_select_own" on public.attendance_claims
  for select to authenticated using (user_id = auth.uid());

-- skins: 클라 완전 비노출(정책 없음=잠금, 권한 회수). definer 함수만 읽음
revoke select, insert, update, delete on public.skins from anon, authenticated;

-- feedback: 자기 행 읽기+쓰기
revoke update, delete on public.feedback from anon, authenticated;
create policy "feedback_select_own" on public.feedback
  for select to authenticated using (user_id = auth.uid());
create policy "feedback_insert_own" on public.feedback
  for insert to authenticated with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 5. skins 시드 (scoreSkinConfig.ts 동기화, 40종)  ※ 향후 배포 시 upsert 자동화 예정
-- ─────────────────────────────────────────────────────────────
insert into public.skins (id, price, unlock_type) values
  ('jersey.classic.team', 0, 'free'), ('jersey.pinstripe.team', 0, 'free'),
  ('jersey.cream.team', 0, 'free'), ('jersey.classicSplit.team', 0, 'free'),
  ('jersey.creamSplit.team', 0, 'free'),
  ('scoreboard.vintage', 30, 'currency'), ('ticket.retro', 30, 'currency'),
  ('homeplate.retro', 30, 'currency'), ('nameplate.dugout', 30, 'currency'),
  ('lineup.card', 35, 'currency'), ('tacticboard.retro', 35, 'currency'),
  ('gate.ballpark', 40, 'currency'), ('speedgun.bullpen', 45, 'currency'),
  ('medal.special', 60, 'currency'), ('trophy.mvp', 75, 'currency'),
  ('ring.champ', 90, 'currency'),
  ('jersey.classic.red', 10, 'currency'), ('jersey.classic.pink', 10, 'currency'),
  ('jersey.classic.orange', 10, 'currency'), ('jersey.classic.yellow', 10, 'currency'),
  ('jersey.classic.green', 10, 'currency'), ('jersey.classic.sky', 10, 'currency'),
  ('jersey.classic.blue', 10, 'currency'), ('jersey.classic.black', 10, 'currency'),
  ('jersey.white.red', 15, 'currency'), ('jersey.white.pink', 15, 'currency'),
  ('jersey.white.orange', 15, 'currency'), ('jersey.white.yellow', 15, 'currency'),
  ('jersey.white.green', 15, 'currency'), ('jersey.white.sky', 15, 'currency'),
  ('jersey.white.blue', 15, 'currency'), ('jersey.white.black', 15, 'currency'),
  ('jersey.stripe.red', 20, 'currency'), ('jersey.stripe.pink', 20, 'currency'),
  ('jersey.stripe.orange', 20, 'currency'), ('jersey.stripe.yellow', 20, 'currency'),
  ('jersey.stripe.green', 20, 'currency'), ('jersey.stripe.sky', 20, 'currency'),
  ('jersey.stripe.blue', 20, 'currency'), ('jersey.stripe.black', 20, 'currency')
on conflict (id) do update set price = excluded.price, unlock_type = excluded.unlock_type;
