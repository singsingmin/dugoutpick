# 추천코드 정책 (v1)

> 확정: 2026-07-07 Discord 논의 · 구현: `supabase/migrations/0010_referral_codes.sql`(+`0011_audit_fixes.sql`), `app/services/referrals.ts`, `app/screens/Settings.tsx`("추천코드" 섹션)
> 관련: [prediction-league-design.md](prediction-league-design.md) · [roadmap.md](roadmap.md) Phase 4-부속

## 1. 개념

- **추천인(referrer)**: 자기 코드를 남에게 공유하는 사람.
- **피추천인(referee)**: 남의 코드를 입력하는 사람.
- 목적: 출시 전 지인 확산으로 예측 리그 테스트 규모 확보 + 참여 유도.

## 2. 코드 발급 (추천인 자격)

- **소셜 연동(보호된 계정)만** 코드를 가진다. 익명 계정은 코드 없음.
- 발급 시점: 익명 → 소셜 연동 전환 순간(`is_anonymous: true→false`) 트리거(`handle_user_protected`)가 자동 생성.
- 코드 형식: 6자, 혼동 문자(0/O/1/I/L) 제외한 31자 집합(`generate_referral_code`). 충돌 시 재시도.
- 표시: 설정 → "추천코드" 섹션(보호된 계정에게만 "내 추천코드" 노출).

## 3. 코드 입력 (피추천인)

- **피추천인도 소셜 연동(보호된 계정) 필수.** 익명 상태 입력 시 `not_protected`로 거부.
  (최초 설계는 "익명도 가능"이었으나 2026-07-07 명시적으로 뒤집음.)
- **평생 1회만.** `referral_redemptions.referee_user_id UNIQUE`가 강제. 재입력 시 `already_redeemed`.
- 자기 코드 입력 금지 → `self_referral`.
- 존재하지 않는 코드 → `invalid_code`.
- 하루 실패 시도 20회 초과 → `too_many_attempts`(브루트포스 방어, `0011`).

## 4. 보상

| 대상 | 조건 | 보상 |
|---|---|---|
| 피추천인 | 코드 입력 즉시 | 야구공 +10 |
| 추천인 | 피추천인의 **첫 예측 참여**(`submit_prediction` 최초 호출) | 야구공 +10 |

- 추천인 보상 캡: **하루 2명 / 월 10명**. 초과분은 지급 없이 `capped`로 기록만.
- 보상 상태(`referrer_reward_status`): `pending` → `rewarded` / `capped` / `blocked`.
- 모든 지급·회수는 `baseball_ledger`에 기록(잔액 = 원장 합 불변식 유지).

## 5. 어뷰징 방어

- 자기추천: 서버 차단(`self_referral`).
- 동일 소셜계정 재사용: Supabase auth가 자체 차단(같은 Google 계정 = 같은 uid).
- **동일 기기 반복 추천은 기술적으로 완전 차단 불가** — 의심 패턴은 관리자가 사후 취소.
- 브루트포스(무작위 코드 시도): 일일 실패 시도 20회 캡 + 시도 로그(`referral_redeem_attempts`).

## 6. 관리자 운영

- `admin_cancel_referral_reward(redemption_id, reason)`: 의심 추천 보상 취소. 이미 지급됐으면 추천인 잔액 회수(`referral_reward_reversed` 원장 기록) + 상태를 `blocked`로.
- service_role/대시보드 전용(anon·authenticated 실행 불가).

## 7. 프라이버시

- `referral_redemptions` 테이블은 클라 직접 select **잠금**(`0011`). 클라는 `has_redeemed_referral()` 정의 함수로 "내가 입력했는가"만 조회 → referrer/referee UUID 비노출.
- 재화 무결성 원칙 유지: 추천 보상도 야구공(꾸미기·참여 재화)일 뿐, 판정·랭킹 포인트에 개입하지 않음.

## 8. 미결/후속

- 금칙어·코드 만료·비활성화 정책 없음(현 규모 불필요). 공개 출시 확대 시 재검토.
- 추천인의 "내가 추천한 목록" 화면은 미구현(UI 필요 시 별도 정의 함수로 노출 — UUID 비노출 유지).
