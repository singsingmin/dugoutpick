# Phase 1: types

## 사전 준비

아래 파일만 읽어라 (라인 범위 좁혀서):

- `app/types.ts` lines 83-98 — TrackRecord, GamesData 인터페이스
- `/tasks/5-recap-preview/docs-diff.md` — Phase 0에서 문서화한 변경 확인

## 작업 내용

`app/types.ts`의 `TrackRecord` 인터페이스에 `recentRecapPreview` 옵셔널 필드를 추가한다.

```typescript
export interface TrackRecord {
  window: number;
  sampleSize: number;
  hitRate: number;
  bonusRate: number;
  ready: boolean;
  recentRecapPreview?: { pred: number; verdict: string }[];
}
```

- `ready === false`일 때 파이프라인이 이 필드를 채운다.
- `ready === true`일 때 파이프라인이 이 필드를 생략한다.
- UI는 `ready`와 `recentRecapPreview` 두 필드를 조합해 분기한다.

`GamesData` 인터페이스는 변경하지 않는다 (`trackRecord?: TrackRecord` 그대로).

## Acceptance Criteria

```bash
cd app && npx tsc --noEmit
```

타입 에러 없이 exit 0이면 통과.

## AC 검증 방법

위 커맨드를 실행하라. 통과하면 `/tasks/5-recap-preview/index.json`의 phase 1 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 `"error_message"` 필드로 기록하라.

## 주의사항

- `GamesData`를 수정하지 마라. `trackRecord?: TrackRecord`는 현행 유지.
- 다른 인터페이스(Game, Recap, Honjam 등)를 건드리지 마라.
- `verdict` 타입을 `string`으로 유지한다 (리터럴 유니온으로 좁히지 않는다 — 파이프라인과 계약이 느슨하게 유지되어야 함).
