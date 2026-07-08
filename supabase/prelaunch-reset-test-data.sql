-- ============================================================================
-- 출시 전 테스트 데이터 초기화 (1회성 수동 스크립트)
-- 실행 위치: Supabase 대시보드 SQL 에디터에서 직접 실행 (마이그레이션 파일 아님, 순번 없음)
-- 실행 시점: 비공개 테스트 종료 직후 ~ 프로덕션 공개 직전, "테스터 외 실유저가 아직 없는" 시점.
--
-- 대상(초기화함): 예측 리그 기록·랭킹 통계·추천코드 사용 기록·칭호/배경 보유·명예 기록·
--                admin 감사로그·야구공 원장(잔액은 최초 지급액 15로 리셋).
-- 대상 아님(건드리지 않음): auth.users/profiles 행 자체, favorite_team, applied_skin_id,
--                owned_skins(Phase2 스킨 보유), attendance_claims(출석 이력).
--   → 테스터가 소셜 연동을 다시 하거나 스킨/출석 기록을 다시 쌓을 필요 없게 하기 위함.
--   → 이 범위도 초기화하고 싶다면 이 스크립트를 그대로 쓰지 말고 별도로 요청할 것.
--
-- ⚠️ 주의: profiles 전체 행의 balance를 리셋한다 — 테스터 외 실제 유저가 이미 가입된
--   상태에서 실행하면 그 유저들 잔액도 함께 리셋된다. 반드시 "테스터만 존재하는 시점"에 실행.
-- ============================================================================

begin;

truncate table public.award_history;
truncate table public.cosmetic_admin_events;
truncate table public.owned_titles;
truncate table public.referral_redemptions;
truncate table public.predictions;
-- prediction_stats.equipped_owned_background_id → owned_backgrounds(id) FK 때문에 두 테이블을 함께 truncate(0014).
truncate table public.owned_backgrounds, public.prediction_stats;
truncate table public.baseball_ledger;

-- 잔액을 최초 지급액(15)로 리셋 + 원장에 지급 기록 재기재(잔액=원장 합 불변식 유지)
update public.profiles set balance = 15, updated_at = now();
insert into public.baseball_ledger (user_id, type, amount, reason, label)
select id, 'earn', 15, 'initial_grant', '첫 지급(출시 전 초기화)' from public.profiles;

-- 소셜 연동(보호된) 유저에게만 추천코드 재발급 — 발급 조건(is_anonymous=false)과 동일 로직
update public.profiles p
set referral_code = public.generate_referral_code()
from auth.users u
where p.id = u.id and u.is_anonymous = false;

commit;
