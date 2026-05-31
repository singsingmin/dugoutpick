# Phase 4: today (오늘경기 탭 + 경기 상세)

## 사전 준비

먼저 아래 문서를 반드시 읽어라:

- `docs/flow.md` — Today(추천 히어로+나머지 꿀잼순 리스트, 빈 상태), GameDetail(꿀잼/한줄예측/관전포인트/선발) (★ 핵심)
- `docs/prd.md` — 핵심 작동 흐름, 추천 경기가 최상단
- `docs/data-schema.md` — `games.json` 구조: `recommendedGameId`, `games[].honjam.{score,reason,points}`, `away/home.{rank,score,starter}`, `status`
- `docs/adr.md` — ADR-004/005(꿀잼지수·이유는 파이프라인 산출값, 앱은 표시만)

이전 phase 산출물을 반드시 읽어라:

- `app/data/load.ts` — `loadGames`
- `app/components/GameCard.tsx`, `HonjamBadge.tsx`, `TeamBadge.tsx`, `Panel.tsx`, `PixelText.tsx`
- `app/screens/Today.tsx`, `app/screens/GameDetail.tsx` (stub → 실제 구현)
- `app/navigation/types.ts` (`GameDetail: { gameId }`)
- `app/types.ts`, `app/theme.ts`

## 작업 내용

핵심 화면 두 개를 구현한다.

1. **`app/screens/Today.tsx`** (오늘경기 탭):
   - 마운트 시 `loadGames()` 호출. 로딩 중 8비트 로딩 표시.
   - **추천 히어로**: `data.recommendedGameId`와 매칭되는 경기를 `GameCard variant="hero"`로 최상단에 크게.
   - **나머지 경기**: 추천을 제외한 게임을 **꿀잼지수 높은 순**으로 정렬해 `GameCard variant="list"` 리스트로(FlatList 또는 map). honjam이 null인 경기는 맨 뒤.
   - 각 카드 탭 → `navigation.navigate('GameDetail', { gameId })`.
   - 상단에 날짜(`data.dateText`) 표시.
   - **빈 상태**: `games`가 비었으면 "오늘은 경기가 없다" 8비트 빈 상태(flow.md).

2. **`app/screens/GameDetail.tsx`** (경기 상세):
   - route param `gameId`로 `loadGames()`에서 해당 경기 조회(없으면 안전 처리).
   - 표시 구성:
     - 상단: 양팀 `TeamBadge`(rank 포함) + `time`·`stadium`, status가 FINAL이면 스코어.
     - **꿀잼지수 대형**(`HonjamBadge size="lg"`, `honjam.score`).
     - **한 줄 예측**: `honjam.reason` (Panel 안에 강조).
     - **관전 포인트**: `honjam.points[]`를 불릿 리스트로(각 항목 PixelText).
     - **선발 매치업**: away/home `starter` — `name`과 `era`(null이면 'ERA -'/'미정'). starter 자체가 null이면 '선발 미정'.
   - honjam이 null이면 점수/이유/포인트 영역을 숨기고 매치업 정보만.

## Acceptance Criteria

```bash
cd app
npx tsc --noEmit
```

## AC 검증 방법

위 커맨드 실행. `tsc --noEmit` 에러 0 통과 시 phase 4 status를 `"completed"`로 변경. 3회 이상 실패 시 `"error"` + `"error_message"`. 개입 필요 시 `"blocked"` + `"blocked_reason"`.

## 주의사항

- **꿀잼지수·이유·관전포인트를 앱에서 계산/생성하지 마라.** 반드시 `games.json`의 `honjam` 값을 그대로 표시(ADR-004/005). 새 점수 로직을 만들면 설계 위반.
- 정렬 기준은 꿀잼지수 내림차순. 추천 경기는 정렬과 무관하게 항상 최상단 히어로.
- `honjam`, `starter`, `starter.era`, `score`는 모두 null 가능 — 전부 옵셔널 처리. 미처리 시 크래시.
- `recommendedGameId`가 null이거나 매칭 경기가 없을 수 있다 — 그 경우 히어로 없이 리스트만.
- 데이터 로딩 실패도 대비(`try/catch` + 에러/빈 상태). 앱이 죽으면 안 된다.
