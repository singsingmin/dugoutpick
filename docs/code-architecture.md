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
- 입력: KBO 3개 엔드포인트(소스는 data-schema.md). 전부 단순 HTTP, 브라우저 불필요.
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
- `liveHeat()`는 Worker와 `build.mjs` 양쪽에 동일 구현(라이브=Worker, 사후 라벨=파이프라인). 수정 시 두 곳을 함께 고쳐야 함.

## 앱 (Expo / React Native + TypeScript)
| 영역 | 선택 | 비고 |
|---|---|---|
| 언어 | **TypeScript** | phase별 `tsc --noEmit` 검증(ADR-012). data-schema를 `types.ts`로 명문화 |
| 네비 | native-stack(Splash/Onboarding/GameDetail/SkinSelect) + bottom-tabs(Today/MyTeam/Settings) | `app/navigation/`. flow.md와 1:1 |
| 상태(전역) | React Context 3종 — `TeamTheme`(응원팀 accent색), `ScoreSkin`(꿀잼지수 배지 스킨) | 라이브러리 없이 Context로 충분 |
| 영속화 | 응원팀·스킨·피드백 = AsyncStorage / 데이터 = 로드+캐시 | ADR-011 |
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
├─ screens/                # Splash, Onboarding, Today, GameDetail, MyTeam, Standings, Settings, SkinSelect
├─ components/             # GameCard, LiveCard, JerseyScoreBadge, ScoreboardScoreBadge,
│                          #   ScoreSkinRenderer, GguljamScoreLabel, TrackRecordBadge,
│                          #   FeedbackWidget, MondayReport, LineupSheet, WeeklyScheduleSheet ...
├─ context/               # TeamTheme.tsx, ScoreSkin.tsx  (※ UniformPreset.tsx는 죽은 코드 — ScoreSkin이 대체)
├─ utils/                 # scoreSkinConfig.ts(스킨 정의·마이그레이션), uniformResolver.ts(유니폼 SVG 프리셋)
├─ data/                  # config.ts(REMOTE_BASE_URL), load.ts(fetch+캐시+번들폴백), team.ts(AsyncStorage)
└─ assets/                # fonts/Galmuri11*.ttf, data/*.json(번들 폴백), 이미지(stadium-bg 등)
```

### 꿀잼지수 배지 스킨 (ScoreSkin)
- `ScoreSkinRenderer`가 현재 선택된 스킨의 `kind`로 분기: `jersey`(유니폼 SVG 배지, `JerseyScoreBadge`) / `scoreboard`(레트로 전광판 View, `ScoreboardScoreBadge`).
- 스킨 ID 네임스페이스: `jersey.classic`/`jersey.pinstripe`/`jersey.cream`/`scoreboard.vintage` (`scoreSkinConfig.ts`).
- AsyncStorage 키 `user.scoreSkinId`. 구버전 키 `user.uniformPreset`(classic/pinstripe/cream)는 `normalizeScoreSkinId()`가 `jersey.*`로 마이그레이션.
- 상세 결정·제약은 ADR-019.

### Phase AC 전략 (디바이스 없이 검증)
- `npx tsc --noEmit` — 타입·문법 오류 0
- `npx expo export --platform web`(또는 ios) — JS 번들 성공 = import/해상도/구문 오류 0
- 헤드리스에서 앱 "실행"은 검증하지 않음(디바이스 필요). 위 둘이 phase 합격 기준(ADR-014).

## 원칙
- 꿀잼지수 = 파이프라인 단일 출처. 앱·Worker·문서 어디서도 재구현/덮어쓰기 금지(Worker는 점수·상태만 오버레이).
- teams는 `teams.mjs`/`teams.json` 단일 출처.
- 외부 의존 최소화(파이프라인 0개). 앱도 무거운 라이브러리 지양 → "에러 적고 빠른 완성" 원칙.
- 데이터 산출물(`output/*.json`, 앱 번들 JSON)은 Actions가 자동 갱신 — 수동 재생성·커밋 금지(push 충돌 유발).
