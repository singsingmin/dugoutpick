# Phase 3: onboarding (스플래시 + 온보딩)

## 사전 준비

먼저 아래 문서를 반드시 읽어라:

- `docs/flow.md` — 진입 분기(저장된 응원팀 유무 → Onboarding/Today), 온보딩 흐름 (★ 핵심)
- `docs/prd.md` — 온보딩은 필수, 팀명+대표색상 그리드
- `docs/adr.md` — ADR-009(8비트), ADR-011(AsyncStorage)

이전 phase 산출물을 반드시 읽어라:

- `app/data/team.ts` — `getCheerTeam`/`setCheerTeam`
- `app/data/load.ts` — `loadTeams`
- `app/components/*` — `PixelText`, `Panel`, `PixelButton`, `TeamBadge` (재사용)
- `app/navigation/RootNavigator.tsx`, `app/navigation/types.ts`
- `app/screens/Splash.tsx`, `app/screens/Onboarding.tsx` (stub → 실제 구현으로 교체)
- `app/theme.ts`

## 작업 내용

스플래시와 온보딩 화면을 실제로 구현하고 진입 분기를 연결한다.

1. **`app/screens/Splash.tsx`** (flow.md 진입):
   - "오늘야구각" **픽셀 로고**를 화면 중앙에 표시(이미지 금지 — PixelText 대형 + 도형 액센트로 8비트 로고 구성).
   - 마운트 시 `getCheerTeam()` 호출 → 결과에 따라 `navigation.replace(...)`:
     - 응원팀 있음 → `Tabs`
     - 없음 → `Onboarding`
   - 로고가 깜빡 보이도록 짧은 지연(예: 600~1000ms) 후 분기. (지연은 setTimeout, cleanup 필수)

2. **`app/screens/Onboarding.tsx`**:
   - 상단 헤더 픽셀 텍스트(예: "응원팀을 골라라").
   - `loadTeams().teams`로 **10팀 색상 그리드**(2열). 각 팀은 `TeamBadge`/`PixelButton` 조합으로, 팀 `color`를 큰 색상 블록으로 노출 + 팀명. 탭하면 선택 표시(`selected`).
   - 하단 "확인/시작" 버튼: 선택된 팀이 있을 때 활성. 누르면 `setCheerTeam(code)` 후 `navigation.replace('Tabs')`.
   - 팀 미선택 시 시작 버튼 비활성(또는 안내).
   - **이 화면은 설정의 "응원팀 변경"에서도 재사용**되므로(flow.md Settings), 이미 응원팀이 저장돼 있어도 정상 동작해야 한다(재진입 시 기존 선택 표시).

## Acceptance Criteria

```bash
cd app
npx tsc --noEmit
```

## AC 검증 방법

위 커맨드 실행. `tsc --noEmit` 에러 0 통과 시 phase 3 status를 `"completed"`로 변경. 3회 이상 실패 시 `"error"` + `"error_message"`. 개입 필요 시 `"blocked"` + `"blocked_reason"`.

## 주의사항

- 팀 목록은 반드시 `loadTeams()`(=teams.json) 사용. 팀명/색상을 하드코딩하지 마라(단일 출처).
- 응원팀 저장 값은 팀 **code**(예: 'HT','LG')다. name이 아니다. 후속 화면이 code로 조회한다.
- `setTimeout`/네비게이션 호출 시 언마운트 후 호출되지 않도록 cleanup 처리(메모리 경고·크래시 방지).
- 이미지 로고를 쓰지 마라(ADR-009). 텍스트+도형 기반 픽셀 로고로.
- Splash에서 `navigation.navigate` 대신 `replace`를 써라 — 뒤로가기로 스플래시에 돌아오면 안 된다.
