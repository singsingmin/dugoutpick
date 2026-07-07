# 운영 런북 — 예측 리그 정산·보상 (Ops Runbook)

> 대상: 예측 리그의 일일 정산 / 월간·시즌 보상 / 출시 전 초기화의 수동 개입·복구 절차.
> 관련: [prediction-league-design.md](prediction-league-design.md) · [referral-code-policy.md](referral-code-policy.md) · [audit-prediction-league-2026-07.md](audit-prediction-league-2026-07.md)
> 실행 주체: SQL은 Supabase 대시보드 SQL Editor(service_role), 워크플로는 GitHub Actions.

## 0. 정상 동작 요약 (개입 불필요)

- **일일 정산**: `update-data` 워크플로가 매 빌드 `data-pipeline/predictions-sync.mjs` 실행 → 예측 마감시각 upsert + 과거 pending 소급 정산.
- **월간 보상**: `prediction-rewards` 워크플로가 매일 18:00 UTC 실행 → 스크립트가 "KST 1일인가" 자체 게이팅 후 지난달 정산.
- **시즌 보상**: 자동 아님. 시즌 종료 후 수동 트리거(§3).

## 1. 일일 정산 — 소급 처리 방식 (P1-1 반영)

`predictions-sync.mjs`의 `planSettlements`가 **모든 pending 예측(과거 포함)** 을 매 실행마다 처리한다:

| 상황 | 처리 |
|---|---|
| 그날 dailyHoney 확정 있음 | `judgeSelection`으로 hit/miss/void |
| 그날 dailyHoney 확정 없음 + **오늘 이전(과거)** | **void**(전 경기 취소/노게임 = 확정된 명경기 없음). 스트릭 유지 |
| 오늘자 아직 미확정 | 보류(다음 실행에서 재시도) |

→ 정산 호출 실패나 자정 넘긴 확정으로 pending이 남아도 다음 실행이 자동 소급. **수동 개입 불필요.**

**한계(감수)**: 과거 실패건 재정산 시 그날 게임 취소 여부를 알 수 없어(오늘 games.json만 보유), 취소 경기를 골랐던 유저가 miss로 처리될 수 있음. 정산실패+취소선택 동시 발생은 극히 드문 이중결함이며, 보상 오지급 방향은 아님.

## 2. 월간 보상 — 실행 누락 시 복구 (P1-2)

**증상**: 1일 03:00 KST 실행이 Actions 장애 등으로 누락 → 그달 보상 미지급.

**복구**: `prediction-rewards` 워크플로를 `workflow_dispatch`로 수동 실행하되 **`month` 입력에 대상 월(YYYYMM)** 을 넣는다(예: `202608`). `season_start`는 비워둔다.
- `month`를 주면 스크립트가 "1일인가" 게이트를 우회하고 그달을 재정산한다.
- **멱등**: `grant_monthly_rewards`는 `award_history_unique_award` + 모든 insert `on conflict do nothing`이라 **여러 번 실행해도 중복 지급 없음.** 이미 일부 지급된 상태에서 재실행해도 안전.

**대시보드 직접 실행(대안)**:
```sql
select public.grant_monthly_rewards('202608');   -- 대상 월 YYYYMM
```
반환 JSON(championCount/top10Count/detectiveCount/participantCount)과 `batch_runs` 테이블에서 실행 기록 확인.

## 3. 시즌 보상 — 수동 실행 + dry-run (P2-5)

시즌 종료일이 매년 달라 자동화하지 않는다. `prediction-rewards` 워크플로를 `workflow_dispatch`로 실행하며 `season_start`/`season_end`/`season_label`을 채운다.

**먼저 dry-run으로 수상자 확인(권장)**: `season_dry_run` = `true`로 실행 → 지급 없이 카운트만 반환. 파라미터(날짜 범위·라벨) 실수를 미리 잡는다.

**대시보드 직접 실행(대안)**:
```sql
-- 확인만(지급 안 함)
select public.grant_season_rewards('2026-03-28', '2026-10-15', '2026', true);
-- 실제 지급
select public.grant_season_rewards('2026-03-28', '2026-10-15', '2026', false);
```
실제 지급 시 `batch_runs`에 기록됨(dry-run은 기록 안 함).

**오지급 회수(파라미터 실수로 잘못 지급한 경우)**:
- 칭호/배경: `admin_revoke_title` / `admin_revoke_background`(장착 해제까지 처리).
- 명예 기록: 해당 `award_history` 행 수동 삭제.
- (dry-run을 먼저 돌리면 이 상황을 예방할 수 있음.)

## 4. 정산/보상 실행 로그 (P2-6)

`batch_runs` 테이블에 월간/시즌 보상 실행이 기록된다(job_type·period_label·result·created_at). "그달 정산이 돌았는지" 확인용:
```sql
select job_type, period_label, dry_run, result, created_at
  from public.batch_runs order by created_at desc limit 20;
```
(일일 예측 정산은 `predictions.settled_at` + `settle_prediction` 로그로 추적 — 별도 batch_runs 미기록.)

## 5. 출시 전 테스트 데이터 초기화

`supabase/prelaunch-reset-test-data.sql`을 대시보드에서 실행. **실유저가 아직 없는 시점**(비공개 테스트 종료 ~ 프로덕션 공개 직전)에만. 상세는 파일 상단 주석 참고.

## 6. 추천 보상 어뷰징 대응

의심 추천(동일 기기 반복 등)은 관리자가 사후 취소:
```sql
select public.admin_cancel_referral_reward('<redemption_id>', '사유');
```
이미 지급됐으면 추천인 잔액 회수 포함. 상세는 [referral-code-policy.md](referral-code-policy.md) §6.
