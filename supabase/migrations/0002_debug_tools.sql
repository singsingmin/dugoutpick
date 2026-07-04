-- 0002_debug_tools.sql — 테스트 편의용 초기화/지급 RPC (디버그 전용)
-- 배경: 재화는 클라가 직접 못 씀(RLS+컬럼 GRANT, 잔액 위조 방지). 초기화/지급도 반드시
--       SECURITY DEFINER RPC로만 수행. app_config.debug_enabled 플래그로 on/off 게이팅.
-- ⚠️ 정식 출시 전 필수:  update public.app_config set debug_enabled = false;  (RPC 무력화)
--    + 클라 디버그 버튼 제거(EXPO_PUBLIC_DEBUG_TOOLS 미주입).

-- ─────────────────────────────────────────────────────────────
-- 1) 디버그 플래그 (단일 행). 클라 직접 접근 차단 — 함수 내부에서만 참조.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.app_config (
  id            boolean primary key default true check (id),   -- 단일 행 강제
  debug_enabled boolean not null default false
);
insert into public.app_config (id, debug_enabled) values (true, true)
  on conflict (id) do nothing;
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;   -- 정책 없음 = 클라 잠금

-- ─────────────────────────────────────────────────────────────
-- 2) 테스트 초기화 — 신규 유저 상태(야구공 15, 스킨/출석/내역 리셋). 응원팀은 유지.
-- ─────────────────────────────────────────────────────────────
create or replace function public.debug_reset()
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not coalesce((select debug_enabled from public.app_config where id = true), false)
    then raise exception 'debug disabled'; end if;
  delete from public.owned_skins       where user_id = uid;
  delete from public.attendance_claims where user_id = uid;
  delete from public.baseball_ledger   where user_id = uid;
  update public.profiles
    set balance = 15, applied_skin_id = 'jersey.classic.team',
        att_streak = 0, att_count = 0, att_last_date = null, updated_at = now()
    where id = uid;
  return json_build_object('ok', true, 'balance', 15);
end; $$;

-- ─────────────────────────────────────────────────────────────
-- 3) 테스트 지급 — 야구공 +N (1~1000). 내역에 기록(추적).
-- ─────────────────────────────────────────────────────────────
create or replace function public.debug_grant(p_amount int)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); newbal int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not coalesce((select debug_enabled from public.app_config where id = true), false)
    then raise exception 'debug disabled'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000 then raise exception 'bad amount'; end if;
  update public.profiles set balance = balance + p_amount, updated_at = now()
    where id = uid returning balance into newbal;
  insert into public.baseball_ledger (user_id, type, amount, reason, label)
    values (uid, 'earn', p_amount, 'debug_grant', '테스트 지급');
  return json_build_object('ok', true, 'balance', newbal);
end; $$;

-- ─────────────────────────────────────────────────────────────
-- 4) 실행 권한 (authenticated만; 실제 동작은 debug_enabled로 게이팅)
-- ─────────────────────────────────────────────────────────────
revoke all on function public.debug_reset()      from public;
revoke all on function public.debug_grant(int)   from public;
grant execute on function public.debug_reset()    to authenticated;
grant execute on function public.debug_grant(int) to authenticated;
