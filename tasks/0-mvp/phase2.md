# Phase 2: ui-kit (8비트 공통 컴포넌트)

## 사전 준비

먼저 아래 문서를 반드시 읽어라:

- `docs/adr.md` — ADR-009(레트로 8비트 도트 UI: 픽셀폰트+각진 두꺼운 테두리+비비드 팔레트, 이미지 금지 CSS+아이콘), ADR-013(Galmuri)
- `docs/code-architecture.md` — components 목록, 테마 토큰 사용
- `docs/data-schema.md` — 컴포넌트가 받을 데이터 형태(Game/TeamSide/Honjam/Team)

이전 phase 산출물을 반드시 읽어라:

- `app/theme.ts` — 색/폰트/보더/간격 토큰 (모든 스타일은 여기서 가져온다)
- `app/types.ts` — props 타입
- `app/data/load.ts` (teams 접근 방식 참고)

## 작업 내용

재사용 8비트 UI 컴포넌트를 `app/components/`에 만든다. **화면(screen)에 배치하지는 않는다** — 컴포넌트 정의만. 모든 색/간격/폰트/보더는 `theme.ts`에서 가져오고 하드코딩하지 마라. 이미지 사용 금지(ADR-009) — 도형/테두리/아이콘 폰트로만 표현.

컴포넌트(각각 props 인터페이스를 export):

1. **`PixelText.tsx`** — `Text` 래퍼. `theme.fonts.pixel` 기본 적용. props: `variant?: 'title'|'body'|'caption'|'score'`, `color?`, 표준 Text props 확장. 앱의 모든 텍스트는 이걸 쓰게 될 기본 단위.

2. **`Panel.tsx`** — 8비트 박스(각진 두꺼운 테두리 `border.width`, `radius:0`, 배경 `colors.surface`). props: `children`, `style?`, `accentColor?`(테두리색 오버라이드, 팀색 액센트용).

3. **`PixelButton.tsx`** — 누를 수 있는 박스 버튼(Pressable). props: `label: string`, `onPress`, `accentColor?`, `selected?`. selected 시 테두리/배경 강조.

4. **`TeamBadge.tsx`** — 팀 표시 배지. props: `team: { code: string; name: string; color: string }` 또는 `code`로 teams에서 조회. 팀 `color`를 배경/테두리로 쓰고 팀명을 픽셀폰트로. props: `size?: 'sm'|'md'`.

5. **`HonjamBadge.tsx`** — 꿀잼지수 표시(8비트 강조). props: `score: number`, `size?: 'sm'|'lg'`. `theme.honjamColor(score)`로 점수대별 색. lg는 히어로 카드/상세용 대형, sm은 리스트용.

6. **`GameCard.tsx`** — 경기 카드(리스트/히어로 공용). props: `game: Game`, `variant: 'hero'|'list'`, `onPress: () => void`. 표시: 양팀 `TeamBadge`(away vs home), `time`·`stadium`, `HonjamBadge`(game.honjam?.score), 그리고 `game.honjam?.reason`(hero는 크게, list는 1줄 말줄임). honjam이 null이면 점수/이유 영역 숨김. status가 'FINAL'이면 점수 표시, 'CANCELED'면 '취소' 표기.

> 구현체 디테일(정확한 레이아웃 수치)은 재량. 단 8비트 톤(각진 테두리·픽셀폰트·고대비) 유지, theme 토큰 사용은 필수.

## Acceptance Criteria

```bash
cd app
npx tsc --noEmit
```
추가:
```bash
test -f app/components/PixelText.tsx && test -f app/components/Panel.tsx && test -f app/components/PixelButton.tsx && test -f app/components/TeamBadge.tsx && test -f app/components/HonjamBadge.tsx && test -f app/components/GameCard.tsx
```

## AC 검증 방법

위 커맨드 실행. `tsc --noEmit` 에러 0 + 모든 `test -f` 성공 시 phase 2 status를 `"completed"`로 변경. 3회 이상 실패 시 `"error"` + `"error_message"`. 개입 필요 시 `"blocked"` + `"blocked_reason"`.

## 주의사항

- 색·간격·폰트·테두리 값을 컴포넌트에 하드코딩하지 마라. 전부 `theme.ts`에서 import. 이유: 8비트 톤의 일관성과 추후 테마 조정.
- 이미지/png 아이콘을 쓰지 마라(ADR-009). 아이콘이 필요하면 텍스트/도형/이모지로.
- 컴포넌트를 화면에 배치하거나 네비게이션을 건드리지 마라. 이 phase는 컴포넌트 정의만.
- props 타입은 `app/types.ts`의 `Game`/`Team` 등을 재사용하라. 새 데이터 타입 정의 금지.
- `honjam`이 `null`일 수 있음을 반드시 처리하라(옵셔널 체이닝). null 미처리 시 런타임 크래시.
