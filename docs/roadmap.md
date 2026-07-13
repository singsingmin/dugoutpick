# 로드맵 — 오늘야구각 (DugoutPick)

> MVP(6 phase) 완료 + 라이브 데이터 파이프라인 안정화 + Android APK 산출 완료 이후의 백로그.
> 운영 방식: 야구 찐팬 1명 + 야구 초보팬 1명과 함께 사용하며 피드백 기반 개선.
> 최종 정리: 2026-07-07 (Phase 4 Stage 1-6·추천코드 완료 반영 + F섹션 "출시 준비" 신설 + E섹션 전면 정리: Phase 3 stage별 장문 나열→요약, Kakao/Apple 로그인 누락 항목 복원, 완료됐는데 미체크였던 "어제 명경기" 반영, "다음 큰 결정"/"지금 구현 안 함" 등 stale 문구 제거).

## A. ✨ 기능 다듬기 (사용 경험)
- [x] **아이콘 커스텀 SVG 교체** (2026-06-29) — 커스텀 SVG로 교체 완료.
- [x] **라이브 인앱 폴링** (2026-06-25) — LIVE 경기 존재 시 60초 자동 갱신(useFocusEffect + interval 병행). 배터리 영향 최소화 위해 LIVE 게임 없으면 폴링 중단.
- [x] **라인업 조회** (2026-06-25) — `Schedule.asmx/GetLineUpAnalysis` API로 선발 타순(1~9번·포지션·이름) fetch → games.json 포함. 경기 상세 선발투수 섹션 옆 버튼 → 바텀시트 표시. 발표 전 추정 타순도 "최근 기준 추정" 표시로 제공.
- [x] **라이브 카드 이닝 표시** (2026-07) — 5초/5말(KST) 표기. LiveCard 다이아몬드 위 + StatusChip 병기("경기중 5말").
- [x] **UI 다듬기** (2026-07) — 유니폼 목/소매 트림을 채운 밴드(시보리·커프)로 개선 + 라벨·버튼·배지 테두리 1px 다크 통일.
- [x] **라커룸 재구성** (2026-07) — 하단 탭 "설정"→"라커룸"(활동·꾸미기·보상 허브). 실제 앱 설정은 우상단 톱니로 별도 화면 분리.
- [x] **로컬 알림(경기 시작)** (2026-07) — 내 팀 경기 시작 30분 전 로컬 알림(expo-notifications). 앱 여는 날 그날 경기 예약(로컬+오늘데이터 한계: 앱을 그날 한 번 열어야 예약됨). 설정 on/off·재시작 유지. 경기 없는 날/취소는 미예약.
- [x] **서버 푸시 알림 V1** (2026-07-04 구현, 2026-07-07 실기기 라이브 검증 완료) — "한 번 켜두면 매일 자동"(앱 안 열어도 경기 있는 날마다). 로컬 스케줄링(앱 열어야 예약) 폐기 → 서버 푸시로 대체. 구조: 앱 `services/push.ts`가 Expo 토큰 등록(`push_tokens`, RPC `upsert_push_token`/`set_push_enabled`, 0004) → `data-pipeline/push-notify.mjs`가 update-data 워크플로에서 경기 20~40분 전 감지, 팀 팬 토큰 조회, Expo Push 발송(`push_log` 중복방지). **결정: 접전 실시간 알림은 안 함**(알림 피로 방지). FCM 연결(`google-services.json`, 2026-07-07) 후 실기기에서 경기 시작 33분 전(20~40분 윈도 내) 정상 수신 확인(문구도 템플릿과 일치 확인됨).
- [x] **heat: 역전 직후 가산** (2026-07) — display 층(`liveHeat.ts`)에서 부호 있는 점수차로 역전(leadChange)·동점 감지 → 이벤트 보너스(역전 10~22×점수차, 동점 +6) + ~2분 decay. 역전 라벨이 최상위 라벨보다 우선(force), 끝내기 역전은 종료 후 2분 유지. (ADR-021 ③b)
- [ ] **LLM 기반 텍스트 다양화** — 한 줄 예측·관전 포인트·월요 리포트 한줄평을 Claude Haiku/Sonnet으로 생성. 규칙 기반 템플릿의 반복 느낌 해소, 팀별 밈·말투 반영(`data-pipeline/team-context.json` 활용). 구현 조건: GitHub Actions secret에 `ANTHROPIC_API_KEY` 추가 필요. 파이프라인에서 gameId+date 키로 캐시해 2분 빌드마다 LLM 호출하지 않도록 설계. 비용 Haiku 기준 시즌 전체 ~$2.
- [ ] **포스트시즌 화면** — 설계 확정(2026-07-11), 구현 미착수. 상세 스펙 → **[postseason-plan.md](postseason-plan.md)** (6버킷: ①꿀잼지수 별도공식 base70 ②시리즈 현황 카드 ③예측 비활성 ④내 팀 4분기 ⑤브래킷 바텀시트 ⑥postseasonContext). 10~11월 기간 자동 감지 후 시리즈 컨텍스트 표시, `srId=3`(와카·준PO·PO)/`srId=7`(KS) 전환. **착수 선행: KBO API 스파이크로 `GAME_SC_NM`·`VS_GAME_CN`·시리즈스코어 검증**(추정 금지, ADR-003).

## B. 📊 데이터·정확도
- [ ] **꿀잼지수 공식 실경기 검증·튜닝** — recap(예측 vs 실제 적중률) 데이터 누적 → 가중치 보정.
  - [x] **누적 트랙레코드 구현** (2026-06-24) — `recap-history.json` append-only 누적 + 롤링 적중률 집계 + `games.json trackRecord` 임베드 + 앱 배지(Today 상단·Settings). 가중치 자동 보정은 표본 충분히 쌓인 후 별도 작업.
- [x] **ERA 커버리지 개선** (2026-06-02 완료) — 규정 미달 선발도 player ID 개별 조회로 ERA·승·패 표시(하이브리드). 시즌 기록 없는 투수만 '-'.
- [x] **라이브 UI 실디바이스 검증** (2026-07-03) — 실제 라이브 경기 중 실디바이스에서 화면 렌더 확인 완료.
- [ ] **꿀잼지수 가중치 튜닝** — 피드백 데이터 누적(👍👎 + 이유 태그) 후 진행.
  튜닝 개시 기준: 피드백 표본 30건 이상 누적 시. reasonTag 분포로 어느 요소 가중치가 실제 체감과 어긋나는지 판단.

## B-2. ⚡ 실시간 갱신 (Cloudflare Worker 하이브리드)
- [x] **games.json만 Worker로 이전** (2026-06-29) — 라이브 데이터 갱신 지연 4~5분 → 30초로 개선. 배포 완료(`dugoutpick-kbo-live.tkdals8401.workers.dev`).
  - AS-IS: `cron(2분) → GitHub Actions(2분) → 정적 JSON → 앱 폴링`
  - TO-BE: `앱 폴링(30초) → Cloudflare Worker → KBO API 직접 호출`
  - `standings.json`, `report.json` 등 실시간성 낮은 데이터는 기존 파이프라인 유지 (하이브리드)
  - 작업 절차:
    1. Cloudflare 계정 + Wrangler CLI 설정
    2. `build.mjs`의 KBO API 호출·파싱·꿀잼지수 계산 로직 → Worker(TypeScript) 이식
    3. Worker 내 30초 캐시 적용 (KBO API 과부하 방지)
    4. `app/data/config.ts`의 `REMOTE_BASE_URL` → Worker URL로 변경 (games.json만)
    5. games.json 생성 Actions 비활성화
  - 비용: 무료 플랜 100,000 req/일 → 현재 규모 충분, 수백 명 이상 시 $5/월
  - 예상 작업: 하루 분량 (Phase 1 Worker 구축이 핵심)
- [x] **Worker live 캐시 + stale 폴백** (2026-07) — Cloudflare Cache API로 KBO live fetch 캐시(엣지 colo별). fresh 15초(LIVE)/60초(그 외), 만료 시 재fetch, 실패 시 stale(최대 5분) 반환, 없으면 정적 폴백. `X-Live-Cache` 디버그 헤더. 앱 폴링도 전경기 종료·경기없는날 중단(ADR-018).

### 향후 스케일링 (유저 늘면 검토 — 지금은 과투자, 합본·on-demand 유지)
- [ ] **live.json 분리** — games.json 합본에서 라이브 상태만 별도 파일로(폴링 payload 축소). **검토 시점(하나라도 보이면):** games.json payload 커져 앱 로딩 느려짐 / 라이브 폴링 트래픽 눈에 띄게 증가 / 유저 수백 명↑ / 경기중 네트워크 사용량 부담. 그전까진 합본 유지.
- [ ] **Durable Object 능동 폴링(중앙 라이브 스냅샷)** — 트래픽·유저 수 무관 고정 폴링. **검토 시점:** colo별 캐시 편차가 실제 문제 / KBO 호출량을 더 강하게 통제 필요 / 동시 유저↑로 cache miss 순간 중복 fetch 부담 / 라이브 스냅샷을 중앙에서 딱 하나로 관리하고 싶어짐.
  - 목표 구조: `Cron Trigger → Durable Object가 15초마다 KBO fetch → 최신 live snapshot 저장 → 모든 앱 요청은 snapshot만 읽음`. = "유저 수와 무관한 중앙 라이브 스냅샷".

## C. 🔧 기술 부채 (마감 있음)
- [x] **워크플로 Node20 → v5** (2026-06-29) — `actions/checkout`·`actions/setup-node` v4 → v5 완료.
- [x] **에셋 WebP 전환** (2026-07) — 인앱 이미지 4종 PNG→WebP(7.4MB→~2MB, 배경=손실 q82/배지=무손실). 재사용 도구 `scripts/asset-to-webp.mjs`·`chroma-key.mjs`. 아이콘/스플래시는 Expo 요구로 PNG 유지.
- [ ] **PAT 만료 관리** — cron-job.org용 fine-grained PAT. 만료 시 cron 401로 멈춤(실패 알림으로 커버). 재발급 후 cron-job.org 헤더값 교체.
- [x] **Discord 웹훅 제거** (2026-07-04) — 피드백이 feedback 테이블에 쌓이므로 클라 웹훅(번들에 URL 박히는 부채) 제거. `sendToDiscord`·`discordWebhookUrl`·워크플로 env 삭제. 리뷰는 Supabase 대시보드/쿼리. 실시간 알림 필요 시 서버측(Supabase DB webhook)으로.
- [ ] **공개 전 디버그 툴 노출 제거** — 설정의 야구공 충전/초기화 버튼. `EXPO_PUBLIC_DEBUG_TOOLS` 플래그로 노출 중: eas.json `preview` env + `deploy-web.yml` export env. 공개(production app-bundle는 이미 미노출) 전 preview·web 플래그 제거. `__DEV__`만 남기면 됨.

## D. 🗓️ 비시즌 콘텐츠 (리서치 중)

> KBO 비시즌: 11월~3월 (약 4~5개월). 현재 앱은 이 기간 동안 "오늘 경기" 탭이 비어 앱을 열 이유가 없음.

- [ ] **비시즌 모드 화면** ← 우선 구현 후보
  - 개막일까지 카운트다운 + 지난 시즌 팀별 요약 카드(W/L, 꿀잼지수 평균, 최고 경기 TOP3)
  - 시즌 마지막 빌드에서 생성한 정적 JSON 재활용 → 추가 API 불필요
  - 앱 코드 분기(`isOffseason()`) + `offseason-summary.json` 파이프라인 추가로 구현 가능
  - 구현 비용 낮고 비시즌 내내 동작

- [ ] **스토브리그 트래커** ← 데이터 가용성 리서치 필요
  - FA 계약·트레이드·외국인 선수 교체·팀별 주요 변화를 피드 형식으로 표시
  - ⚠️ KBO 공식 API에 FA·트레이드 데이터 없음 → 뉴스 파싱 또는 수동 큐레이션 필요
  - ⚠️ 연봉 협상 금액은 비공개 多 → 구조화 데이터 없음
  - 선택지 A: 수동 `offseason-news.json` 편집 + 앱 피드 표시 (큐레이션 비용 발생)
  - 선택지 B: KBO API에서 잡히는 외국인 선수 등록/말소·1군 엔트리 변화만 자동화 (범위 축소)
  - → 비시즌 모드 기본 화면 먼저 운영해보고 사용자 반응 봐가며 결정

## E. 🎨 스킨 · 재화 · 계정 · 예측 리그 (장기 로드맵)

> 스킨 데이터모델(`scoreSkinConfig`)의 `unlockType`(free/currency/event/premium)·`price`·`unlockGroup` 활용.
> **핵심 게이트(정식 수익화)**: 서버·현금이 걸리는 순간 계정+서버가 선행되어야 함(재설치/기기변경 소실·치팅·스토어 정책).
> 단, **로컬 MVP는 UX 검증 목적으로 계정 없이 먼저 구현함**(아래 Phase 2). 로컬 저장이라 재설치 시 초기화되는 한계를 감수한 검증 단계.
> **야구공 재화의 서버/DB 이후 핵심 사용처 = "꿀잼 예측 리그"**(아래 Phase 4). 스킨은 소비처, 예측 리그는 참여·보상 루프의 중심. Phase 3(계정/DB)~Phase 4-부속(추천코드)까지 구현 완료. Supabase 마이그레이션(0006~0021)도 적용 완료(2026-07-09). 남은 것은 [F섹션](#f-🚀-출시-준비-android)의 출시 준비(디버그 툴 제거·테스터 확보·AAB 제출).
>
> **재화 무결성 원칙(전 Phase 공통, 절대 불변):** 야구공으로 ①꿀잼지수 계산, ②경기 판정 결과, ③랭킹 포인트를 유리하게 만들 수 없다. 야구공은 참여·꾸미기·보상·시즌 진행도 전용. 판정·꿀잼지수·라이브 정보는 항상 무료·서버 기준.

### Phase 1 — 스킨 다양화 ✅ 완료
- [x] `uniformPreset` → 데이터모델 확장형 전환(styleId×paletteId / asset kind)
- [x] 유니폼 팩: 컬러(8) · 화이트(8) · 줄무늬(8) + 목/소매 밴드 트림 (2026-07)
- [x] 에셋 렌더러(`imageFrame`) + 전광판 · 레트로 티켓 · 홈플레이트 · 스페셜 메달 (2026-07)
- [x] 스킨 선택 화면(섹션 자동생성 그리드 + 현재적용 바 + 탭 즉시적용) (2026-07)
- [ ] (선택) 글러브·헬멧 등 추가 오브젝트 스킨 — 인프라 완성돼 저비용 확장

### Phase 2 — 로컬 재화·구매·출석 MVP ✅ 완료 (2026-07, 계정 前 UX 검증)
- [x] `unlockType` free/currency + `price`: 컬러10·화이트15·줄무늬20·전광판/티켓/홈플레이트30·메달60 (기본 유니폼만 free)
- [x] 야구공 재화(로컬 AsyncStorage) — 첫 실행 15 지급(1회), 보유 판정=free∥구매∥적용중
- [x] 출석 보상(KST) — 하루 1회 +5, 7일 연속 +20 보너스, 놓치면 streak 리셋
- [x] 스킨 구매 — 잔액 검증·차감·보유추가, 구매/완료/부족 모달, 구매 후 즉시 적용
- [x] 야구공 센터 화면 — 잔액·오늘 출석·연속출석 칩·7일 보드·거래내역(바텀시트 최근 30일)
- [x] 라커룸 진입 + 디버그(충전/초기화, `EXPO_PUBLIC_DEBUG_TOOLS` 게이트)
- ⚠️ **한계**: 로컬 저장이라 재설치/기기변경 시 잔액·보유 소실. 정식 수익화(현금/서버) 전 Phase 3(계정)로 이관 필수. 광고 보상 구조 슬롯만 열어둠(미구현).

### Phase 3 — 계정 시스템 + 관리형 DB 도입 ✅ 완료 (2026-07-04, 백엔드=Supabase)
> 📐 설계: [ADR-023](adr.md) · [phase3-account-design.md](phase3-account-design.md) — 익명 UID 우선 opt-in 인증·충돌=서버우선 전면교체·재화 서버 스키마(profiles/baseball_ledger/owned_skins/attendance_claims/skins/feedback)·무결성=RPC 전용+컬럼 GRANT.
> **착수 결정:** 기존 게이트("로컬 재화 루프 재미 신호 후")를 폐기하고 **출시 전 기반 다지기**로 즉시 착수(로컬 출시 후 유저 마이그레이션 지옥 회피).
- [x] Stage 0(스파이크) — 익명→`linkIdentity`(Google)→uid 보존 + `is_anonymous=false` 실기기 검증. OAuth 왕복 리스크 해소.
- [x] Stage 1(DB) — `0001_phase3_stage1.sql`: 스키마 6종+트리거+RPC(`claim_attendance`·`purchase_skin`)+RLS+skins 시드.
- [x] Stage 2(Auth) — `context/Auth.tsx` 첫 실행 익명 sign-in + AsyncStorage 세션(첫 실행만 온라인 필요).
- [x] Stage 3(재화·team·feedback 서버 이관) — 로컬→Supabase+캐시 미러 스왑(`services/account.ts`), 민감 쓰기(구매·출석·피드백)만 오프라인 게이팅.
- [x] Stage 4(계정 보호/복구) — `linkIdentity`(Google)로 익명→보호 전환, `AccountProtect.tsx`, 딥링크(네이티브+웹), `ProtectNudge.tsx`(첫 구매/7일 연속 출석 시 노출, 닫기 가능).
- [ ] **Kakao 로그인 추가** — 설계상 Android 목표(Google+Kakao)였으나 Google만 구현됨.
- [ ] **iOS Apple 로그인** — iOS 출시 시 스토어 정책상 필수(현재 미구현, Android 우선 진행 중이라 후행).
- 🛠️ 디버그 툴(`debug_reset`/`debug_grant`, `0002_debug_tools.sql`) — 출시 전 비활성화 필요(→ [F섹션](#f-🚀-출시-준비-android)에서 추적).

### Phase 3-Pre — 실제 꿀잼 경기 판정 파이프라인 (예측 리그 선행 과제) ✅ 구현 (2026-07-05)
> 예측 리그 MVP의 심장. **계정/DB와 독립적**. 구현 = `data-pipeline/dailyHoney.mjs`(순수 로직·테스트 10개) + build.mjs 통합 → `dailyHoney-history.json` 산출.
- [x] 경기 종료 후 그날 **실제 꿀잼 1위 경기(`actualTopGameId`)** 산출 — recapScore(recap.actual) 최고. 모든 경기 종료 시 확정(그전 잠정), append-only freeze.
- [x] tie-breaker: A. recapScore → (**B. live.heat peak = MVP 미채택**, recapScore가 이미 종합 반영) → C. 끝내기>연장>접전>난타 미세 tiebreak → D. 완전 동률이면 `tiedGameIds` 공동 적중.
- [x] 산출물 `DailyHoneyResult { date, actualTopGameId, tiedGameIds?, recapScore, decidingReasonTags[], calculatedAt }` → `dailyHoney-history.json`(날짜별 append).
- [x] recap에 diff/total/extra/walkoff 추가(판정·이유 태그용). cf-worker는 recap 미계산 → 동기화 불필요.
- ⚠️ 판정은 **서버/파이프라인이 실제 경기 데이터 기준**. 클라·야구공 개입 불가. 설계 [prediction-league-design.md](prediction-league-design.md).
- [x] **앱에 "어제 실제 명경기 + 이유" 노출** (2026-07) — `Today.tsx`의 `YesterdayHoneyCard`, 라이브·미완료 경기 없을 때만 노출.

### Phase 4 — 꿀잼 예측 리그 MVP ✅ Stage 1-6 구현 완료 (2026-07-07 구현, 2026-07-09 DB 마이그레이션 적용 완료)
> 📐 설계: [prediction-league-design.md](prediction-league-design.md) · [stage6-cosmetics-design.md](stage6-cosmetics-design.md)(칭호·배경, 3차 리비전 전 항목 결정 완료).
> **착수 결정 번복(2026-07-07):** 원래 "2026 데이터 수집 후 2027 초 출시"로 미뤄뒀었으나, "찐팬+초보팬 2명으로만 테스트하고 출시 전 테스트 데이터를 전부 삭제할 것이므로 표본 부족 걱정 없이 보상을 처음부터 지급해도 무방하다"는 논리로 즉시 착수로 전환. 이 논리는 향후 비슷한 "데이터 쌓고 시작" 게이트 논의의 참고 선례로 남겨둠.
> **용어 규칙:** ❌ 베팅·배당·판돈 → ✅ **예측 참여 · 적중 보상 · 참가 야구공 · 보상 등급 · 랭킹 포인트**.
- [x] **Stage 1(DB 스키마)** — `supabase/migrations/0006_prediction_league.sql`: predictions/prediction_stats/prediction_windows/owned_titles/owned_backgrounds + RLS + submit_prediction·set_nickname(클라 RPC) + settle_prediction·upsert_prediction_window(service_role 전용) + 월간 랭킹 RPC 2종.
- [x] **Stage 2(정산 파이프라인)** — `data-pipeline/predictions-sync.mjs`: 매 빌드 예측 마감시각 upsert + dailyHoney 확정 시 hit/miss/void 정산. 순수 로직 테스트 14개. `update-data.yml`에 스텝 통합.
- [x] **Stage 3-4(제출/결과 UI)** — `app/components/PredictionCard.tsx` + `app/services/predictions.ts`: Today 탭 최상단 카드, 미제출→pending→hit/miss/void 4상태 + 첫 참여 닉네임 플로우 + 정산 후 "오늘의 실제 명경기+이유" 노출.
- [x] **Stage 5(랭킹 화면)** — `app/screens/PredictionLeague.tsx`: 내 기록 + 월간 포인트/적중률 랭킹, 리더보드는 `is_me` 서버 계산 boolean으로 user_id 비노출.
- [x] **Stage 6(칭호·라커룸 배경 꾸미기)** — `0007_prediction_cosmetics.sql` + `0008_prediction_cosmetics_v2.sql`: 랭킹 동점자=RANK() 기반 공동수상, 탈퇴 시 명예기록=`award_history`(+`award_history_public` 뷰로 익명 보존), event/admin 지급=전용 RPC 4종+감사로그(`cosmetic_admin_events`), 닉네임=월1회 제한·중복허용·2~10자. 클라: `TitleList`/`BackgroundShop`/`HallOfFame` 화면, 라커룸 배경 실제 렌더링. 라커룸 배경 아트 12종 완료(기본 6종 + 구매형 6종, `0009_locker_backgrounds_pack2.sql`).
- **Stage 7(마감 30분 전 리마인드 푸시)은 사용자 요청으로 스코프 제외.**
- [x] **DB 마이그레이션 적용 완료** (2026-07-09) — `0006`~`0021` 대시보드 SQL 실행 완료. 남은 것: 실기기 검증(동점자 공동수상, 닉네임 월1회 제한, admin RPC, 탈퇴 익명화 등)은 [stage6-cosmetics-design.md §10-2](stage6-cosmetics-design.md) 시나리오 참고.
- **무결성 원칙(재확인):** 야구공으로 랭킹 포인트 직접 구매 불가 / 예측 결과 변경 불가 / 공식 꿀잼지수 계산 개입 불가.
- ❌ 제외: 야구공 베팅 · 배당률 · 현금성 보상 · 유저 간 거래 · 랜덤박스 · 유료 시즌 패스 · 친구 랭킹 · 크라우드 꿀잼지수 노출.

### Phase 4-부속 — 추천코드 시스템 ✅ 구현 완료 (2026-07-07 구현, 2026-07-09 DB 마이그레이션 적용 완료)
> Phase 3 DB 도입 사유 목록에 있던 항목을 실제 설계·구현까지 진행 — "출시 전 충분한 테스트·개선 시간 확보" 목적.
- [x] 코드 **발급**(내 코드를 남에게 줄 자격) = 소셜 연동(보호된 계정)만. `is_anonymous: true→false` 전환 트리거가 자동 발급.
- [x] 코드 **입력**(피추천인) = **피추천인도 소셜 연동 필수**(최초엔 "익명도 가능"으로 설계했다가 사용자가 명시적으로 뒤집음), 평생 1회, 즉시 +10 야구공.
- [x] 추천인 보상: 피추천인 첫 예측 참여 시 +10, 하루 2명/월 10명 캡(초과는 기록만).
- [x] 금지: 자기추천, 동일 소셜계정 재사용(Supabase가 자체 차단). 동일 기기 반복 추천은 기술적 완전 차단 불가 — `admin_cancel_referral_reward`로 사후 취소.
- 구현: `supabase/migrations/0010_referral_codes.sql`, `app/services/referrals.ts`, `app/screens/Settings.tsx`("추천코드" 섹션). 마이그레이션 적용 완료(2026-07-09).

### Phase 5 — 랭킹 / 팬덤 대항전 / 시즌 패스 (예측 리그 후속 확장)
- [~] **개인 주간 랭킹** (2026-07-13 v1 구현 — DB 적용·APK 재빌드 대기) — KST 주(월~일) 윈도우. 보드 3종: 이번 주 예측왕(포인트)·주간 적중률(최소참여 3)·내 응원팀 팬 랭킹. 월간(0015) 로직 재사용, 마이그 `0024_weekly_leaderboard.sql`(`get_weekly_*` 3종+`kst_week_start`), `PredictionLeague` 주간/월간 토글, `FullLeaderboard` period 지원. **보상=명예만**(7/9 경제결정), **v1=뷰 전용**(정산/칭호 없음). 후속: 주간 우승 칭호(주 정산 cron)·연속적중 보드.
- [ ] **팬덤 대항전** — 개인 예측 적중이 응원팀 점수에도 기여. 인기팀이 유저 수로 압도하지 않게 보정(팀별 평균/참여율 보정/상위 N명 평균/최소 참여자 기준). 보상: 주간 팀 1위 배지 · 기여자 소량 야구공 · 시즌 우승 한정 라커룸/스킨.
- [ ] **시즌 패스** — 예측·출석·피드백·라이브 확인·스킨을 하나의 시즌 진행도로. 미션 예: 예측 10회 / 적중 3회 / 내 팀 확인 7회 / 피드백 5회 / 출석 14일 / live.heat 80+ 확인 3회. 보상: 야구공·한정 스킨·라커룸 배경·시즌 배지·칭호. ⚠️ **무료 시즌 미션부터 시작**(처음부터 유료 시즌 패스로 가지 않음).
- [ ] **크라우드 꿀잼 예측**(장기) — 유저 예측을 모아 "팬들이 고른 오늘의 꿀잼 경기"를 공식 꿀잼지수와 비교 노출. ⚠️ 표본 적을 때 의미 약함 → 예측 리그 데이터 쌓인 뒤 노출, 부족 시 "참여자 수 부족" 표시. 장기적으로 꿀잼지수 공식 개선 데이터로 활용.

### Phase 6 — 광고 보상 / IAP (서버 재화 검증 이후)
- [ ] **서버 재화 검증** — 잔액·소비를 서버가 계산(클라 신뢰 금지, 치팅 방지). 광고/결제·예측 보상 지급의 전제.
- [ ] 보상형 광고(AdMob) → 야구공 지급 + 동의(GDPR/ATT). `unlockType=premium/event` 스킨 해제 경로.
- [ ] **실제 결제(IAP)** — 야구공 충전을 스토어 IAP로(디지털재화 외부결제 불가 — Google Play Billing/Apple IAP, 수수료 15~30%). 영수증 검증(서버) + 구매 복원 + 스토어 정책 심사·환불.

### 현실 조언 (기능은 비용)
- Phase 1~4(스킨·로컬 MVP·계정/DB·예측 리그) + Phase 4-부속(추천코드)까지 **구현 완료**. Supabase 마이그레이션(0006~0021)도 **적용 완료**(2026-07-09). 남은 건 [F섹션](#f-🚀-출시-준비-android) 출시 준비 작업(코드 아닌 운영·심사 과제 위주).
- 다음 순서: **F섹션(출시 준비) 완료 → 실기기/실계정 검증 → 안드로이드 출시** → 그 이후 Phase 5(랭킹·팬덤·시즌 패스) → Phase 6(광고·결제). 정식 재화/결제는 서버 재화 검증(Phase 6) 전까지 진행 금지.

## F. 🚀 출시 준비 (Android)

- [x] **Supabase 마이그레이션 0006~0021 전부 적용 완료** (2026-07-09) — Phase 4/추천코드/보상 시스템(§G)/한정 판매 윈도우 마이그레이션을 대시보드 SQL 에디터에서 순서대로 실행 완료(`0006`~`0021`). 서버측 마이그레이션 블로커 해소.
- [x] **예측 리그 통합 감사** (2026-07-07) — `docs/audit-prediction-league-2026-07.md`. P0 없음. P1 2건(정산 소급 catch-up·월간정산 복구경로) + P2 6건 + 문서 3건 수정 완료. 운영 절차는 `docs/ops-runbook.md`, 추천코드 정책은 `docs/referral-code-policy.md`.
- [x] **출시 전 테스트 데이터 초기화 스크립트 작성** (2026-07-07) — `supabase/prelaunch-reset-test-data.sql`. 예측 기록·랭킹 통계·추천코드 사용기록·칭호/배경 보유·명예기록·야구공 원장을 초기화(잔액은 최초 지급액 15로 리셋). 계정 자체·스킨 보유·출석 이력은 건드리지 않음(테스터 재작업 방지). **실행 시점: 비공개 테스트 종료 후 ~ 프로덕션 공개 직전, 실유저가 아직 없을 때.** 실행은 사용자가 대시보드에서 직접.
- [ ] **공개 전 디버그 툴 제거** — [C섹션](#c-🔧-기술-부채-마감-있음) 항목과 동일 건, 출시 체크리스트로 재확인. `EXPO_PUBLIC_DEBUG_TOOLS` preview/web 플래그 제거 + `app_config.debug_enabled=false`.
- [ ] **Google Play 비공개 테스트 — 테스터 확보** — 랜덤 배정 아님, 개발자가 직접 모집(이메일 리스트 또는 Google 그룹 또는 옵트인 링크). 신규 개발자 계정 기준 최소 인원(기억상 20명) × 최소 기간(14일) 유지 필요 추정 — **정확한 최신 수치는 Play Console 가입 시점에 직접 확인**(정책 변동 가능). 현재 2명(찐팬+초보팬) 테스트 규모보다 크게 늘려야 함.
- [ ] **EAS production 빌드(AAB) + Play Console 제출** — `eas submit`은 아직 서비스 계정 미설정 상태(`app/eas.json`의 `submit.production`이 빈 블록). 최초 제출은 수동 업로드 또는 서비스 계정 설정 후 진행.

## G. 🏆 보상 시스템 확장 (P1~P4)

> 2026-07-09 논의로 **설계 전면 확정**. 의존성상 P1(통합 인박스)이 나머지의 기반 → **P1 우선**, P2~P4는 P1 완료 후 순차 착수. 상세 결정 근거는 대화/메모리 참조.
>
> **불변 원칙**: 야구공=꾸미기 전용 재화(스킨·라커룸 배경·이벤트 배경 80~200). 칭호·예측권·힌트·랭킹 포인트·보상 배율은 야구공으로 구매 불가. 랭킹 보상은 명예(칭호·명예 배경·명예의 전당)만, 야구공 미지급.

- [x] **P1 — 통합 보상 인박스 + 월간 밀스톤** (2026-07-09 구현, 마이그레이션 `0016`)
  - `reward_events` 통합 인박스 테이블(type: monthly_milestone·prediction_hit·referral·title_earned·background_earned·monthly_rank·season_rank·event·admin, + seen 플래그). 초기 토스트/모달, 이후 '보상함' 화면으로 확장.
  - `monthly_milestone_claims`(unique `(user_id, period_month, milestone_key)`로 멱등).
  - `settle_prediction`에서 **prediction.date 기준 period_month로 monthlyStats 1회 집계** → 밀스톤 평가(P2 룰 평가와 공유).
  - 월간 밀스톤(정산 시점 즉시 지급): 유효예측 5회 **+10** / 유효예측 10회 **+20** / 적중 5회 **+20** (월 최대 +50). `baseball_ledger` reason=`monthly_milestone_reward` + `reward_events` 발행.
  - 클라: 앱 진입 시 미확인 이벤트 fetch → 토스트/모달 → seen 처리. 중복 정산 시 보상 중복 지급 없음.
- [x] **P2 — 데이터주도 업적 룰 엔진 + 칭호 등급** (2026-07-09 구현, 마이그레이션 `0017`)
  - `title_achievement_rules`(condition_type enum: first_prediction·first_hit·valid_predictions_count·hits_count·current_streak·special_tag_hit_count …) 도입. `settle_prediction` 하드코딩 if 제거·이관.
  - 획득조건 SoT=`title_achievement_rules`, 표시(색·뱃지·rarity·정렬)·동적 월간/시즌 칭호 SoT=`titleConfig`. 등급 일반/희귀/영웅/전설(표시·수집가치용, 결과·랭킹 영향 0). title_earned는 P1 인박스 재사용.
- [x] **P3 — predictions 스냅샷/result_tags + 경기성향형 칭호** (2026-07-09 구현, 마이그레이션 `0018`)
  - `predictions.selected_game_snapshot`(제출 시점, 클라 제공 — 칭호=장식이라 신뢰 허용: honey_score_at_pick·honey_tier_at_pick·teams·start_time·storyline_tags).
  - `predictions.result_tags`(정산 시점 파이프라인 계산: walkoff·extra·close_1·close_2·slugfest·classic_game·daily_top). prediction_result(pending/hit/miss/void)와 분리.
  - special_tag_hit_count 조건 칭호(P2 엔진 위에 얹음).
- [x] **P4 — 칭호 카탈로그 20개 확장** (2026-07-09 구현, 마이그레이션 `0019`)
  - 영구 업적 칭호 20종(기본/참여형/적중형/연속형/경기성향형) 룰 데이터. 엔진은 P2 것 그대로(함수 변경 없음).
- [ ] **P4-운영 — 야구공 장기 sink 공급** (상시 운영)
  - 케이던스 권장: **KBO 시즌 이벤트(개막·올스타·가을야구·스토브리그 등) 연동 번들 드롭 2~3회/시즌**(엄격한 매월은 상한 목표). 구성: 상시 40~60 + 한정 80~200 혼합, 명예형은 랭킹 보상 유지.
  - [x] **한정 판매 윈도우 인프라** (2026-07-09, 마이그레이션 `0020`) — `backgrounds.available_from/until` + `purchase_background` 게이트(기간 밖 `not_available`). 한정 오픈/마감을 **SQL만으로** 제어(코드 배포 불필요). 클라는 `not_available` 응답 토스트 처리.
  - 남은 것: **아트 에셋 제작**(8비트 톤 일관성) + 새 배경/스킨 시드. 한정 상품의 클라 뱃지·기간 표시는 첫 드롭 때 콘텐츠와 함께.
  - 연간 한정 상품 라인업(16종)·추가 절차·윈도우 SQL: **[limited-cosmetics-plan.md](limited-cosmetics-plan.md)**.

---
참고 문서: [prd.md](prd.md) · [adr.md](adr.md) · [flow.md](flow.md) · [data-schema.md](data-schema.md)
