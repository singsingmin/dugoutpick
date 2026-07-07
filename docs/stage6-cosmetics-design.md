# Stage 6 — 예측 리그 칭호 · 라커룸 배경 설계 (Prediction League Cosmetics)

> **성격:** 구현 전 확정 설계 문서. "간단히 MVP로 만들고 나중에 개선"이 아니라, 정책·DB·API·권한·UI·운영·정산·엣지케이스·테스트 기준을 먼저 전부 정하고 **구현만 단계별로 진행**한다.
> **상태:** 정책 결정 완료(2026-07-07, Discord 논의). DB/RPC 일부 구현 완료(`0007_prediction_cosmetics.sql`), **UI 전체 미구현**.
> **관련 문서:** [prediction-league-design.md](prediction-league-design.md)(예측 리그 본체) · [phase3-account-design.md](phase3-account-design.md)(재화/스킨 기반) · [roadmap.md](roadmap.md) E Phase 3-Pre/4.
> **범위 제외(이번 Stage 6에서 다루지 않음):** 프로필 프레임, 예측 카드 꾸미기, 공유 카드, 친구 프로필 방문.

---

## 0. 목표

예측 리그 참여·성과(적중·연속·랭킹)를 라커룸의 꾸미기 자산(칭호·배경)으로 되돌려주는 보상 루프를 완성한다. 야구공(재화)의 소비처를 스킨에서 라커룸 배경까지 확장하고, 칭호는 재화로 살 수 없는 "명예" 축으로 분리해 재화 무결성 원칙([[dugoutpick-tech-decisions]] 전 Phase 공통: "야구공으로 판정·랭킹을 유리하게 만들 수 없다")을 지킨다.

---

## 1. 현재 상태 감사 (2026-07-07 기준)

### 1-1. 정책 전제 검증

| 전제 | 상태 | 근거 |
|---|---|---|
| 칭호 구매 안 함 | ✅ 이미 구현됨 | `owned_titles`에 구매 RPC 자체가 없음(카탈로그/가격 테이블도 없음) |
| 칭호는 야구공으로 못 삼 | ✅ 이미 구현됨 | 위와 동일 — 애초에 구매 경로가 없어 원천 차단 |
| 칭호 획득 경로 = achievement/monthly_rank/season_rank/event/admin(+default) | ⚠️ 일부 구현됨 | `owned_titles.acquired_via` CHECK 제약(0007)으로 6개 값만 허용. **achievement 6종 + default(신입 관전러) + monthly_rank + season_rank는 실제 지급 로직 있음. event·admin은 값만 예약돼 있고 실제로 지급하는 코드/도구가 전혀 없음**(§7-3 참고) |
| 라커룸 배경 = 야구공 소비처 | ⚠️ 일부 구현됨 | DB(`backgrounds` 카탈로그)+RPC(`purchase_background`)는 있음. **클라 UI(구매 화면)도, 배경을 화면 어디에 어떻게 시각적으로 적용하는지도 전혀 없음**(§6 참고 — 이번 감사에서 발견한 가장 큰 공백) |
| 일반 배경 = 야구공 구매 가능 | ✅ DB/RPC 구현됨 | `purchase_background`가 `unlock_type='currency'`만 허용(스킨의 M1 하드닝과 동일 원칙) |
| 명예 배경 = 월간/시즌 보상 전용, 구매 불가 | ✅ 구현됨 | `purchase_background`가 `unlock_type<>'currency'`면 `not_purchasable` 반환 |
| 프로필 프레임 등 4종 제외 | ✅ 맞음 | 스코프에 아예 없음 |

### 1-2. "이미 구현된 것으로 알고 있는 항목" 검증

| 항목 | 상태 |
|---|---|
| `0007_prediction_cosmetics.sql` | ✅ 존재(DB 미적용 — Supabase 대시보드 실행 대기 중) |
| `owned_titles` / `owned_backgrounds` | ✅ 존재(0006에서 테이블 생성) |
| `acquired_via` CHECK 제약 | ✅ 존재(0007) |
| 월간/시즌 정산 파이프라인 | ✅ 존재(`monthly-rewards.mjs`, `season-rewards.mjs`, `prediction-rewards.yml`) |
| 월간 정산 자동화 | ✅ 매일 18:00 UTC(=03:00 KST) 실행, 스크립트가 "오늘이 1일인가"만 자체 게이팅 |
| 시즌 정산 수동 실행 | ✅ `workflow_dispatch` 입력(시작일/종료일/라벨) 기반, 자동 트리거 없음(시즌 종료일 자동 감지 미구현) |
| "신입 관전러" = `set_nickname` 시점 지급 | ✅ 구현됨(정산이 아니라 리그 참여 순간) |
| "꿀잼 레전드" = 시즌 포인트 1위에게 "시즌 예측왕"과 함께 지급 | ✅ 구현됨(별도 기준 없어 챔피언과 동일 인물로 해석 — 이 문서 §8-3에서 재확인 요청) |
| 실제 UI 미구현 | ✅ 맞음 — 제출/결과 카드(`PredictionCard`)와 랭킹 화면(`PredictionLeague`)엔 칭호·배경 관련 표시가 **전혀 없음** |

### 1-3. 감사 중 추가로 발견한 미비 사항 (문서화되지 않았던 공백)

1. **라커룸 배경의 "시각적 적용" 자체가 미정의.** 스킨은 `ScoreSkinRenderer`가 유니폼/전광판 등을 실제 렌더링하는 반면, "배경"이 화면의 어디를(라커룸 화면 배경? 프로필 카드 배경?) 무엇으로 바꾸는지 전혀 정해진 바 없다. → §6-1에서 결정 필요.
2. **클라 카탈로그(정적 config) 없음.** 스킨은 `app/utils/scoreSkinConfig.ts`(id·이름·설명·썸네일·정렬)를 서버 `skins` 테이블과 수동 동기화하는데, 배경은 이 짝이 되는 클라 파일이 없다.
3. **실제 이미지 에셋 0개.** 6개 배경 전부 그림 파일이 없다(스킨은 [[dugoutpick-asset-skin-pipeline]] 파이프라인으로 제작된 webp 에셋 보유).
4. **event/admin 지급 도구 없음.** CHECK 제약에 값만 있고, Supabase 대시보드에서 SQL을 직접 실행하는 것 외엔 지급할 방법이 없다. `debug_grant`(재화)처럼 admin 전용 RPC를 만들지 여부 미정.
5. **칭호 표시 UI 전무.** `prediction-league-design.md` §6은 "참여자: +닉네임·장착 칭호·적중률·연속·이번달 순위"를 요구하는데, 현재 `PredictionLeague.tsx`는 닉네임만 보여주고 장착 칭호도, 리더보드의 칭호도 표시하지 않는다.
6. **정산 결과 가시성 없음.** `grant_monthly_rewards`/`grant_season_rewards` 실행 결과를 확인하려면 GitHub Actions 로그를 직접 봐야 한다. 실패 알림 채널이 없다.
7. **"event" 칭호의 트리거 자체가 미정의.** 어떤 이벤트가 어떤 칭호를 주는지 카탈로그가 없다(이번 Stage 6 스펙에 없다면 후속 명시 필요).
8. **닉네임 변경 정책 불완전.** `prediction-league-design.md`는 "변경은 MVP 후순위 또는 월 1회 제한"이라 명시했는데, 현재 `set_nickname`은 횟수 제한 없이 계속 바꿀 수 있다.
9. **랭킹 동점자 처리 없음.** `grant_monthly_rewards`/`grant_season_rewards`의 챔피언·감별왕 선정이 `order by ... limit 1`이라, 포인트가 완전히 같은 동점자가 여럿이면 그중 정렬 순서상 우연히 걸리는 1명만 받는다. 예측 자체의 동률(`tiedGameIds`)과 달리 **랭킹 동률 규칙이 없다.**
10. **탈퇴/계정 통합 시 명예 기록 처리.** `owned_titles`/`owned_backgrounds`는 `on delete cascade`라, 유저가 탈퇴하면 "그 달의 챔피언이 없었던 것"처럼 기록이 사라진다. 역사적 랭킹 기록 보존 여부가 미정.

---

## 2. 정책 결정 요약 (확정)

| 항목 | 결정 |
|---|---|
| 칭호 구매 | 불가. 재화 무결성 원칙 최상위 적용 대상 |
| 칭호 획득 경로 | `default`(리그 참여 시 자동) · `achievement`(업적) · `monthly_rank` · `season_rank` · `event`(운영 이벤트) · `admin`(운영자 수동) |
| 배경 구매 | 일반 배경(4종)만 야구공으로 구매 가능 |
| 배경 명예 보상 | 월간/시즌 챔피언 전용, 구매 불가 |
| 일반 배경 4종 | 클래식 더그아웃(40) · 그린 필드 라커(40) · 야간 구장(50) · 라인업 보드룸(50) |
| 명예 배경 2종 | 월간 챔피언 룸(월간 포인트 1위) · 시즌 트로피룸(시즌 포인트 1위) |
| 업적 칭호(7종) | 신입 관전러 · 첫 예측 완료 · 첫 적중 완료 · 3연속 적중러 · 5연속 적중러 · 꿀잼 탐정(누적 적중 10) · 야구각 감별사(누적 유효 참여 30) |
| 월간 보상 | 매월 1일 03:00 KST. `YYYY.MM 예측왕`(포인트 1위) · `YYYY.MM TOP10`(포인트 상위 10, 유효 참여자 20명↑ 조건) · `YYYY.MM 감별왕`(적중률 1위, 최소 참여 5회) · 월간 챔피언 룸(포인트 1위) |
| 시즌 보상 | KBO 정규시즌 종료 다음날 03:00 KST(수동 실행). `YYYY 시즌 예측왕`(포인트 1위) · `YYYY 시즌 TOP10`(참여자 50명↑ 조건) · `YYYY 시즌 감별왕`(최소 참여 30회) · `YYYY 꿀잼 레전드`(시즌 특별 최상위 — 챔피언과 동일 인물, §8-3 재확인 요청) · 시즌 트로피룸 |
| 지급 시점 | achievement=정산(settle_prediction) 시점(신입 관전러만 예외=닉네임 설정 시점) / monthly_rank·season_rank=배치 정산 |
| 중복 방지 | `owned_titles`/`owned_backgrounds` PK(user_id, title_id/background_id) — 재지급 시 자동 no-op |

---

## 3. 데이터 모델

### 3-1. 이미 존재 (0006 + 0007)

```
owned_titles(user_id, title_id, acquired_via[CHECK: default|achievement|monthly_rank|season_rank|event|admin], acquired_at)
  PK(user_id, title_id)

owned_backgrounds(user_id, background_id, acquired_via, acquired_at)
  PK(user_id, background_id)

backgrounds(id, price, unlock_type[currency|monthly_rank|season_rank])   -- 카탈로그, 클라 비노출
  시드: lockerbg.classic_dugout(40,currency) · lockerbg.green_field(40,currency)
       · lockerbg.night_stadium(50,currency) · lockerbg.lineup_boardroom(50,currency)
       · lockerbg.monthly_champion(0,monthly_rank) · lockerbg.season_trophy(0,season_rank)

prediction_stats(user_id, nickname, total_predictions, total_hits, current_streak, best_streak,
                  equipped_title, equipped_background, updated_at)
  equipped_title/equipped_background는 트리거(validate_equipped_cosmetics)가 보유 여부만 검증.

baseball_ledger.related_background_id  -- 배경 구매 추적(related_skin_id와 분리)
```

### 3-2. title_id / background_id 명명 규칙 (확정)

- 업적(고정, 월 무관): `title.first_prediction`, `title.first_hit`, `title.streak3`, `title.streak5`, `title.honey_detective`, `title.veteran30`, `title.rookie_watcher`
- 월간(시기 종속): `title.monthly_champion.<YYYYMM>`, `title.monthly_top10.<YYYYMM>`, `title.monthly_detective.<YYYYMM>`
- 시즌(시기 종속): `title.season_champion.<라벨>`, `title.season_top10.<라벨>`, `title.season_detective.<라벨>`, `title.season_legend.<라벨>`
- 배경(시기 무관 — 같은 명예를 여러 번 얻어도 동일 id 재획득=no-op): `lockerbg.<slug>`

**⚠️ 결정 필요:** 월간/시즌 칭호는 title_id에 시기가 박혀 매달·매시즌 "새 칭호"로 쌓인다. 이는 의도된 설계(과거 수상 이력이 프로필에 전부 남음)이지만, 화면에 전부 나열하면 장기적으로 목록이 길어진다. §6-2에서 표시 방식 결정 필요.

### 3-3. 신규 필요 (이번 문서에서 결정, 미구현)

- **클라 정적 카탈로그** `app/utils/lockerBackgroundConfig.ts` — id·표시명·설명·썸네일 경로·`unlockType`·`price`. `backgrounds` 테이블과 수동 동기화(스킨과 동일 패턴, [[dugoutpick-asset-skin-pipeline]]).
- **칭호 표시용 정적 카탈로그** `app/utils/titleConfig.ts` — 고정 업적 title_id → 표시명/설명 매핑. 월간/시즌 title_id는 정규식으로 파싱해 표시명 생성(예: `title.monthly_champion.202608` → "2026.08 예측왕").
- (선택) `event`/`admin` 지급 로그 테이블 또는 최소한 `owned_titles.acquired_via='event'|'admin'` 건에 대한 사유 기록 컬럼 — 현재 스키마엔 "왜 줬는지" 남길 곳이 없음(`label` 유사 컬럼 부재).

---

## 4. API / RPC 명세

### 4-1. 이미 구현(0006+0007)

| RPC | 호출 주체 | 기능 |
|---|---|---|
| `grant_title(user_id, title_id, via)` | service_role만(내부 헬퍼) | 멱등 지급 |
| `grant_background(user_id, background_id, via)` | service_role만(내부 헬퍼) | 멱등 지급 |
| `purchase_background(background_id)` | authenticated | 구매(가격·unlock_type 서버 검증) |
| `settle_prediction(...)` | service_role만 | 정산 + 업적 6종 자동 지급 |
| `set_nickname(nickname)` | authenticated | 닉네임 설정 + 신입 관전러 지급 |
| `grant_monthly_rewards(month?)` | service_role만 | 월간 배치 정산 |
| `grant_season_rewards(start, end, label)` | service_role만 | 시즌 배치 정산 |

### 4-2. 신규 필요 (미구현 — 이번 문서에서 인터페이스만 확정, 구현은 후속 단계)

| RPC/쿼리 | 목적 | 비고 |
|---|---|---|
| `fetch_my_cosmetics()` 또는 직접 `select` | 내 보유 칭호/배경 목록 + 장착 상태 조회 | `owned_titles`/`owned_backgrounds`는 이미 RLS로 자기 행 select 가능 — **RPC 불필요, 클라에서 직접 `.from('owned_titles').select()` 하면 됨.** |
| `equip_title`/`equip_background` | 장착 변경 | **이미 존재하는 방식 재사용**: `prediction_stats.equipped_title/equipped_background`에 GRANT된 컬럼 직접 UPDATE(RLS+트리거가 보유 검증). 별도 RPC 불필요. |
| `grant_event_title(user_id, title_id)` | 운영 이벤트 지급 | (선택) 관리자 대시보드 SQL 실행으로 충분한지, 전용 RPC로 감사로그를 남길지 §7-3에서 결정 |
| `admin_grant_title` | 운영자 수동 지급 | 위와 동일 결정 필요 |

**중요:** 장착/보유조회는 새 RPC가 필요 없다 — 기존 RLS+컬럼 GRANT 패턴(스킨의 `applied_skin_id`와 동일)으로 충분하다. 이 문서 작성 전엔 이 사실이 명확히 정리돼 있지 않았다.

---

## 5. 권한 모델 (RLS/GRANT)

기존 패턴과 100% 동일 원칙 적용(변경 없음, 재확인용):

| 테이블 | select | insert/update/delete |
|---|---|---|
| `owned_titles` | 자기 행만(RLS) | 전체 차단 — service_role RPC(`grant_title`)만 |
| `owned_backgrounds` | 자기 행만(RLS) | 전체 차단 — `grant_background`/`purchase_background`만 |
| `backgrounds` | 전체 차단(클라 비노출, skins와 동일) | 전체 차단 |
| `prediction_stats.equipped_title/equipped_background` | 자기 행만 | **컬럼 단위 GRANT**로 authenticated 직접 update 허용(트리거가 보유 검증) |
| `grant_title`/`grant_background`/`grant_monthly_rewards`/`grant_season_rewards` | — | anon·authenticated 실행 불가(service_role만) |
| `purchase_background`/`set_nickname` | authenticated 실행 | anon 명시 회수(0005 하드닝 패턴과 동일) |

---

## 6. UI 요구사항 (미구현 — 화면별 결정)

### 6-1. 라커룸 배경의 시각적 적용 ⚠️ 결정 필요

현재 `LockerRoom.tsx`는 고정 `stadium-bg.webp`를 배경으로 쓴다. 옵션:
- **A안:** 라커룸 화면 자체의 배경 이미지를 `equipped_background`에 따라 교체.
- **B안:** 예측 리그 프로필 카드(닉네임 표시 영역)만 배경으로 감싸는 작은 프레임.
- **C안:** 공개 프로필이 생기기 전(이번 Stage 6 스코프)엔 "장착"이라는 상태만 저장해두고, 시각적 적용은 후속(공개 프로필/친구 방문 기능과 함께) — **지금은 라커룸 화면 배경 교체(A안)를 최소 구현으로 추천.**

→ **A안(라커룸 화면 배경 교체) 채택 여부 확인 요청.**

### 6-2. 화면별 요구사항

| 화면 | 요구사항 |
|---|---|
| `PredictionLeague.tsx`(기존) | "내 기록" 섹션에 **장착 칭호 표시** + "칭호 목록 보기" 진입점 추가. 리더보드 각 행에 1위 아이콘/칭호 뱃지(선택) |
| **신규:** 칭호 목록 화면 | 보유 칭호 전체 나열(고정 업적 + 월간/시즌 이력) + 장착/해제. 월간/시즌 칭호가 누적되므로 **최신순 정렬 + "더 보기" 접기** 권장 |
| **신규:** 라커룸 배경 구매/보유 화면 | `BaseballCenter`/`SkinSelect`와 유사한 그리드. 구매형 4종 + 명예 2종(보유 시에만 노출, 미보유 시 "월간 챔피언만 획득" 안내) |
| `LockerRoom.tsx`(기존) | "예측 리그" 섹션 아래 "라커룸 배경" 섹션 추가(진입점) |

---

## 7. 운영 절차

### 7-1. 월간 정산 — 완전 자동, 확인만 필요

- 매일 18:00 UTC 워크플로 실행 → 매달 1일(KST)에만 실제 동작.
- 확인 방법: `gh run list --workflow=prediction-rewards.yml` + 로그의 `[monthly-rewards] ... 정산 완료:` JSON 확인.
- **실패 시 재실행:** 멱등이라 `workflow_dispatch`로 season_start 없이 재실행하면 안전(중복 지급 안 됨).

### 7-2. 시즌 정산 — 수동, 트리거 필요

- KBO 정규시즌 종료 다음날, 사람이 직접 `gh workflow run prediction-rewards.yml -f season_start=... -f season_end=... -f season_label=...` 실행(또는 GitHub UI).
- **결정 필요:** 시즌 종료를 누가 어떻게 인지하고 트리거할지(캘린더 알림? 시즌 전 로드맵에 날짜 기입?).

### 7-3. event/admin 지급 — 도구 없음, 결정 필요

옵션:
- **A안(최소):** Supabase 대시보드 SQL 에디터에서 `select grant_title(...)` 직접 실행. 도구 개발 비용 0, 사유는 SQL 실행 이력에만 남음(약함).
- **B안:** `debug_grant`처럼 `admin_grant_title(user_id, title_id, reason)` RPC 추가 + 지급 사유를 남길 컬럼/로그 테이블 추가.

→ **이번 Stage 6 MVP는 A안(대시보드 수동)으로 충분한지, 아니면 처음부터 B안으로 갈지 결정 필요.** (2인 테스트 규모 감안 시 A안 권장.)

### 7-4. 모니터링

- 현재는 GitHub Actions 로그가 유일한 가시성. 실패 시 사람이 알아채는 방법이 없음(push-notify.mjs처럼 `continue-on-error`가 아니라 실패해도 워크플로 자체는 실패 표시되므로, GitHub Actions 실패 알림(이메일/Actions 탭)에 의존).

---

## 8. 정산 규칙 확정표 (구현 반영본, 재확인용)

### 8-1. 업적 칭호 (정산 시점, `settle_prediction` 내부)

| title_id | 조건 | 지급 시점 |
|---|---|---|
| `title.rookie_watcher` | 닉네임 최초 설정 | `set_nickname` |
| `title.first_prediction` | 유효 참여(void 아님) 1회 도달 | 정산 |
| `title.first_hit` | 누적 적중 1회 도달 | 정산 |
| `title.streak3` | 연속 적중 3 도달(해당 hit 순간) | 정산 |
| `title.streak5` | 연속 적중 5 도달 | 정산 |
| `title.honey_detective` | 누적 적중 10 도달 | 정산 |
| `title.veteran30` | 누적 유효 참여 30 도달 | 정산 |

### 8-2. 월간 보상 (`grant_monthly_rewards`, 매달 1일 03:00 KST)

| 대상 | 조건 | 지급물 |
|---|---|---|
| 포인트 랭킹 1위 | 이번달 `ranking_points` 합 최댓값 | `title.monthly_champion.<월>` + `lockerbg.monthly_champion` |
| 포인트 랭킹 TOP10 | 이번달 유효 참여자 **20명 이상일 때만** 자동 지급 | `title.monthly_top10.<월>` ×10 |
| 적중률 랭킹 1위 | 이번달 유효 참여 **5회 이상** 중 적중률 최댓값 | `title.monthly_detective.<월>` |

### 8-3. 시즌 보상 (`grant_season_rewards`, 수동 트리거)

| 대상 | 조건 | 지급물 |
|---|---|---|
| 포인트 랭킹 1위 | 시즌 전체 `ranking_points` 합 최댓값 | `title.season_champion.<라벨>` + `title.season_legend.<라벨>`(⚠️§1-2 재확인) + `lockerbg.season_trophy` |
| 포인트 랭킹 TOP10 | 시즌 유효 참여자 **50명 이상일 때만** | `title.season_top10.<라벨>` ×10 |
| 적중률 랭킹 1위 | 시즌 유효 참여 **30회 이상** 중 적중률 최댓값 | `title.season_detective.<라벨>` |

**⚠️ 재확인 요청:** "꿀잼 레전드"를 챔피언과 동일 인물에게 자동으로 얹어주는 현재 구현이 맞는지, 아니면 별도 심사/기준(예: 감별왕과 챔피언을 겸직해야만, 또는 운영자 별도 선정)을 원하는지.

---

## 9. 엣지케이스

| 케이스 | 현재 동작 | 결정/보완 필요 여부 |
|---|---|---|
| 월간 챔피언 동점자(포인트 완전 동일 2명 이상) | `order by ... limit 1`이라 그중 1명만(정렬 안정성 보장 안 됨) | **결정 필요** — 공동 수상 허용할지, tie-break 규칙(예: 적중 수 → 참여일수 순) 추가할지 |
| 시즌 중 탈퇴 | `on delete cascade`로 그 유저의 `owned_titles`/`owned_backgrounds`/`predictions` 전부 삭제 → 월간 챔피언 기록도 함께 사라짐 | **결정 필요** — 랭킹 "역사"를 유저 삭제와 무관하게 보존할지(별도 스냅샷 테이블) |
| 이번달 참여자 20명 미만(TOP10 미지급) | 챔피언·감별왕은 지급, TOP10만 스킵 | 확정 사양대로 구현됨. 재확인만 |
| 예측 자체의 공동 1위(`tiedGameIds`)와 랭킹 동점자는 별개 개념 | 예측 판정의 동률은 이미 처리됨(dailyHoney). 랭킹 집계 동률은 위 항목과 동일 이슈 | — |
| 닉네임 무제한 변경 | 현재 제한 없음(design doc은 "월 1회 제한" 후순위 언급) | **결정 필요** — MVP엔 미제한 유지 vs 지금 제한 걸지 |
| event/admin 칭호 실수 지급 | 회수(취소) RPC 없음 — 대시보드에서 `delete from owned_titles` 수동 | MVP는 수동 회수로 충분한지 확인 |
| 배경 구매 후 명예 배경을 나중에 "정식 획득" | `on conflict do nothing`이라 문제 없음(이미 있으면 무시) | 해당 없음(안전) |

---

## 10. 테스트 기준

### 10-1. 이미 커버됨

- `data-pipeline/test/monthly-rewards.test.mjs`: KST "1일 여부" 판별 + "지난달" 계산(연도 경계 포함) — 5개 통과.

### 10-2. 필요(미작성)

DB 트랜잭션 로직(`settle_prediction`의 업적 지급, `grant_monthly_rewards`/`grant_season_rewards`)은 SQL 함수라 이 저장소의 Node 테스트 러너로 직접 단위테스트할 수 없다 — 실제 검증은 **Supabase 대시보드에서 SQL 마이그레이션 적용 후 수동 시나리오 테스트**로 대체한다. 최소 시나리오 체크리스트:

- [ ] 첫 예측 제출 → `title.first_prediction` 지급 확인
- [ ] 첫 적중 → `title.first_hit` 지급, 3연속 적중 → `title.streak3` 지급 확인
- [ ] 동일 유저 같은 날 정산 RPC 2회 호출(멱등) → 칭호 중복 없음, 포인트 중복 지급 없음
- [ ] 이번달 참여자 20명 미만 상태에서 `grant_monthly_rewards` 실행 → 챔피언은 지급, TOP10은 스킵되는지
- [ ] `purchase_background`로 명예 배경(`lockerbg.monthly_champion`) 구매 시도 → `not_purchasable` 반환 확인
- [ ] 잔액 부족 상태에서 일반 배경 구매 시도 → `insufficient` 반환 확인
- [ ] 이미 보유한 배경/칭호 재지급 시도 → no-op(에러 없이 조용히 무시) 확인

---

## 11. 구현 체크리스트 (단계별 — 이 문서 확정 후 순서대로 착수)

1. **§9 엣지케이스 결정 확정**(동점자 처리, 탈퇴 시 기록 보존, 닉네임 변경 제한) — 코드 착수 전 필수
2. **§7-3 event/admin 지급 방식 결정**(A안 vs B안)
3. **§6-1 배경 시각 적용 방식 결정**(A/B/C안)
4. 클라 정적 카탈로그 작성: `lockerBackgroundConfig.ts`, `titleConfig.ts`(§3-3)
5. 화면 구현: 칭호 목록/장착, 라커룸 배경 구매/장착, `PredictionLeague`에 장착 칭호 노출
6. (선택, §6-1에서 A안 채택 시) 라커룸 배경 시각 적용 렌더링
7. 실제 이미지 에셋 제작([[dugoutpick-asset-skin-pipeline]] 파이프라인 재사용) — 6종
8. §10-2 수동 테스트 시나리오 실행(0006+0007 SQL을 Supabase에 적용한 뒤)
9. (선택) event/admin RPC 구현(B안 채택 시)

---

참고 문서: [prediction-league-design.md](prediction-league-design.md) · [phase3-account-design.md](phase3-account-design.md) · [roadmap.md](roadmap.md) · [adr.md](adr.md)
