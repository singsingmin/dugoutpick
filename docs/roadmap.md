# 로드맵 — 오늘야구각 (DugoutPick)

> MVP(6 phase) 완료 + 라이브 데이터 파이프라인 안정화 + Android APK 산출 완료 이후의 백로그.
> 운영 방식: 야구 찐팬 1명 + 야구 초보팬 1명과 함께 사용하며 피드백 기반 개선.
> 최종 정리: 2026-07-03 (E 섹션에 "꿀잼 예측 리그" 트랙 편입 — Phase 3-Pre 판정 파이프라인 + Phase 4 예측 리그 MVP + Phase 5 랭킹/팬덤/시즌 패스, 광고·IAP는 Phase 6으로 재배치).

## A. ✨ 기능 다듬기 (사용 경험)
- [x] **아이콘 커스텀 SVG 교체** (2026-06-29) — 커스텀 SVG로 교체 완료.
- [x] **라이브 인앱 폴링** (2026-06-25) — LIVE 경기 존재 시 60초 자동 갱신(useFocusEffect + interval 병행). 배터리 영향 최소화 위해 LIVE 게임 없으면 폴링 중단.
- [x] **라인업 조회** (2026-06-25) — `Schedule.asmx/GetLineUpAnalysis` API로 선발 타순(1~9번·포지션·이름) fetch → games.json 포함. 경기 상세 선발투수 섹션 옆 버튼 → 바텀시트 표시. 발표 전 추정 타순도 "최근 기준 추정" 표시로 제공.
- [x] **라이브 카드 이닝 표시** (2026-07) — 5초/5말(KST) 표기. LiveCard 다이아몬드 위 + StatusChip 병기("경기중 5말").
- [x] **UI 다듬기** (2026-07) — 유니폼 목/소매 트림을 채운 밴드(시보리·커프)로 개선 + 라벨·버튼·배지 테두리 1px 다크 통일.
- [x] **라커룸 재구성** (2026-07) — 하단 탭 "설정"→"라커룸"(활동·꾸미기·보상 허브). 실제 앱 설정은 우상단 톱니로 별도 화면 분리.
- [x] **로컬 알림(경기 시작)** (2026-07) — 내 팀 경기 시작 30분 전 로컬 알림(expo-notifications). 앱 여는 날 그날 경기 예약(로컬+오늘데이터 한계: 앱을 그날 한 번 열어야 예약됨). 설정 on/off·재시작 유지. 경기 없는 날/취소는 미예약.
- [~] **서버 푸시 알림 V1** (2026-07-04 구현, 라이브 검증 대기) — "한 번 켜두면 매일 자동"(앱 안 열어도 경기 있는 날마다). 로컬 스케줄링(앱 열어야 예약) 폐기 → 서버 푸시로 대체. 구조: 앱 `services/push.ts`가 Expo 토큰 등록(`push_tokens`, RPC `upsert_push_token`/`set_push_enabled`, 0004) → `data-pipeline/push-notify.mjs`가 update-data 워크플로에서 경기 20~40분 전 감지, 팀 팬 토큰 조회, Expo Push 발송(`push_log` 중복방지). **결정: 접전 실시간 알림은 안 함**(알림 피로 방지). ⚠️ 필요: `SUPABASE_SERVICE_ROLE_KEY` 시크릿 + 0004 마이그레이션 + 토큰 테스트는 실기기 APK.
- [x] **heat: 역전 직후 가산** (2026-07) — display 층(`liveHeat.ts`)에서 부호 있는 점수차로 역전(leadChange)·동점 감지 → 이벤트 보너스(역전 10~22×점수차, 동점 +6) + ~2분 decay. 역전 라벨이 최상위 라벨보다 우선(force), 끝내기 역전은 종료 후 2분 유지. (ADR-021 ③b)
- [ ] **LLM 기반 텍스트 다양화** — 한 줄 예측·관전 포인트·월요 리포트 한줄평을 Claude Haiku/Sonnet으로 생성. 규칙 기반 템플릿의 반복 느낌 해소, 팀별 밈·말투 반영(`data-pipeline/team-context.json` 활용). 구현 조건: GitHub Actions secret에 `ANTHROPIC_API_KEY` 추가 필요. 파이프라인에서 gameId+date 키로 캐시해 2분 빌드마다 LLM 호출하지 않도록 설계. 비용 Haiku 기준 시즌 전체 ~$2.
- [ ] **포스트시즌 화면** — 10~11월 포스트시즌 기간 자동 감지 후 시리즈 컨텍스트 표시. KBO API `srId=3`(와카·준PO·PO) / `srId=7`(KS)로 전환, `GAME_SC_NM`(라운드명 예: "KS2")·`VS_GAME_CN`(시리즈 내 차전) 필드 활용. 오늘경기 탭 상단에 시리즈 현황 카드(A팀 n승 - B팀 m승) 추가. 꿀잼지수는 포스트시즌 전체 고득점 보정 별도 검토.

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
> **야구공 재화의 서버/DB 이후 핵심 사용처 = "꿀잼 예측 리그"**(아래 Phase 4). 스킨은 소비처, 예측 리그는 참여·보상 루프의 중심. 단 예측 리그는 계정/DB(Phase 3)가 선행돼야 열리는 기능이며 **지금 구현하지 않고 기획/로드맵으로만 편입**함.
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

### Phase 3 — 계정 시스템 + 관리형 DB 도입 (정식 수익화·예측 리그의 필수 게이트) ← 다음 큰 결정
- **DB 도입 기준(라이브 점수가 아니라 유저 자산·복구·예측 기록 때문):** 아래 실제 필요가 생기면 착수 — 로그인 필요 / 광고보상 서버검증 / 야구공 서버관리 / 스킨구매 복구 / 추천코드 / IAP 결제 / 피드백 누적 공식튜닝 / **예측 리그 참여 기록·서버 판정**. (관리형 = Supabase/Firebase, "운영 서버 0" 유지)
- [ ] 백엔드 선택: Supabase vs Firebase
- [ ] 익명 UID(기기 종속) + 복원 코드, 선택적 Google/Apple 로그인
- [ ] **로컬 MVP 상태(잔액·보유·출석·내역)를 서버로 이관·동기화**
- ⚠️ 로그인 = 개인정보 수집 → 약관·개인정보처리방침 필요
- 📐 **설계 확정: [ADR-023](adr.md) · 전체 스펙 [phase3-account-design.md](phase3-account-design.md)** — 익명 UID 우선 opt-in 인증(Android=Google+Kakao·iOS 시 Apple 강제)·충돌=서버우선 전면교체·백엔드 **Supabase 확정**·재화 서버 스키마(profiles/baseball_ledger/owned_skins/attendance_claims/skins/feedback)·재화 무결성 최소 경계(RPC 전용+컬럼 GRANT). 로컬 데이터 마이그레이션 없음(리셋 수용). 첫 구현 태스크=스파이크.
- ✅ **Stage 0 스파이크 검증 완료 (2026-07-03)** — dev build 실기기에서 **익명→`linkIdentity`(Google)→uid 보존 + is_anonymous=false** 확인. dev build OAuth 왕복 리스크 해소. 실전 교훈(Linking.openURL+딥링크·PKCE·Kakao KOE205 등)은 [phase3-account-design.md §9](phase3-account-design.md). Kakao 동의항목은 후속.
- ✅ **착수 결정: Go (2026-07-04)** — **출시 전 기반 다지기**로 구현 확정. 기존 게이트("로컬 재화 루프 재미 신호 후")는 폐기(로컬 출시 후 유저 마이그레이션 지옥 회피 = pre-launch가 정석). 접근=보안크리티컬 수동+기계적 plan-and-build 하이브리드.
- ✅ **Stage 1(DB) 완료 (2026-07-04)** — Supabase 스키마 6종+트리거+RPC(claim_attendance·purchase_skin)+RLS+컬럼 GRANT+skins 시드 실행·검증(잔액 위조 차단 + RPC 작동 확인). SQL은 `supabase/migrations/0001_phase3_stage1.sql`에 박제. 다음=Stage 2(Auth context·첫실행 게이트).
- ✅ **Stage 2(Auth) 완료 (2026-07-04)** — `services/supabase.ts`(클라 싱글턴·AsyncStorage 세션) + `context/Auth.tsx`(첫 실행 익명 sign-in·세션 관리·온라인 게이트). AuthProvider가 provider 트리 최상단. 첫 실행 1회만 온라인 필요, 이후 세션 로컬 생존.
- ✅ **Stage 3-1(재화 코어) 완료 (2026-07-04)** — 야구공·스킨·출석을 로컬→서버(Supabase)+캐시 미러로 스왑. `services/account.ts`(캐시+fetch+RPC) + `ScoreSkin.tsx` 구현 교체(인터페이스 불변→화면 무변경). 잔액 이동=RPC만, 디버그 충전/초기화=대시보드 이관.
- ✅ **Stage 3-2(team·feedback·오프라인) 완료 (2026-07-04)** — `data/team.ts`→`profiles.favorite_team`+캐시(오프라인 낙관적, hydrate로 복구), `services/feedback.ts`→`feedback` 테이블 INSERT+Discord 병행, `hooks/useOnline.ts` 신규(netinfo). 민감 쓰기(구매·출석·피드백) 오프라인 게이팅(버튼 비활성/토스트). 읽기 화면 7곳 무변경. **⚠️ netinfo=네이티브 의존성→dev build 재빌드 필요.** 다음=Stage 4(계정 보호/복구·라커룸 진입점).
- ✅ **Stage 4 코어(계정 보호/복구) 구현 (2026-07-04)** — 스파이크 OAuth를 정식 이관: `context/Auth.tsx`에 `protect`(linkIdentity)·`recover`(signInWithOAuth)·`signOut` + 딥링크 완성(네이티브)/웹 분기. `screens/AccountProtect.tsx`(신규·손실 경고 모달), 라커룸 진입점+보호됨/미보호 뱃지, Settings 계정 섹션. `supabase.ts` 웹 `detectSessionInUrl` 분기. SpikeAuth 삭제. **Google만·웹+네이티브·iOS 후행·넛지 다음.** ⚠️ OAuth 왕복은 라이브 검증 대기(Supabase Redirect URL 등록 필요), app/ 변경→dev build 재빌드 필요. 넛지 배너는 후속.
- 🐛 **웹 오프라인 게이팅 오판 수정 (2026-07-04)** — netinfo 웹 도달성 probe(`HEAD /`=200)가 GitHub Pages 프로젝트 서브패스에서 실패→`isInternetReachable=false` 오판→출석/구매/피드백 차단. `useOnline`이 웹에선 `navigator.onLine`만 신뢰하도록 수정.
- 🛠️ **디버그 테스트 도구 (2026-07-04)** — 서버 재화라 클라 직접 초기화 불가 → `debug_reset`(신규유저 15로 리셋)·`debug_grant`(+N) definer RPC(`0002_debug_tools.sql`) + `app_config.debug_enabled` 플래그 게이팅. Settings 디버그 섹션(EXPO_PUBLIC_DEBUG_TOOLS)에서 호출. **🚨 출시 전 필수: `update app_config set debug_enabled=false` + 디버그 버튼 미노출(현재 deploy-web은 DEBUG_TOOLS=1로 공개 URL에 노출됨).**

### Phase 3-Pre — 실제 꿀잼 경기 판정 파이프라인 (예측 리그 선행 과제)
> 예측 리그 MVP의 심장. **계정/DB와 독립적으로 파이프라인 단독 선행 가능**(판정 결과 JSON만 먼저 산출).
- [ ] 경기 종료 후 그날 경기 중 **실제 꿀잼 1위 경기(`actualTopGameId`)** 산출 로직
- [ ] tie-breaker 정의: A. recapScore 높은 경기 → B. live.heat peak 높은 경기 → C. 9회 이후 접전/역전/끝내기 이벤트 → D. 그래도 동점이면 공동 적중 허용
- [ ] 판정 결과 산출물 `DailyHoneyResult { date, actualTopGameId, recapScore, liveHeatPeak?, decidingReasonTags[], calculatedAt }`
- [ ] 기존 `recap-history.json`(예측 vs 실제 적중률 누적)과 연결 — 현재는 "그날 실제 1위 + tie-breaker"를 뽑는 로직이 없음(신규)
- ⚠️ 판정은 **항상 서버/파이프라인이 실제 경기 데이터 기준**으로 처리. 클라·야구공이 결과에 개입 불가.

### Phase 4 — 꿀잼 예측 리그 MVP (계정/DB + 판정 파이프라인 이후)
> 야구공 재화의 서버 이후 킬러 기능. **"베팅"이 아니라 "예측 참여"**. 하루 1회 무료 참여로 시작.
> **용어 규칙:** ❌ 베팅·배당·판돈 → ✅ **예측 참여 · 적중 보상 · 참가 야구공 · 보상 등급 · 랭킹 포인트**.
- **선행 조건(모두 충족돼야 착수):** 계정/UID · 관리형 DB · 서버 판정(Phase 3-Pre) · 예측 중복 방지 · 경기 시작 후 예측 잠금 · 보상 지급 기록.
- [ ] **하루 1회 무료 예측** — 경기 시작 전까지 "오늘 가장 재밌을 것 같은 경기" 1개 선택(베팅형 아님)
- [ ] 경기 시작 후 예측 잠금(`lockedAt`) + 유저·날짜당 중복 참여 방지
- [ ] 서버가 `actualTopGameId`와 대조해 적중/미적중 판정(`status: pending|hit|miss|void`)
- [ ] 적중 시 야구공·랭킹 포인트·연속 적중 지급 / 미적중도 기록은 DB 저장
- [ ] 개인 기록 화면(참여·적중·적중률·연속 적중)
- **핵심 데이터모델:**
  - `UserPrediction { id, userId, date, selectedGameId, selectedAt, lockedAt?, status, predictedHoneyScore, finalRecapScore?, actualTopGameId?, rewardBaseballs, rankingPoints }`
  - `UserPredictionStats { userId, totalPredictions, totalHits, hitRate, currentStreak, bestStreak, weeklyPoints, seasonPoints }`
- **무결성 원칙(재확인):** 야구공으로 랭킹 포인트 직접 구매 불가 / 예측 결과 변경 불가 / 공식 꿀잼지수 계산 개입 불가.
- ❌ MVP 제외: 야구공 베팅 · 배당률 · 현금성 보상 · 유저 간 거래 · 랜덤박스 · 유료 시즌 패스 · 친구 랭킹 · 크라우드 꿀잼지수 노출.

### Phase 5 — 랭킹 / 팬덤 대항전 / 시즌 패스 (예측 리그 후속 확장)
- [ ] **개인 주간 랭킹** — 적중 수·적중률·랭킹 포인트 조합(총참여량만으론 유리하지 않게 보정). 상위권 배지/야구공 보상. 예: 이번 주 꿀잼 예측왕 · 적중률 랭킹 · 연속 적중 랭킹 · 내 응원팀 내 랭킹.
- [ ] **팬덤 대항전** — 개인 예측 적중이 응원팀 점수에도 기여. 인기팀이 유저 수로 압도하지 않게 보정(팀별 평균/참여율 보정/상위 N명 평균/최소 참여자 기준). 보상: 주간 팀 1위 배지 · 기여자 소량 야구공 · 시즌 우승 한정 라커룸/스킨.
- [ ] **시즌 패스** — 예측·출석·피드백·라이브 확인·스킨을 하나의 시즌 진행도로. 미션 예: 예측 10회 / 적중 3회 / 내 팀 확인 7회 / 피드백 5회 / 출석 14일 / live.heat 80+ 확인 3회. 보상: 야구공·한정 스킨·라커룸 배경·시즌 배지·칭호. ⚠️ **무료 시즌 미션부터 시작**(처음부터 유료 시즌 패스로 가지 않음).
- [ ] **크라우드 꿀잼 예측**(장기) — 유저 예측을 모아 "팬들이 고른 오늘의 꿀잼 경기"를 공식 꿀잼지수와 비교 노출. ⚠️ 표본 적을 때 의미 약함 → 예측 리그 데이터 쌓인 뒤 노출, 부족 시 "참여자 수 부족" 표시. 장기적으로 꿀잼지수 공식 개선 데이터로 활용.

### Phase 6 — 광고 보상 / IAP (서버 재화 검증 이후)
- [ ] **서버 재화 검증** — 잔액·소비를 서버가 계산(클라 신뢰 금지, 치팅 방지). 광고/결제·예측 보상 지급의 전제.
- [ ] 보상형 광고(AdMob) → 야구공 지급 + 동의(GDPR/ATT). `unlockType=premium/event` 스킨 해제 경로.
- [ ] **실제 결제(IAP)** — 야구공 충전을 스토어 IAP로(디지털재화 외부결제 불가 — Google Play Billing/Apple IAP, 수수료 15~30%). 영수증 검증(서버) + 구매 복원 + 스토어 정책 심사·환불.

### 현실 조언 (기능은 비용)
- 로컬 MVP로 **"스킨/재화 루프가 재미있나"를 먼저 검증** 중. 반응이 좋아야 계정+서버(큰 투자)로 진행.
- 순서: 로컬 MVP 반응 확인 → **Phase 3(계정·DB, 상태 이관)** → Phase 3-Pre(판정 파이프라인, 단독 선행 가능) → Phase 4(예측 리그 MVP) → Phase 5(랭킹·팬덤·시즌 패스) → Phase 6(광고·결제). 정식 재화/결제·예측 리그는 계정 없이 진행 금지.
- **예측 리그는 지금 구현하지 않음** — 문서/기획 편입만. 착수는 Phase 3 계정/DB 도입 결정(별도 ADR/논의) 이후.

---
참고 문서: [prd.md](prd.md) · [adr.md](adr.md) · [flow.md](flow.md) · [data-schema.md](data-schema.md)
