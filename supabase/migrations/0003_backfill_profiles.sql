-- 0003_backfill_profiles.sql — 프로필 없는 유저 백필(트리거 이전 생성 계정 구제)
-- 원인: on_auth_user_created 트리거는 Stage 1(0001)에서 생성. 그 이전(Stage 0 스파이크 등)에
--       만든 auth.users에는 profiles 행이 없어, 그 계정으로 복구/로그인 시 RPC가
--       'profile not found' 예외(claim_attendance·purchase_skin). → 프로필 없는 모든 유저에
--       스타터 프로필(야구공 15)을 소급 생성. 트리거가 커버 못한 레거시만 대상(멱등).

-- 1) 프로필 없는 유저 → 스타터 프로필 생성
insert into public.profiles (id, balance, starter_granted, applied_skin_id)
select u.id, 15, true, 'jersey.classic.team'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- 2) initial_grant 원장 없는 유저 → 소급 기록(내역 정합, 중복 방지)
insert into public.baseball_ledger (user_id, type, amount, reason, label)
select p.id, 'earn', 15, 'initial_grant', '첫 지급(백필)'
from public.profiles p
where not exists (
  select 1 from public.baseball_ledger l where l.user_id = p.id and l.reason = 'initial_grant'
);
