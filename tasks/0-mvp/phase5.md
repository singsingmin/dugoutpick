# Phase 5: myteam-settings (내 팀 탭 + 설정 탭)

## 사전 준비

먼저 아래 문서를 반드시 읽어라:

- `docs/flow.md` — MyTeam(피드형: 다음경기→순위→최근결과), Settings(응원팀 변경/갱신시각/버전) (★ 핵심)
- `docs/adr.md` — ADR-010(내 팀 탭=피드형), ADR-008(개인화는 점수 아닌 탭에서), ADR-011(AsyncStorage)
- `docs/data-schema.md` — `standings.json`(내 팀 행 조회), `games.json`(내 팀 경기 필터), `updatedAt`

이전 phase 산출물을 반드시 읽어라:

- `app/data/load.ts`(`loadGames`,`loadStandings`,`loadTeams`), `app/data/team.ts`(`getCheerTeam`)
- `app/components/*` (GameCard, Panel, PixelText, TeamBadge, HonjamBadge)
- `app/screens/MyTeam.tsx`, `app/screens/Settings.tsx`, `app/screens/Onboarding.tsx`(설정에서 재사용)
- `app/navigation/types.ts`, `app/types.ts`, `app/theme.ts`

## 작업 내용

1. **`app/screens/MyTeam.tsx`** (피드형 세로 스크롤, ADR-010):
   - `getCheerTeam()`으로 응원팀 code 획득 → `loadTeams`로 팀 정보, `loadGames`/`loadStandings` 로드.
   - 피드 구성(위→아래, ScrollView):
     - ① **내 팀 다음/오늘 경기 카드**: `games`에서 away/home code가 내 팀인 경기 찾기. 있으면 `GameCard`(꿀잼+이유) + 탭 시 `GameDetail`. 없으면 "오늘 내 팀 경기 없음".
     - ② **현재 순위**: `standings`에서 내 팀 행 → 순위·승/패/무·승률·게임차·연속(streak)·최근10(last10)을 Panel에 8비트로.
     - ③ **최근 결과**: 내 팀의 최근10(last10 문자열)과 연속 기록을 시각화(텍스트/도형 기반으로 충분).
   - 상단에 내 팀 `TeamBadge`(팀색 헤더).

2. **`app/screens/Settings.tsx`** (최소, flow.md):
   - **응원팀 변경**: 누르면 `Onboarding`으로 이동(`navigation.navigate('Onboarding')`). Onboarding은 변경 후 저장하고 Tabs로 복귀(phase 3에서 재사용 가능하게 구현됨).
   - **데이터 갱신시각**: `loadGames().updatedAt`을 읽어 사람이 읽기 쉬운 형식으로 표시.
   - **앱 정보**: 앱 이름 "오늘야구각" + 버전(`expo-constants` 또는 app.json의 version 하드코딩 허용).
   - 8비트 리스트(Panel + PixelButton) 톤 유지.

## Acceptance Criteria

```bash
cd app
npx tsc --noEmit
```

## AC 검증 방법

위 커맨드 실행. `tsc --noEmit` 에러 0 통과 시 phase 5 status를 `"completed"`로 변경. 3회 이상 실패 시 `"error"` + `"error_message"`. 개입 필요 시 `"blocked"` + `"blocked_reason"`.

## 주의사항

- 내 팀 매칭은 팀 **code**로 한다(저장된 값이 code). name 비교 금지(표기 흔들림 위험).
- 응원팀이 아직 없을 수도 있다(이론상 온보딩 후 진입이지만 방어적으로) — null 처리.
- `standings`에서 내 팀 행이 없을 가능성(데이터 이슈)도 옵셔널 처리.
- 설정의 "응원팀 변경"은 Onboarding 화면을 재사용한다 — Onboarding을 새로 만들지 말고 기존 것을 navigate하라.
- 꿀잼지수 관련 값은 games.json 그대로 사용(계산 금지, ADR-004).
