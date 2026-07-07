-- ============================================================================
-- 0013 · 추천코드 발급 신뢰성 개선 (버그: "발급 중..."에서 멈춤)
-- 문제: 0010의 handle_user_protected 트리거는 is_anonymous true→false '전환 순간'에만 발급.
--       0010 적용 전에 이미 소셜 연동을 끝낸 계정은 전환이 지나가 트리거가 소급 발급 못 함
--       → profiles.referral_code = null → 앱에 "발급 중..." 영구 표시.
-- 해결 2가지:
--   ① 기존 보호 계정 백필: is_anonymous=false 인데 코드 없는 프로필에 즉시 발급.
--   ② get_or_create_referral_code() RPC: 앱이 코드를 읽을 때 없으면 그 자리에서 생성
--      (트리거 발화 타이밍에 의존하지 않아 근본적으로 안정적). 클라 fetchMyReferralCode가 이걸 호출.
-- 0012 다음에 실행.
-- ============================================================================

-- ① 백필 — 이미 연동됐는데 코드 없는 계정에 즉시 발급(테스터 소수라 벌크 업데이트로 충분).
update public.profiles p
set referral_code = public.generate_referral_code()
from auth.users u
where p.id = u.id and u.is_anonymous = false and p.referral_code is null;

-- ② 온디맨드 발급 — 보호 계정이 코드를 읽을 때 없으면 생성해 반환. 익명은 null.
create or replace function public.get_or_create_referral_code()
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); is_anon boolean; code text;
begin
  if uid is null then return null; end if;
  select is_anonymous into is_anon from auth.users where id = uid;
  if coalesce(is_anon, true) then return null; end if;   -- 익명 계정은 코드 없음

  select referral_code into code from public.profiles where id = uid;
  if code is null then
    code := public.generate_referral_code();
    update public.profiles set referral_code = code where id = uid and referral_code is null;
    -- 동시 호출로 이미 채워졌으면 그 값을 최종 반환(레이스 안전)
    select referral_code into code from public.profiles where id = uid;
  end if;
  return code;
end;
$$;
revoke execute on function public.get_or_create_referral_code() from anon;
