# docs-diff: feedback-widget

Baseline: `b81530b`

## `docs/roadmap.md`

```diff
diff --git a/docs/roadmap.md b/docs/roadmap.md
index 8054fe5..b1d1bbd 100644
--- a/docs/roadmap.md
+++ b/docs/roadmap.md
@@ -15,10 +15,13 @@
   - [x] **누적 트랙레코드 구현** (2026-06-24) — `recap-history.json` append-only 누적 + 롤링 적중률 집계 + `games.json trackRecord` 임베드 + 앱 배지(Today 상단·Settings). 가중치 자동 보정은 표본 충분히 쌓인 후 별도 작업.
 - [x] **ERA 커버리지 개선** (2026-06-02 완료) — 규정 미달 선발도 player ID 개별 조회로 ERA·승·패 표시(하이브리드). 시즌 기록 없는 투수만 '-'.
 - [ ] **라이브 UI 실디바이스 검증** — 데이터는 검증됨. 실제 라이브 중 화면 렌더는 미검증.
+- [ ] **꿀잼지수 가중치 튜닝** — 피드백 데이터 누적(👍👎 + 이유 태그) 후 진행.
+  튜닝 개시 기준: 피드백 표본 30건 이상 누적 시. reasonTag 분포로 어느 요소 가중치가 실제 체감과 어긋나는지 판단.
 
 ## C. 🔧 기술 부채 (마감 있음)
 - [ ] **워크플로 Node20 → v5** — `actions/checkout`·`actions/setup-node` v4 → v5. **2026-09-16 전까지**(Node20 deprecation).
 - [ ] **PAT 만료 관리** — cron-job.org용 fine-grained PAT. 만료 시 cron 401로 멈춤(실패 알림으로 커버). 재발급 후 cron-job.org 헤더값 교체.
+- [ ] **Play Store 공개 전 Discord 웹훅 재검토** — 현재 APK 번들에 웹훅 URL 포함(2명 내부 테스터용). 공개 배포 전 서버 프록시 또는 웹훅 전용 채널 교체 필요.
 
 ---
 참고 문서: [prd.md](prd.md) · [adr.md](adr.md) · [flow.md](flow.md) · [data-schema.md](data-schema.md)
```

## `docs/spec.md`

```diff
diff --git a/docs/spec.md b/docs/spec.md
index aecb10e..d33ecf0 100644
--- a/docs/spec.md
+++ b/docs/spec.md
@@ -37,19 +37,30 @@ native-stack + bottom-tabs 조합. 화면명은 `app/navigation/` 및 `app/scree
 
 타입은 `app/types.ts` 에 명문화(data-schema 미러). 스키마 변경 시 `types.ts` 와 data-schema.md 를 함께 갱신한다.
 
-## 4. 데이터 로딩 계약 (`app/data/`)
+## 4. 피드백 시스템 (경기 후 사용자 평가)
+- 경기 상세 화면(`GameDetail`)에서 `game.status === 'FINAL' && game.honjam != null` 조건일 때만 FeedbackWidget 노출
+- 사용자가 👍/👎 선택 후 이유 태그(slug 기반)를 선택하면 AsyncStorage에 저장 + Discord 웹훅으로 전송
+- AsyncStorage 키: `dugout.feedback.{gameId}` (게임별 개별 키)
+- 피드백 데이터 구조:
+  ```
+  { gameId, predictedScore, thumbs: 'up'|'down', reasonTag: string|null, reasonLabel: string|null, ts: ISO8601 }
+  ```
+- Discord 전송 실패는 무음 처리 (앱 크래시 없음)
+- 웹훅 URL: `app.config.js`의 `extra.discordWebhookUrl` 환경변수로 주입 (`.env.local` → `DISCORD_WEBHOOK_URL`)
+
+## 5. 데이터 로딩 계약 (`app/data/`)
 - **dev/MVP**: `assets/data/*.json` 번들 import.
 - **prod**: `data/config.ts` 의 `REMOTE_BASE_URL` 원격 fetch → 성공 시 AsyncStorage 캐시, 실패 시 마지막 캐시 폴백.
 - 환경 분기는 `data/config.ts` **한 곳**에만 격리.
 
-## 5. 파이프라인 계약 (`data-pipeline/build.mjs`)
+## 6. 파이프라인 계약 (`data-pipeline/build.mjs`)
 - 입력: KBO 3개 HTTP 엔드포인트(브라우저 불필요). 처리: 순위→지표맵 / 경기+선발 / 투수ERA맵 → `computeHonjam()`.
 - 꿀잼지수 로직은 이 파일에 **응집**(앱과 공유 안 함). 공식 튜닝 시 앱 재배포 불필요.
 - **실패 시 exit 1** → Actions 가 커밋 안 함 → 앱은 직전 JSON 유지.
 - teams 단일 출처 = `data-pipeline/teams.mjs` → `teams.json`.
 - **트랙레코드 누적:** FINAL 경기 중 `honjam.frozen===true`(경기 전 freeze된 예측)인 것만 `recap-history.json`에 append-only 누적. 롤링 집계(최근 window=50건)를 `games.json`의 `trackRecord`에 임베드해 앱에 전달(별도 네트워크 요청 0 증가).
 
-## 6. 불변 규칙 (구현 시 깨지 말 것)
+## 7. 불변 규칙 (구현 시 깨지 말 것)
 1. 꿀잼지수는 파이프라인 단일 출처. 앱·문서 어디서도 재구현 금지.
 2. 앱은 데이터 표시 전용. 네트워크 실패가 크래시로 이어지면 안 됨(캐시 폴백 필수).
 3. 외부 의존 최소화: 파이프라인 0개, 앱도 무거운 라이브러리 지양.
```

## `docs/user-intervention.md`

```diff
diff --git a/docs/user-intervention.md b/docs/user-intervention.md
index 79eedd8..c315d40 100644
--- a/docs/user-intervention.md
+++ b/docs/user-intervention.md
@@ -24,6 +24,19 @@
 
 ## 항목
 
+### 2026-06-24 피드백 웹훅 — Discord 웹훅 URL 생성 + .env.local 설정
+- 상황: Discord 웹훅 URL은 CLI로 생성 불가(Discord 웹 UI 필요). `.env.local`에 수동 입력 필요.
+- 필요한 수동 조치:
+  1. Discord에서 비공개 채널 생성 (예: #dugoutpick-feedback)
+  2. 채널 설정 → 연동 → 웹훅 → 새 웹훅 생성 → URL 복사
+  3. 프로젝트 루트에 `.env.local` 파일 생성:
+     ```
+     DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
+     ```
+  4. `.env.local`이 `.gitignore`에 포함되어 있는지 확인 (Phase 1에서 자동 추가됨)
+  5. 이후 EAS 빌드 시 환경변수 주입 필요 (eas.json 또는 빌드 시 --env 플래그)
+- 차단 여부: blocking — 이 설정 없이는 피드백 전송 기능이 동작하지 않음 (저장은 되나 Discord 전송 안 됨).
+
 ### 2026-06-24 누적 적중률 트랙레코드 — APK 재빌드 + 파이프라인 push 필요
 - 상황: 앱 코드(types.ts·배지 컴포넌트·Today/Settings 화면) 변경이라 APK 재빌드 필요. `build.mjs`·`recap.mjs` 등 파이프라인 코드 변경은 `origin/main` push 해야 Actions가 라이브 반영(로컬 커밋만으로는 안 바뀜). 적중률 표본은 운영 며칠(하루 5경기 기준 최소 2일, sampleSize >= 10) 누적돼야 배지가 '집계 중' → 실수치로 전환되며, 이는 운영시간 의존이지 인간 개입 아님.
 - 필요한 수동 조치:
```
