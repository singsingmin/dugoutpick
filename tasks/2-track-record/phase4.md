# Phase 4: 앱 타입 + `TrackRecordBadge` 컴포넌트

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `docs/data-schema.md` — `games.json` `trackRecord`, `honjam.frozen`(이번 task 추가분)
- `docs/spec.md` — 앱은 읽기 전용 소비자, 트랙레코드 노출 규칙(표본<10 = '집계 중')
- `docs/code-architecture.md` — 앱 폴더 구조, 8비트 테마 토큰
- `docs/testing.md` — 앱 AC(`tsc --noEmit`), dev 시드 trackRecord-없음 = '집계 중' 정상
- `tasks/2-track-record/docs-diff.md` — 이번 task의 문서 변경 기록

그리고 직전 phase 산출물(파이프라인이 내보내는 데이터 형상)을 이해하라:

- `data-pipeline/recap.mjs` — `aggregate`가 내보내는 `{window, sampleSize, hitRate, bonusRate, ready}` 형상
- `data-pipeline/build.mjs` — games.json 최상단 `trackRecord` 임베드, `honjam.frozen` 마킹

그리고 기존 앱 코드의 스타일·토큰을 반드시 읽고 일관성을 맞춰라:

- `app/types.ts` — 데이터 타입 단일 출처(수정 대상)
- `app/components/HonjamBadge.tsx` — 배지 컴포넌트 스타일 레퍼런스(StyleSheet, border/colors/spacing 토큰 사용법)
- `app/components/PixelText.tsx` — 텍스트 컴포넌트(variant: title/body/caption/score/...) 사용법
- `app/components/Panel.tsx` — 박스 래퍼
- `app/theme.ts` — `colors`(accent=포레스트그린, textDim, surface, gold, border), `spacing`, `border` 토큰

## 작업 내용

### 1) `app/types.ts` 수정
- `Honjam` 인터페이스에 옵셔널 필드 추가: `frozen?: boolean;` (경기 전 freeze 표시, 앱은 표시에 쓰지 않음. 주석으로 "파이프라인 정직성 게이트용, 앱은 무시" 명기).
- 새 인터페이스 추가:
```ts
export interface TrackRecord {
  window: number;     // 집계 윈도우(최근 N건)
  sampleSize: number; // 윈도우 내 실제 표본 수
  hitRate: number;    // 0~100, 예측 적중 비율(%)
  bonusRate: number;  // 0~100, '기대 이상' 비율(%) — hitRate와 별개
  ready: boolean;     // sampleSize >= 임계치(10)일 때만 true
}
```
- `GamesData` 인터페이스에 옵셔널 필드 추가: `trackRecord?: TrackRecord;` (표본 부족·구버전 번들 시드에서 없을 수 있으므로 **옵셔널**. 주석으로 "없으면 '집계 중' 처리" 명기).

### 2) `app/components/TrackRecordBadge.tsx` 신설
신뢰 배지 컴포넌트. 8비트 테마 토큰과 기존 컴포넌트(PixelText 등)를 재사용한다.

**Props:**
```ts
interface Props {
  track?: TrackRecord | null;
  variant?: 'today' | 'settings';  // 기본 'today'
}
```

**렌더 규칙(불변 — 과장 금지가 이 기능의 신뢰 근거):**
- `track`가 없거나 `track.ready === false` → **"적중률 집계 중"** 한 줄(textDim 톤). 수치(%)를 **절대 표시하지 마라**. (표본 부족 시 과장은 정확도-민감 사용자에게 즉시 삭제 트리거)
- `track.ready === true`:
  - 메인 줄: **"최근 {track.sampleSize}경기 예측 적중률 {track.hitRate}%"** (accent 강조). 문구에 상수(50)를 하드코딩하지 말고 **실제 `sampleSize`** 를 써라(거짓말 방지 — N=50이지만 시즌 초엔 표본이 더 적음).
  - 정의 줄(필수 병기): **"예측 꿀잼지수가 실제 체감과 ±10 안에 든 비율"** (caption/textDim).
  - `variant === 'settings'` 일 때만 부가 줄 추가: **"기대 이상 {track.bonusRate}%"** (textDim). `variant === 'today'`에서는 **hitRate 단일 숫자만** 노출하고 bonusRate를 표시하지 마라(사용자가 hitRate+bonusRate를 합산해 오해하는 것 방지).

**스타일:** `app/components/HonjamBadge.tsx`의 토큰 사용 패턴을 따른다(StyleSheet.create, border.width/radius, colors.surface 배경, colors.accent/textDim 텍스트, spacing). 'today' variant는 컴팩트한 가로 1줄+정의, 'settings'는 Panel 안에 들어갈 수 있게 약간 더 여유 있게. 과한 신규 디자인 토큰 추가 금지 — 기존 theme 토큰만.

이 phase는 **컴포넌트를 화면에 연결하지 않는다**(연결은 phase 5). 컴포넌트와 타입만 만든다.

## Acceptance Criteria

```bash
cd app && npx tsc --noEmit
```

## AC 검증 방법

`cd app && npx tsc --noEmit`이 타입·문법 오류 0으로 통과하면 통과. 통과하면 `tasks/2-track-record/index.json`의 phase 4 status를 `"completed"`로 변경하라. 3회 시도 후에도 실패하면 status를 `"error"`로 바꾸고 `error_message`를 기록하라.

## 주의사항

- `trackRecord`·`frozen`은 **옵셔널**로 둬라 — 구버전 번들 `assets/data/games.json`(필드 없음)도 tsc를 통과해야 한다. non-optional로 만들면 기존 시드가 타입 에러를 낸다.
- ready=false / track 없음일 때 수치(%)를 절대 노출하지 마라('집계 중'만).
- 'today' variant에서 bonusRate를 표시하지 마라(hitRate 단일).
- 컴포넌트를 Today/Settings에 import·배치하지 마라 — phase 5 담당. 이 phase는 타입+컴포넌트 신설만.
- `app/assets/data/*.json`(번들 시드)을 수동 수정·재생성하지 마라(Actions 자동 갱신, 수동 금지 규칙).
- 기존 `tsc --noEmit` 통과를 깨뜨리지 마라.
