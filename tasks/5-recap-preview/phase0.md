# Phase 0: docs

## 사전 준비

아래 파일만 읽어라:

- `docs/data-schema.md` — GamesData, TrackRecord 구조 섹션
- `docs/spec.md` — 트랙레코드 배지 섹션 (있으면)
- `/tasks/5-recap-preview/index.json` — 이번 task 맥락 파악용

## 작업 내용

`docs/data-schema.md`의 **TrackRecord** 구조 정의 부분을 찾아, `recentRecapPreview` 필드를 추가 문서화한다.

추가할 필드:
```
recentRecapPreview?: { pred: number; verdict: string }[]
  - 집계 미달(ready=false) 상태에서만 존재
  - 최근 최대 5경기의 frozen 예측값(pred)과 결과 판정(verdict) 배열
  - 최신 경기가 배열 앞에 오는 순서 (newest first)
  - 선별 없음 — '기대 이하' 결과도 그대로 포함
  - ready=true이면 파이프라인이 이 필드를 생략함
```

`docs/spec.md`에 트랙레코드 배지 동작 섹션이 있으면, 아래 내용을 추가/업데이트한다:
- `ready=false` 상태에서 `recentRecapPreview` 존재 시: "예측 {pred} → {verdict}" 형식의 카드를 최대 5개 표시
- `ready=false`이고 `recentRecapPreview`가 없거나 빈 배열이면: "적중률 집계 중" 텍스트 표시
- `ready=true` 상태: 기존 hitRate/bonusRate 배지 표시 (recentRecapPreview 무시)
- 두 모드는 동시에 표시되지 않음

## Acceptance Criteria

```bash
# docs/ 파일에 recentRecapPreview가 문서화되어야 함
grep -r "recentRecapPreview" docs/
```

출력에 `docs/data-schema.md`가 포함되면 통과.

## AC 검증 방법

위 AC 커맨드를 실행하라. 통과하면 `/tasks/5-recap-preview/index.json`의 phase 0 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json 해당 phase에 `"error_message"` 필드로 기록하라.

## 주의사항

- 존재하지 않는 동작을 문서에 쓰지 마라. 구현할 내용만 문서화한다.
- docs/spec.md에 트랙레코드 관련 섹션이 없으면 새로 추가하지 말고, data-schema.md만 업데이트하면 된다.
- 기존 문서 구조를 깨뜨리지 마라 — 필드 추가만 한다.
