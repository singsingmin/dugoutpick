# Phase 3: ui-badge

## 사전 준비

아래 파일만 읽어라:

- `app/components/TrackRecordBadge.tsx` — 전체 (55줄 내외)
- `app/types.ts` lines 83-89 — TrackRecord 인터페이스 (Phase 1에서 recentRecapPreview 추가됨)
- `app/theme.ts` 또는 `app/theme/index.ts` — colors, spacing, border 토큰 확인
- `app/components/PixelText.tsx` — variant 종류 확인 ('caption', 'body' 등)
- `/tasks/5-recap-preview/docs-diff.md` — 설계 확인

## 작업 내용

`app/components/TrackRecordBadge.tsx`를 수정해, 트랙레코드 집계 미달 시 프리뷰 카드를 표시하는 분기를 추가한다.

### 조건 분기 로직

```
track가 없거나 track.ready === false:
  └─ variant === 'settings'이면: "적중률 집계 중" 텍스트 (기존과 동일)
  └─ track?.recentRecapPreview?.length > 0이면:
       → 프리뷰 카드 렌더링 (최대 5개)
  └─ 그 외:
       → "적중률 집계 중" 텍스트 (기존과 동일)

track.ready === true:
  → 기존 hitRate/bonusRate 표시 (변경 없음)
```

### 프리뷰 카드 UI

각 카드는 한 줄 텍스트: `"예측 {pred} → {verdict}"`

- `pred`: 0~100 정수 (예: 82)
- `verdict`: "예측 적중" | "기대 이상" | "기대 이하" (있는 그대로 표시, 이모지 없음)
- 예시: `"예측 82 → 기대 이상"`, `"예측 45 → 기대 이하"`

프리뷰 카드 영역 상단에 라벨 텍스트 1줄 추가:
`"최근 경기 결과 미리보기"` — variant="caption", color=textDim

각 카드 텍스트: variant="caption", color=textDim (기대 이하도 색상 구분 없이 동일하게 표시 — 선별 없음 원칙)

### 컴포넌트 시그니처

Props 변경 없음. 기존 `track?: TrackRecord | null`과 `variant?: 'today' | 'settings'`를 그대로 사용한다. `track.recentRecapPreview`를 읽는다.

### 스타일

프리뷰 카드 전체를 기존 `styles.box`로 감싼다 (테두리/배경 동일). 내부 아이템 간격은 `gap: 2` (기존과 동일).

## Acceptance Criteria

```bash
cd app && npx tsc --noEmit
```

타입 에러 없이 exit 0이면 통과.

## AC 검증 방법

위 커맨드를 실행하라. 통과하면 `/tasks/5-recap-preview/index.json`의 phase 3 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고 `"error_message"` 기록.

## 주의사항

- `Today.tsx`를 수정하지 마라. `data.trackRecord`가 이미 `recentRecapPreview`를 포함하므로 별도 prop 전달 불필요.
- `variant === 'settings'`일 때는 프리뷰 카드를 표시하지 않는다 (기존 "집계 중" 텍스트 유지).
- `recentRecapPreview.map()`에서 key는 index 대신 `pred-index` 조합 또는 인덱스를 사용해도 무방 (배열이 고정임).
- hitRate 배지(`ready === true` 경로)는 절대 건드리지 마라.
- "기대 이상"을 다른 색상/강조로 특별 처리하지 마라 — 선별 금지 원칙.
