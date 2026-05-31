# Phase 1: data-nav (데이터 레이어 + 네비게이션 골격)

## 사전 준비

먼저 아래 문서를 반드시 읽어라:

- `docs/flow.md` — 화면 전환·분기 (네비 구조의 근거, ★ 핵심)
- `docs/code-architecture.md` — 앱 폴더 구조, data/ 모듈 역할, 상태 관리 방침
- `docs/data-schema.md` — JSON 구조
- `docs/adr.md` — ADR-002(정적 데이터/번들→원격), ADR-011(AsyncStorage)

이전 phase 산출물을 반드시 읽고 일관성을 유지하라:

- `app/types.ts` — 모든 데이터 타입 (그대로 사용)
- `app/theme.ts` — 디자인 토큰
- `app/App.tsx` — 폰트 로드 방식
- `app/assets/data/*.json` — 번들 데이터

## 작업 내용

데이터 로딩/저장 레이어와 네비게이션 뼈대를 만든다. **화면 UI는 stub(빈 화면)만** — 실제 화면 구현은 phase 3~5 담당.

1. **`app/data/config.ts`** — 환경 분기 단일 지점 (ADR-002):
   - `export const REMOTE_BASE_URL: string | null = null;` (배포 시 원격 JSON URL 주입. null이면 번들 사용)
   - 주석으로 "null=번들 데이터, 값 있으면 원격 fetch+캐시" 의도 명시.

2. **`app/data/load.ts`** — 타입 안전 로더:
   - `loadGames(): Promise<GamesData>`, `loadStandings(): Promise<StandingsData>`, `loadTeams(): TeamsData`
   - `REMOTE_BASE_URL`이 null이면 번들 JSON(`../assets/data/*.json`) import해서 반환. 값이 있으면 `fetch`로 받아 AsyncStorage에 캐시하고, 실패 시 캐시→번들 순으로 폴백(오프라인 생존, ADR-002). **이번 phase는 번들 경로만 동작하면 AC 충분**하나, 원격/캐시 분기 골격은 작성해 둘 것.
   - `teams`는 동기 import 가능(온보딩이 fetch 전에 필요, data-schema 참고).

3. **`app/data/team.ts`** — 응원팀 영속화 (AsyncStorage, ADR-011):
   - `getCheerTeam(): Promise<string | null>` (팀 code 반환)
   - `setCheerTeam(code: string): Promise<void>`
   - 저장 키 상수 `CHEER_TEAM_KEY = 'dugout.cheerTeam'`.

4. **네비게이션 골격** (React Navigation, flow.md와 1:1):
   - `app/navigation/types.ts` — `RootStackParamList { Splash: undefined; Onboarding: undefined; Tabs: undefined; GameDetail: { gameId: string } }`, `TabParamList { Today: undefined; MyTeam: undefined; Settings: undefined }`.
   - `app/navigation/RootNavigator.tsx` — `createNativeStackNavigator`로 Splash / Onboarding / Tabs / GameDetail 등록. 헤더는 8비트 톤(배경 `colors.bg`, 타이틀 폰트 `pixel`) 또는 `headerShown:false` + 커스텀.
   - `app/navigation/Tabs.tsx` — `createBottomTabNavigator`로 Today / MyTeam / Settings. 탭 라벨은 픽셀 폰트, 라벨 텍스트: `오늘경기`/`내 팀`/`설정`.
   - 탭/스택 아이콘은 임시(텍스트/이모지)로 둬도 됨 — 시각 완성은 후속 phase.

5. **stub 화면** — `app/screens/`에 `Splash.tsx`, `Onboarding.tsx`, `Today.tsx`, `GameDetail.tsx`, `MyTeam.tsx`, `Settings.tsx`를 각각 화면명을 표시하는 최소 컴포넌트로 생성(배경 `colors.bg` + 픽셀 텍스트 라벨). 시그니처는 React Navigation screen props 타입을 사용.

6. **`app/App.tsx` 갱신** — 폰트 로드 후 `NavigationContainer` + `RootNavigator` 렌더. 초기 라우트는 `Splash`. (Splash가 응원팀 유무로 분기하는 로직은 phase 3에서 구현하므로, 지금은 Splash가 보이기만 하면 됨.)

## Acceptance Criteria

```bash
cd app
npx tsc --noEmit
```
추가:
```bash
test -f app/data/config.ts && test -f app/data/load.ts && test -f app/data/team.ts
test -f app/navigation/RootNavigator.tsx && test -f app/navigation/Tabs.tsx
test -f app/screens/Splash.tsx && test -f app/screens/Today.tsx && test -f app/screens/GameDetail.tsx && test -f app/screens/MyTeam.tsx && test -f app/screens/Settings.tsx && test -f app/screens/Onboarding.tsx
```

## AC 검증 방법

위 커맨드 실행. `tsc --noEmit` 에러 0 + 모든 `test -f` 성공 시 `tasks/0-mvp/index.json`의 phase 1 status를 `"completed"`로 변경. 3회 이상 실패 시 `"error"` + `"error_message"`. 사용자 개입 필요 시 `"blocked"` + `"blocked_reason"`.

## 주의사항

- **화면의 실제 UI/데이터 바인딩을 구현하지 마라.** stub 라벨만. 실제 렌더는 phase 3~5.
- 데이터 타입은 반드시 `app/types.ts`를 import해 사용하라. 중복 정의 금지(단일 출처).
- 꿀잼지수를 앱에서 계산하지 마라 — `games.json`의 `honjam` 값을 그대로 쓴다(ADR-004). 계산 로직을 새로 만들면 안 된다.
- AsyncStorage 호출은 반드시 `try/catch`로 감싸 실패해도 앱이 죽지 않게 하라.
- 네비 패키지가 미설치면 phase 0의 `npx expo install` 누락이다 — 직접 `npm install` 말고 `npx expo install`로 보강하라.
