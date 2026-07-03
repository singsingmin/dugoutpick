# Code Architecture

## 큰 그림
```
[GitHub Actions + 외부 cron(cron-job.org) 5분]
  data-pipeline/build.mjs ──생성──> output/*.json ──commit/push──> 저장소(raw)
                                                          │
                              ┌───────────────────────────┘
                              ▼ fetch(raw)
  [Cloudflare Worker (cf-worker)]  ← 엣지 라이브 오버레이 레이어
     games.json: 정적 데이터(honjam·선발 frozen) + KBO 실시간 점수/라이브 상태 병합
     그 외(standings/recent/report): GitHub raw 패스스루
                              │
                              ▼ fetch(REMOTE_BASE_URL = Worker)
  [Expo 앱] 표시 전용. 꿀잼지수 재계산 X. 마지막 데이터 AsyncStorage 캐시(오프라인 생존).
```
핵심 2층 분리:
1. **느린 정적 층(파이프라인)** — 깨지기 쉬운 스크래핑·꿀잼지수 계산을 GitHub Actions로 분리. 깨져도 앱은 직전 커밋 JSON 표시(ADR-002/003).
2. **빠른 라이브 층(Worker)** — 경기중 점수·이닝은 5분 단위 정적 JSON으로는 못 따라가므로, 무서버 정신을 지키는 **엣지 함수**가 요청 시점에 KBO 실시간 데이터를 정적 데이터 위에 덧씌운다. KBO API가 죽으면 정적 games.json으로 폴백(ADR-018).

## 디렉토리
```
DugoutPick/
├─ data-pipeline/          # 데이터 생성 (Node 20, 의존성 0)
│  ├─ build.mjs            # fetch→파싱→꿀잼지수→write. 진입점
│  ├─ teams.mjs            # 10구단 코드·팀명·색상 (단일 출처)
│  └─ output/*.json        # games/standings/teams/recent/report/recap-history (산출물)
├─ cf-worker/              # Cloudflare Worker — 라이브 오버레이 엣지 레이어
│  └─ src/index.ts         # games.json 병합 + 그 외 패스스루 (ADR-018)
├─ .github/workflows/update-data.yml  # 크론 자동 갱신(+ 외부 cron이 workflow_dispatch 호출)
├─ app/                    # Expo RN 앱 (구현 완료)
├─ docs/                   # 본 문서들
└─ scripts/                # 설계 PoC(spike, honjam-v1~v3) + pwa-patch.mjs(웹 배포 경로 패치)
```

## 파이프라인 (data-pipeline/build.mjs)
- 입력: KBO 5개 소스(전부 koreabaseball.com 비공식 HTTP, 브라우저 불필요):
  ① 경기목록·선발·스코어 `Main.asmx/GetKboGameList`(POST) ② 팀순위 `Record/TeamRank/TeamRankDaily.aspx`(GET)
  ③ 투수ERA `Record/Player/PitcherBasic/Basic1.aspx`(GET, 규정미달은 개별 `PitcherDetail/Basic.aspx?playerId=`로 보완)
  ④ 일정 `Schedule.asmx/GetScheduleList`(POST, 월요/주간) ⑤ 라인업 `Schedule.asmx/GetLineUpAnalysis`(POST, 타순).
  Worker는 ①을 라이브 점수용으로 재사용.
- 처리: 순위표→팀별 지표 맵 / 경기+선발 / 투수ERA맵 → `computeHonjam()`으로 점수·이유·관전포인트 생성.
- 산출물: `games.json`(오늘 경기 + 꿀잼지수 + 트랙레코드 임베드), `standings.json`, `teams.json`, `recent.json`(팀별 최근 결과), `report.json`(월요 리포트), `recap-history.json`(누적 적중률, append-only).
- 꿀잼지수 로직은 **이 파일에 응집**(앱과 공유 안 함 — 앱은 결과만 소비). 공식 튜닝 시 앱 재배포 불필요.
- **freeze 게이트:** 경기 전 계산된 `honjam`을 `frozen:true`로 박제. 경기중/후에도 재계산하지 않아 트랙레코드 정직성 확보(ADR-017).
- 실패 시 exit 1 → Actions가 커밋 안 함 → 앱은 직전 JSON 유지.

## Cloudflare Worker (cf-worker/src/index.ts)
앱의 `REMOTE_BASE_URL`이 가리키는 실제 엔드포인트. 요청 경로별 동작:
- **`games.json`**: GitHub raw 정적 games.json + KBO 실시간 경기목록(`Main.asmx/GetKboGameList`)을 `Promise.all`로 동시 fetch → `gameId(G_ID)` 기준 병합.
  - **상태 판정** `resolveStatus()`: `GAME_STATE_SC`가 정확한 상태 필드(과거 `GAME_SC_ID`는 신뢰 불가 버그 — ADR-018). 취소(`CANCEL_SC_ID`)·종료(`GAME_RESULT_CK`/`GAME_STATE_SC===3`)·라이브(`GAME_STATE_SC===2`) 순으로 결정.
  - **점수**: LIVE/FINAL일 때만 `T_SCORE_CN`/`B_SCORE_CN`을 away/home score로 덮어씀.
  - **라이브 오버레이**(LIVE일 때만): inning/half/out/주자(b1·b2·b3)/투수/타자 + `heat`(지금 볼 각 흥미도 0~100, `liveHeat()`) + `label`(예: "9회말 끝내기 찬스").
  - **취소사유**: `CANCEL_SC_NM`(예: "우천취소")를 `cancelReason`에 채움.
  - **꿀잼지수는 손대지 않음** — 정적 frozen 값 그대로 통과(라이브 층은 점수/상태만).
  - KBO API 실패 → 정적 games.json 그대로 반환(폴백).
- **그 외(`standings.json`/`recent.json`/`report.json` 등)**: GitHub raw로 패스스루(CORS 헤더만 부착).
- **live.heat v1.1(ADR-021):** raw 계산은 `data-pipeline/liveHeatCore.mjs`(순수 모듈, build.mjs가 import) + Worker에 동일 로직 복제. momentum·smooth(직전 상태 필요)는 앱 전용(`app/utils/liveHeat.ts`). 수정 시 Worker 카피 + `test/liveheat.test.mjs` 골든 테이블을 함께 갱신.

## 앱 (Expo / React Native + TypeScript)
| 영역 | 선택 | 비고 |
|---|---|---|
| 언어 | **TypeScript** | phase별 `tsc --noEmit` 검증(ADR-012). data-schema를 `types.ts`로 명문화 |
| 네비 | native-stack(Splash/Onboarding/GameDetail/SkinSelect/BaseballCenter/Settings) + bottom-tabs(Today/Standings/MyTeam/LockerRoom) | `app/navigation/`. flow.md와 1:1 |
| 상태(전역) | React Context — `TeamTheme`(응원팀 accent색), `ScoreSkin`(선택 스킨 + 야구공 잔액·보유 스킨·출석·거래내역) | 라이브러리 없이 Context로 충분 |
| 영속화 | 응원팀·스킨·피드백·야구공(잔액/보유/출석/거래) = AsyncStorage / 데이터 = 로드+캐시 | ADR-011/022 |
| 데이터 로딩 | `REMOTE_BASE_URL`(Worker) fetch + AsyncStorage 캐시 → 번들 폴백 | 환경 분기 `data/config.ts` 1곳 |
| 테마 | 8비트 도트: Galmuri11(expo-font), 토큰화한 `theme.ts`, 빈티지 라이트 팔레트 | ADR-009/013/015 |
| 팀 색상 | teams.json `color` → `TeamTheme.accent` | 배지·테두리 액센트 동적 적용 |

### 앱 폴더(현재)
```
app/
├─ App.tsx                 # 네비 루트 + 폰트 로드 + Provider(TeamTheme→ScoreSkin)
├─ theme.ts                # 8비트 디자인 토큰(색/폰트/보더/간격)
├─ types.ts                # data-schema의 TS 타입(단일 출처)
├─ navigation/             # RootNavigator(stack), Tabs(bottom-tabs), types
├─ screens/                # Splash, Onboarding, Today, GameDetail, MyTeam, Standings,
│                          #   LockerRoom, Settings, SkinSelect, BaseballCenter
├─ components/             # GameCard, LiveCard, JerseyScoreBadge, ScoreboardScoreBadge, ImageFrameScoreBadge,
│                          #   ScoreSkinRenderer, GguljamScoreLabel, TrackRecordBadge, TxHistorySheet,
│                          #   FeedbackWidget, MondayReport, LineupSheet, WeeklyScheduleSheet ...
├─ context/               # TeamTheme.tsx, ScoreSkin.tsx(스킨+야구공 재화·출석·거래)  (※ UniformPreset.tsx는 죽은 코드)
├─ utils/                 # scoreSkinConfig.ts(스킨 정의·가격·마이그레이션), uniformResolver.ts(유니폼 SVG 프리셋),
│                          #   assetFrameConfig.ts(imageFrame 에셋 레이아웃), attendance.ts(출석·거래·KST)
├─ data/                  # config.ts(REMOTE_BASE_URL), load.ts(fetch+캐시+번들폴백), team.ts(AsyncStorage)
└─ assets/                # fonts/Galmuri11*.ttf, data/*.json(번들 폴백), 이미지(stadium-bg 등)
```

### 꿀잼지수 배지 스킨 (ScoreSkin)
- `ScoreSkinRenderer`가 선택 스킨의 `kind`로 분기: `jersey`(유니폼 SVG, `JerseyScoreBadge`) / `asset`(고정 이미지+숫자 오버레이). asset은 `renderType`으로 다시 분기 — `scoreboard`(전광판, `ScoreboardScoreBadge`) / `imageFrame`(티켓·홈플레이트·메달 등, `ImageFrameScoreBadge` + `assetFrameConfig`).
- 스킨 ID 예: `jersey.classic.team`·`jersey.stripe.red`·`scoreboard.vintage`·`ticket.retro`·`homeplate.retro`·`medal.special` (`scoreSkinConfig.ts` 단일 정의, `styleId×paletteId` / assetKey 확장형).
- **구매/재화(ADR-022):** 스킨은 `unlockType`(free/currency)·`price`. 보유 판정 = free∥구매∥적용중. 야구공 잔액·보유목록·출석·거래내역 모두 `ScoreSkin` context + AsyncStorage(`user.baseballBalance`/`ownedSkinIds`/`baseballTx`/`att*`)에 로컬 저장.
- AsyncStorage 키 `user.scoreSkinId`. 구버전 키 `user.uniformPreset`는 `normalizeScoreSkinId()`가 마이그레이션. 구매제 전환 시 적용 중이던 유료 스킨은 클래식으로 리셋.
- 상세 결정·제약은 ADR-019(스킨 시스템)·ADR-022(로컬 재화 MVP).

### Phase 3 계정/DB 아키텍처 (설계 완료 · 미착수)
계정/DB 착수 시 **기존 context 인터페이스(ScoreSkin·CheerTeam)는 불변, 구현만 `AsyncStorage → services 레포(Supabase+캐시)`로 스왑** → 화면 무변경. 신규 `context/Auth.tsx`·`services/supabase.ts`·`services/{currency,skins,attendance,profile}.ts`·`hooks/useOnline.ts`(신규 의존성 `@react-native-community/netinfo`), Provider 트리 `Auth > ScoreSkin`. 백엔드 = Supabase 확정("운영 서버 0" 유지). 이관 대상은 4개(ScoreSkin·team·feedback·알림토글)뿐, 읽기 파이프라인(Worker)은 무영향. 전체: **[phase3-account-design.md §7·§8](phase3-account-design.md)** · 결정: [adr.md ADR-023](adr.md).

### Phase AC 전략 (디바이스 없이 검증)
- `npx tsc --noEmit` — 타입·문법 오류 0
- `npx expo export --platform web`(또는 ios) — JS 번들 성공 = import/해상도/구문 오류 0
- 헤드리스에서 앱 "실행"은 검증하지 않음(디바이스 필요). 위 둘이 phase 합격 기준(ADR-014).

## 원칙
- 꿀잼지수 = 파이프라인 단일 출처. 앱·Worker·문서 어디서도 재구현/덮어쓰기 금지(Worker는 점수·상태만 오버레이).
- teams는 `teams.mjs`/`teams.json` 단일 출처.
- 외부 의존 최소화(파이프라인 0개). 앱도 무거운 라이브러리 지양 → "에러 적고 빠른 완성" 원칙.
- 데이터 산출물(`output/*.json`, 앱 번들 JSON)은 Actions가 자동 갱신 — 수동 재생성·커밋 금지(push 충돌 유발).
