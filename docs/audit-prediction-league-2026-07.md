# 통합 감사 리포트 — 예측리그·추천코드·라커룸 배경·칭호·닉네임

- 일자: 2026-07-07 · 방식: 읽기 전용(코드 무수정) · 기준 커밋: `37205d31`
- 범위: `supabase/migrations/0001·0006~0010`, `data-pipeline/predictions-sync·monthly-rewards·season-rewards.mjs`, `prediction-rewards.yml`, `app/services/predictions·cosmetics·referrals.ts`, `app/components/PredictionCard.tsx`, `app/screens/PredictionLeague·TitleList·BackgroundShop·HallOfFame·LockerRoom·Settings.tsx`, `app/utils/titleConfig·lockerBackgroundConfig.ts`, `docs/stage6-cosmetics-design.md`, `docs/prediction-league-design.md`, `docs/roadmap.md`
- 표기: 사실 근거는 `파일:라인` 또는 함수명. 추측인 부분은 **[추측]** 명시.

## 1. 전체 결론

**P0(즉시 수정) 없음.** 재화 이동·판정·보상의 핵심 경로는 전부 서버(RPC definer + service_role) 단일 경로로 잠겨 있고, 멱등 장치(status='pending' 가드, unique 제약 + on conflict, FOR UPDATE)가 일관되게 들어가 있어 중복 지급·클라 조작 경로는 발견하지 못했다. 문서(stage6 설계)와 SQL 구현의 정합성도 타이브레이크 순서·게이트 수치까지 정확히 일치한다.

다만 **출시 전 닫아야 할 운영 갭 2건(P1)** 이 있다: ① 정산이 영구 누락되는 경로(전 경기 취소일 / 자정 넘긴 확정 / 정산 호출 실패)가 존재하고 소급 정산 장치가 없음, ② 월간 정산을 1일에 놓치면 수동 복구 경로가 사실상 대시보드 SQL뿐인데 문서화가 없음. 그 외 P2는 대부분 왜곡/어뷰징의 낮은 확률 경로다.

## 2. P0 — 즉시 수정 필요

없음.

(참고: `0008`의 `get_monthly_leaderboard` 반환 타입 변경으로 인한 42P13 마이그레이션 에러는 감사 직전 `drop function if exists` 선행으로 이미 수정됨 — 커밋 예정 상태.)

## 3. P1 — 출시 전 수정 권장

### P1-1. 정산 영구 누락 경로 (예측이 영원히 `pending`으로 남음)
`predictions-sync.mjs:96` — 정산은 `dailyHoney-history.json`의 마지막 결과 날짜가 **오늘 games.json 날짜와 일치할 때만** 실행된다(코드 주석에 "알려진 한계"로 명시됨). 누락 시나리오:
- **(a) 전 경기 취소일**: `dailyHoney.mjs:42-43` — playable 0경기면 `null` 반환 → history에 그 날짜가 영영 안 실림 → 그날 제출된 예측은 void 처리 자체가 안 되고 영구 `pending`.
- **(b) 마지막 경기가 자정(KST) 넘겨 종료**: games.json 날짜가 다음날로 넘어간 후 확정되면 전날 정산 트리거가 다시 오지 않음. **[추측: build.mjs의 날짜 전환 시각에 따라 실제 발생 확률 다름 — 전환 로직 확인 필요]**
- **(c) settle_prediction 호출이 그날 마지막 파이프라인 실행에서 네트워크 실패**: `predictions-sync.mjs:77`은 경고 로그만 남기고, 다음 실행이 날짜를 넘기면 재시도 없음.

**파급**: 유저 카드가 영원히 "결과 대기중"(`PredictionCard.tsx:138`) + 리더보드 참여수 영구 왜곡(P2-1과 결합) + 월간 정산 시 해당 유저 적중률 분모 오염.
**권고**: settle 단계를 "오늘"이 아니라 **"pending인 과거 날짜 전체"를 dailyHoney-history와 대조해 정산**하는 catch-up 방식으로 바꾸고, history에 없는 과거 날짜 중 "그날 전 경기 취소"가 확인되는 케이스는 void 일괄 처리. (파이프라인만 수정하면 됨 — DB 함수는 이미 날짜 파라미터를 받으므로 그대로 사용 가능.)

### P1-2. 월간 정산 미실행 시 복구 경로 부재 + 미문서화
`prediction-rewards.yml:22` — `workflow_dispatch`(season 입력 없음)로 monthly job을 수동 실행할 수 있지만, `monthly-rewards.mjs:25`의 `isFirstOfMonthKst()` 게이트 때문에 **1일(KST)이 지나면 수동 dispatch도 스킵**된다. 1일 03:00 KST 실행이 Actions 장애 등으로 누락되면 복구 방법은 대시보드에서 `select grant_monthly_rewards('YYYYMM')` 직접 실행뿐인데, 이 절차가 어디에도 문서화돼 있지 않다.
**권고**: dispatch 입력에 `month`(YYYYMM)를 추가해 게이트 우회 재실행을 허용하거나, 최소한 복구 SQL 한 줄을 runbook(README/roadmap)에 박아둘 것. RPC 자체는 멱등(`award_history_unique_award` + on conflict)이라 재실행 안전함은 확인됨.

## 4. P2 — 개선 권장

### P2-1. 리더보드·정산 집계에 `pending`이 참여수로 포함
`0008:175, 193` 및 `grant_monthly_rewards`/`grant_season_rewards`의 모든 집계가 `status <> 'void'` 필터를 쓰는데, 이는 `pending`을 포함한다. 낮 시간대 리더보드에서 오늘 미정산 예측이 참여 +1(포인트 0)로 잡혀 적중률이 희석되고, P1-1의 영구 pending 행은 **영구 왜곡**이 된다. 권고: `status in ('hit','miss')`로 명시.

### P2-2. 취소 경기 고의 선택 = 무위험 스트릭 보존 어뷰징
`PredictionCard.tsx:182-188` — 선택 바텀시트가 오늘 전 경기를 상태 무관하게 노출(CANCELED 포함). 마감 전 이미 취소 발표된 경기를 고르면 `judgeSelection`(`predictions-sync.mjs:36`)이 void 처리 → 연속 적중(current_streak)이 리스크 없이 보존됨(설계 §8 "void는 연속 유지"의 악용). streak은 `title.streak3/5`와 랭킹 타이브레이크(`best_streak`)에 영향. 권고: 픽커에서 `status !== 'SCHEDULED'` 제외(클라) — 서버는 경기 상태를 모르므로 클라 필터가 현실적 방어선.

### P2-3. `redeem_referral_code` 무제한 시도(브루트포스 방어 0)
`0010:67-106` — 실패 시도에 대한 rate limit이 전혀 없음. 코드 공간이 31^6≈8.9억이라 현실적 위협은 낮지만, 봇이 무한 시도해도 흔적(테이블)에 안 남는다. 권고: 시도 로그 또는 유저당 시도 횟수 제한(예: 일 10회). 출시 규모(지인 테스트)에선 P3에 가까움.

### P2-4. `referral_redemptions` SELECT 정책이 referrer의 raw UUID를 referee에게 노출
`0010:62-63` — referee가 자기 행을 select하면 `referrer_user_id`(auth UUID)가 보인다. 클라 코드는 `id`만 조회(`referrals.ts:14`)하지만 API 표면상 "user_id 비노출 원칙"(stage6 §4-3) 위배. 권고: 컬럼 제한이 필요하면 뷰 분리(RLS는 컬럼을 못 가림 — award_history_public과 동일 패턴).

### P2-5. 시즌 정산 사전 확인(dry-run) 장치 없음
`season-rewards.mjs` — 날짜/라벨을 잘못 넣고 dispatch하면 즉시 지급된다. 멱등이라 "같은 파라미터 재실행"은 안전하지만, **잘못된 파라미터로 실행된 지급의 회수**는 `admin_revoke_*` 4종 + `award_history` 수동 삭제가 필요. 권고: `DRY_RUN=1`이면 카운트만 반환하는 모드 추가(수상자 계산 CTE는 그대로, insert만 스킵) 또는 최소한 실행 전 파라미터 재확인 절차를 runbook에.

### P2-6. 정산 감사 로그 테이블 부재
정산 실행 기록(언제·몇 건·결과 JSON)이 GitHub Actions 로그에만 남는다(90일 보존). `cosmetic_admin_events`처럼 `batch_runs` 성격의 테이블이 없어, 훗날 "그 달 정산이 돌았는지" 확인이 어려움. 권고: grant_* RPC 반환 JSON을 기록하는 테이블 1개 추가(저비용).

## 5. P3 — 참고

1. **`set_nickname` 서버측 trim/문자 검증 없음** (`0008:139`) — 길이만 검사. 클라는 trim하지만(`PredictionCard.tsx:88`) RPC 직접 호출 시 공백 2자 닉네임("  ") 가능. 금칙어 정책도 코드·문서 어디에도 없음(문서 정리 필요).
2. **`generate_referral_code` EXECUTE 미회수** (`0010:14`) — PUBLIC 실행 가능. non-definer라 RLS 하에서 caller가 얻는 정보 없음(자기 행만 보여 충돌검사 무의미)을 확인했으나 위생상 revoke 권장.
3. **BackgroundShop 오프라인 무반응** (`BackgroundShop.tsx:48`) — 오프라인에서 구매 탭 시 아무 피드백 없음(막히긴 함). 장착 실패도 조용히 무시(`:59-60`).
4. **PredictionLeague 미참여 CTA가 비클릭 텍스트** (`PredictionLeague.tsx:75`) — "오늘경기 탭에서 시작해보세요"가 Pressable 아님.
5. **명예의 전당 빈 상태 설명 부족** (`HallOfFame.tsx:75`) — "아직 수상 기록이 없어요"만 표시. 첫 수상이 언제 생기는지(매월 1일 정산) 안내 없음.
6. **추천코드 입력 사전 확인 모달 없음** (`Settings.tsx:75`) — "평생 1회"인데 오타 입력 방지 확인 단계 없음(잘못된 코드는 실패하니 실질 위험은 존재하는 남의 코드 오입력뿐).
7. **`baseball_ledger` reason 주석 미갱신** (`0001:32`) — `background_purchase`, `referral_referee/referrer`, `referral_reward_reversed` 등 신규 reason이 주석 열거에 없음.
8. **`rewardFor` 수치(적중 10공/11pt, 미적중 1pt)가 설계 문서에 "구현 단계 확정" 상태로 남아있음** (`predictions-sync.mjs:42-49`) — 구현은 됐는데 문서 확정 반영이 안 됨.
9. **동시 redeem 레이스 시 unique_violation이 raw 예외로 클라 전달** (`0010:97`) — exists 체크 후 insert 사이 레이스. 클라는 "오류가 발생했어요"로 처리되므로 실질 무해.
10. **`handle_user_protected` 트리거에 WHEN 절 없음** (`0010:42-44`) — auth.users의 모든 update마다 함수 호출(본문에서 조건 체크라 저비용).

## 6. 기능별 감사 결과

### 예측 리그 — ✅ 핵심 무결성 전부 서버 보장
| 항목 | 판정 | 근거 |
|---|---|---|
| 하루 1회 | ✅ | `predictions` PK(user_id, date) — `0006:35` |
| 마감 서버 보장 | ✅ | `prediction_windows.lock_at`(service_role만 쓰기) + `submit_prediction`의 `now() >= lock_at` 체크 — `0006:134-140`. 창 미생성 시 `window_not_ready`로 제출 자체 불가(fail-closed) |
| KST 서버 기준 | ✅ | 모든 날짜가 `now() at time zone 'Asia/Seoul'` — 클라 시간 미사용 |
| 정산 후 변경 불가 | ✅ | upsert의 `where status = 'pending'` 가드 — `0010:174` |
| void≠miss | ✅ | `judgeSelection` CANCELED→void, `settle_prediction` void는 참여수·스트릭 무영향 — `0007:108,110` |
| tiedGameIds 적중 | ✅ | `predictions-sync.mjs:38` |
| 판정 클라 조작 불가 | ✅ | dailyHoney는 파이프라인 산출물, settle은 service_role 전용(`revoke ... from authenticated`) |
| 정산 멱등 | ✅ | status 가드로 2회 호출 시 no-op — `0007:98-99` |
| ⚠️ 정산 누락 경로 | **P1-1** | 위 참조 |
| ⚠️ pending 집계 포함 | **P2-1** | 위 참조 |

### 추천코드 — ✅ 정책 구현 일치, 방어 최소선 충족
| 항목 | 판정 | 근거 |
|---|---|---|
| 입력=연동 계정만 | ✅ | `is_anonymous` 체크 → `not_protected` — `0010:77-80` |
| 발급=연동 계정만 | ✅ | `is_anonymous true→false` 트리거만 발급 — `0010:31-44` |
| 평생 1회 | ✅ | `referee_user_id unique` + 사전 exists 체크 |
| 자기추천 차단 | ✅ | `0010:93-95` |
| 존재하지 않는 코드 | ✅ | `invalid_code` 반환(예외 아님) |
| 보상 분리(즉시/조건부) | ✅ | referee=redeem 즉시 +10, referrer=`maybe_reward_referrer`(첫 예측 시) |
| 캡(일2/월10) 서버 적용 | ✅ | `0010:122-131`, 초과=capped 기록만 |
| 중복 지급 레이스 | ✅ | `FOR UPDATE` + `status='pending'` 전이 — `0010:117-120` |
| ledger 정합 | ✅ | 지급·회수 모두 ledger+balance 동일 트랜잭션 |
| 관리자 취소 | ✅ | `admin_cancel_referral_reward`(잔액 회수 포함, blocked 마킹) |
| 상태값 | ℹ️ | pending/rewarded/capped/blocked — 감사 질문의 qualified/rejected와 명칭만 다르고 의미 동일 |
| ⚠️ 브루트포스/UUID 노출 | **P2-3, P2-4** | 위 참조 |
| 문서 | ❌ **문서 누락** | docs/에 추천코드 정책 문서 없음(SQL 주석 + 세션 메모리뿐) |

### 라커룸 배경 — ✅ 서버 SSOT 검증, 가격 클라-서버 완전 일치
| 항목 | 판정 | 근거 |
|---|---|---|
| currency만 구매 가능 | ✅ | `bg_unlock <> 'currency'` → `not_purchasable` — `0007:52-54` |
| 명예 배경 구매 불가 | ✅ | monthly_champion/season_trophy = `monthly_rank`/`season_rank` — `0007:32-33` |
| 가격 서버 검증 | ✅ | 클라는 id만 전송, 가격은 `backgrounds` 테이블(클라 SELECT도 revoke) — `0007:25` |
| 가격 동기화 | ✅ | 12종 전수 대조: `lockerBackgroundConfig.ts` ↔ `0007`+`0009` 가격·id 완전 일치 |
| 구매 원자성 | ✅ | balance 차감+owned insert+ledger가 단일 함수 트랜잭션, `FOR UPDATE` 잠금 |
| 잔액 부족/재구매 | ✅ | `insufficient` / `already`(과금 없이 성공 반환) |
| unique | ✅ | `owned_backgrounds` PK(user_id, background_id) |
| 미보유 장착 차단 | ✅ | `validate_equipped_cosmetics` 트리거 — `0006:96-113`. null(해제)은 허용 |
| 장착 실패 복구 | ✅ | 낙관적 갱신 안 함(성공 후 setState) + 재진입 시 서버 재조회 — `BackgroundShop.tsx:56-63` |
| 가독성 오버레이/폴백 | ✅ | LockerRoom: 커스텀 배경 위에도 동일 오버레이(`bgOverlay` 0.35) + 미장착 시 stadium-bg 폴백. 이미지 로드 실패 폴백은 없으나 정적 require(번들 포함)라 실패 경로 사실상 없음 **[추측: 저장소 손상 외 실패 시나리오 없음]** |

### 칭호 — ✅ 구매 경로 원천 부재, 지급 시점 정확
| 항목 | 판정 | 근거 |
|---|---|---|
| 구매 불가 | ✅ | 칭호 구매 RPC/카탈로그/UI 어디에도 없음. `owned_titles` 쓰기 전부 revoke |
| acquired_via 제한 | ✅ | CHECK(default/achievement/monthly_rank/season_rank/event/admin) — `0007:13-14` |
| 신입 관전러 중복 없음 | ✅ | 최초 설정 시(`cur_nickname is null`)만 + grant_title 멱등 — `0008:157-159` |
| 업적 7종 시점 | ✅ | 문턱 통과 순간만(old<N and new>=N) — `0007:127-145`. streak3/5는 hit 시에만 |
| void 카운트 제외 | ✅ | total_predictions에 void 미포함 — `0007:110` |
| unique | ✅ | `owned_titles` PK |
| 미보유 장착 차단 | ✅ | 동일 트리거. admin revoke 시 장착 해제까지 처리 — `0008:104-105` |
| admin 전용 + 감사로그 | ✅ | RPC 4종 revoke from authenticated + `cosmetic_admin_events` 필수 reason |
| 표시명 커버리지 | ✅ | `titleConfig.ts` DYNAMIC_RE가 서버 생성 규칙(monthly/season × champion/top10/detective/legend) 전부 파싱 |

### 닉네임 — ✅ 정책 서버 강제
| 항목 | 판정 | 근거 |
|---|---|---|
| 최초 설정 + 월1회 변경(KST) | ✅ | `nickname_changed_month` 비교, 최초 설정은 변경 카운트 미소모 — `0008:143-155` |
| 2~10자 서버 강제 | ✅ | `0008:139` + CHECK 제약(`0008:11-12`) 이중 |
| RPC 전용 | ✅ | 컬럼 GRANT 회수 — `0008:16` |
| 중복 허용 vs UI | ✅ | 리더보드 `group by user_id` + `is_me`로 자기 행 식별(0006의 nickname group-by 버그를 0008이 수정) |
| raw user_id 미반환 | ✅ | 반환 컬럼에 user_id 없음, `is_me`만 |
| ⚠️ trim/금칙어 | **P3-1** | 위 참조 |

## 7. SQL/RLS/RPC 보안 체크

- `baseball_ledger` 클라 쓰기: ✅ 전부 revoke(`0001:196`), select own만.
- `owned_titles`/`owned_backgrounds` 위조: ✅ 쓰기 revoke, definer 함수만.
- `profiles` 민감 컬럼: ✅ update GRANT는 favorite_team, applied_skin_id만(referral_code·balance 불포함).
- `skins`/`backgrounds`/`prediction_windows`/`award_history`/`cosmetic_admin_events`: ✅ 클라 완전 잠금(정책 없음+권한 회수).
- SECURITY DEFINER `set search_path = public`: ✅ 전 definer 함수 확인(비definer는 `generate_referral_code` 1개뿐 — 의도적, P3-2).
- `auth.uid()` null 체크: ✅ 클라 노출 RPC 전부(submit/set_nickname/redeem/purchase×2/claim). 리더보드는 anon revoke로 커버.
- service_role 키: ✅ 파이프라인 env(Actions secret)만. 클라 번들엔 anon key만(설계상 공개 안전).
- `award_history_public` 뷰: ✅ user_id 컬럼 자체가 없음. anon에도 select 허용(공개 데이터 의도) — 노출 필드는 표시명·수상정보뿐.

## 8. 재화/보상 중복 지급 가능성

| 경로 | 방어 | 판정 |
|---|---|---|
| settle 재호출 | status='pending' 가드 | ✅ |
| 월간/시즌 정산 재실행 | `award_history_unique_award` + 전체 insert on conflict do nothing | ✅ (칭호·배경·명예기록 3중 멱등) |
| 추천인 보상 동시 호출 | FOR UPDATE + pending 전이 | ✅ |
| redeem 동시 호출 | unique(referee) — 레이스 시 예외로 실패(지급 안 됨) | ✅ (UX만 P3-9) |
| 배경 재구매 | 보유 체크 선행(과금 전) | ✅ |
| 출석/스킨(기존) | 기감사 범위 외, 패턴 동일 | — |

**유일한 지급 누락(중복 아님) 리스크 = P1-1** (지급이 안 되는 방향).

## 9. 개인정보/공개 데이터 노출

- 리더보드: nickname/포인트/적중만 + is_me. ✅
- 명예의 전당: display_name 스냅샷만, 탈퇴자 "탈퇴한 사용자" 치환은 **뷰에서 처리**(`0008:44`) + BEFORE DELETE 트리거가 user_id 명시적 null화(`0008:49-59`) — FK cascade 의존 안 함. ✅
- 이메일/provider/잔액/거래내역: 어떤 공개 표면에도 없음. ✅
- ⚠️ referral_redemptions의 referrer UUID(P2-4)가 유일한 원칙 위배 지점.

## 10. 오프라인/캐시/동기화

- 예측 제출: 오프라인 시 카드가 안내 문구로 대체(제출 UI 미노출) — `PredictionCard.tsx:115-116`. ✅
- 배경 구매: 오프라인 차단되나 무피드백(P3-3).
- 장착(칭호/배경): 오프라인 게이트 없음 — 실패 시 조용히 무시 + 재진입 시 서버 상태 복원. 낙관적 롤백 불필요 구조. 허용 가능.
- 잔액 동기화: 구매 후 `refreshAccount()`(ScoreSkin 컨텍스트 강제 재동기화) 호출 확인. ✅

## 11. 문서와 구현 불일치

| 분류 | 항목 |
|---|---|
| ✅ 일치 | stage6 §8-2 타이브레이크(포인트→적중수→적중률→최고연속→공동) = `0008` RANK() order by 정확 일치. 감별왕(적중률→적중수→최고연속) 동일. TOP10 게이트 20/50, 최소참여 5/30, 레전드=챔피언 동일 인물, 참여자 미달 시 "TOP10만 스킵" 전부 일치 |
| ✅ 일치 | roadmap Phase 4/추천코드 상태(오늘 갱신분) |
| 문서 누락 | 추천코드 정책 전체(발급/입력 조건, 보상, 캡, admin 취소) — docs/ 미존재 |
| 문서 누락 | 정산 실패 복구 runbook(월간 재실행 SQL, 시즌 오지급 회수 절차) |
| 미확정 잔존 | prediction-league-design.md 보상 수치가 "구현 단계 확정" 문구로 남음 — 구현값(적중 10공/11pt, 미적중 1pt)을 문서에 확정 반영 필요 |
| 주석 노후 | `0001` ledger reason 열거 주석(P3-7) |

## 12. 재현 가능한 버그/어뷰징 시나리오

1. **[P1-1a]** 전 경기 우천취소일에 마감 전 예측 제출 → dailyHoney 미확정 → 영구 "결과 대기중". 재현: 취소일 시뮬레이션(games.json 전 경기 CANCELED)으로 파이프라인 실행.
2. **[P2-2]** 오전에 1경기 취소 발표된 날, 픽커에서 취소 경기 선택 → 확정 void → 스트릭 무위험 보존. 재현: 클라에서 CANCELED 경기 선택 후 정산 확인.
3. **[P2-1]** 정산 전 시간대에 리더보드 조회 → 오늘 pending이 참여수에 포함돼 적중률 하락 표시. 재현: 낮 시간 리더보드 vs 정산 후 비교.
4. **[P3-1]** REST로 `set_nickname(p_nickname: '  ')` 직접 호출 → 공백 닉네임 등록.

## 13. 필요한 테스트 케이스 (마이그레이션 적용 후 실기기 검증용)

stage6 §10-2 기존 시나리오에 추가로:
1. 취소 경기 선택 → void → 스트릭 유지 + 참여수 미증가 확인
2. 동점 2명 월간 정산 → 공동 챔피언(칭호+배경+award_history 2건) 확인
3. 월간 정산 2회 연속 실행 → 지급·기록 증가 없음(멱등) 확인
4. 닉네임: 최초 설정 → 같은 달 1회 변경 성공 → 2회째 rate_limited 확인
5. 추천: 익명 상태 redeem → not_protected / 연동 후 자기 코드 → self_referral / 정상 코드 → +10 + 첫 예측 시 추천인 +10
6. 추천인 캡: 하루 3명째 첫 예측 → capped 기록 확인
7. 계정 탈퇴 → award_history_public에 "탈퇴한 사용자" 표시 확인
8. admin_revoke_title로 장착 중 칭호 회수 → equipped_title null 확인
9. 미보유 background_id 직접 update(REST) → 트리거 예외 확인
10. balance 직접 update(REST) → 권한 거부 확인

## 14. 수정 우선순위 Top 10

1. **P1-1** 정산 catch-up(과거 pending 소급 정산 + 전경기 취소일 void 처리) — 파이프라인 수정
2. **P1-2** 월간 정산 수동 재실행 경로(dispatch month 입력 or runbook)
3. **P2-1** 집계 필터 `status in ('hit','miss')`로 명시
4. **P2-2** 픽커에서 SCHEDULED 아닌 경기 제외
5. **P2-5** 시즌 정산 dry-run 모드
6. **P2-6** batch_runs 정산 로그 테이블
7. **P2-4** referral_redemptions 뷰 분리(UUID 비노출)
8. **P3-1** set_nickname 서버 trim + 공백만 닉네임 거부
9. **P3-3/4/5/6** UX 4건(오프라인 피드백, CTA 클릭화, 빈 상태 안내, redeem 확인 모달)
10. **문서 3건**(추천코드 정책 문서화, 보상 수치 확정 반영, 복구 runbook)

## 15. 구현 전에 결정해야 할 남은 질문

1. **전 경기 취소일의 예측 처리 원칙** — 전부 void(참여 미카운트·스트릭 유지)로 확정? (P1-1 수정의 전제)
2. **취소 경기 선택 자체를 막을지** — 클라 필터만으로 갈지(서버는 경기 상태를 모름), 아니면 pipeline이 취소 경기 목록을 prediction_windows에 함께 실어 서버 검증까지 갈지.
3. **닉네임 금칙어** — 지인 테스트 단계에선 불필요해 보이나, 공개 출시 시점 정책(필터 도입 여부)을 언제 결정할지.
4. **정산 로그(batch_runs)** — 지금 넣을지, 유저 늘면 넣을지.
