# Phase 2: `data-pipeline/test/recap-history.test.mjs` 순수 로직 테스트

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `docs/testing.md` — data-pipeline 순수 로직 테스트 컨벤션(node:assert, 0-deps, build.mjs import 금지)
- `docs/data-schema.md` — `recap-history.json` 구조, `honjam.frozen`, `trackRecord`
- `docs/adr.md` — 누적 트랙레코드 ADR(frozen 게이트의 의도)
- `tasks/2-track-record/docs-diff.md` — 이번 task의 문서 변경 기록

그리고 직전 phase 산출물을 반드시 읽고 그 export 시그니처에 맞춰 테스트하라:

- `data-pipeline/recap.mjs` — `MIN_SAMPLE`, `WINDOW`, `resolveFrozen`, `toRecord`, `mergeHistory`, `aggregate`

이 모듈의 export 시그니처와 규칙(특히 frozen 게이트·verdict null 배제·append-only dedup·윈도우 append순)을 정확히 이해한 뒤 테스트를 작성하라.

## 작업 내용

`data-pipeline/test/recap-history.test.mjs` 를 **`node:assert` + 의존성 0** 으로 신설한다. `data-pipeline/recap.mjs`만 import한다(**`build.mjs`는 절대 import 금지** — top-level `main()`이 네트워크 빌드를 구동함). 실패 시 즉시 throw(비-0 종료), 전부 통과 시 마지막에 성공 메시지를 출력하고 정상 종료(exit 0)하라.

아래 시나리오를 **모두** 커버하라(각 케이스가 무엇을 검증하는지 주석으로 명시):

### A. `resolveFrozen` — 정직성 게이트 4케이스
- **케이스1 (정상 전이):** `resolveFrozen({status:'LIVE', prevHonjam:{score:70}, prevStatus:'SCHEDULED'})` → `true`. (경기 전 SCHEDULED → 경기중 전이에서 최초 발화)
- **케이스2 (직행, LIVE 누락):** `resolveFrozen({status:'FINAL', prevHonjam:{score:70}, prevStatus:'SCHEDULED'})` → `true`. (SCHEDULED→FINAL 직행이어도 직전이 SCHEDULED라 정당)
- **케이스3 (post-hoc 영구배제):** `resolveFrozen({status:'FINAL', prevHonjam:{score:70, frozen:false}, prevStatus:'FINAL'})` → `false`. (첫 sighting이 FINAL이라 post-hoc로 계산된 pred → frozen 발화 안 됨. 다음 빌드에도 prev.frozen이 false이고 prevStatus가 FINAL이라 계속 false → 영구 배제)
- **케이스4 (취소-재개 frozen 보존):** `resolveFrozen({status:'LIVE', prevHonjam:{score:70, frozen:true}, prevStatus:'CANCELED'})` → `true`. (한 번 정상 freeze된(frozen:true) 경기는 중간 CANCELED를 거쳐 재개돼도 frozen 보존)
- 추가: `resolveFrozen({status:'FINAL', prevHonjam:null, prevStatus:'SCHEDULED'})` → `false`. (prevHonjam 없으면 무조건 false)

### B. `toRecord` — 적격성 가드
- frozen=true & FINAL & recap 있음 & verdict 비-null → 정상 레코드 `{date,gameId,pred:honjam.score,actual:recap.actual,verdict}` 반환.
- **verdict=null 배제:** `honjam.frozen===true`이고 FINAL이지만 `recap.verdict===null` → `null` 반환(분모 오염 방지). 반드시 검증.
- frozen이 아닌(frozen:false 또는 미설정) FINAL → `null`.
- status가 FINAL이 아님(LIVE/SCHEDULED) → `null`.
- recap이 null → `null`.

### C. `mergeHistory` — append-only 멱등 + 재기록 시 첫값 고수
- existing에 없는 gameId만 append되고 순서 보존.
- **멱등:** 같은 incoming으로 두 번 merge → 결과 동일(길이·내용).
- **재기록 시 첫값 고수:** existing에 `{gameId:'G1', actual:80, ...}`가 있을 때 `{gameId:'G1', actual:99, ...}`를 incoming으로 merge → 결과의 G1은 **actual:80 유지**(덮어쓰지 않음). 단순 "2회=동일"만으론 부족하니 이 케이스를 반드시 별도 검증.
- existing이 undefined/null이어도 빈 배열처럼 동작.

### D. `aggregate` — 윈도우/게이트/분리
- **윈도우 절단은 append 순서 끝에서 N개:** records.length > WINDOW일 때 마지막 WINDOW개만 집계됨을 검증(정렬이 아니라 슬라이스). 예: WINDOW+5개를 넣고 sampleSize === WINDOW.
- **hitRate:** verdict 분포를 알 때 `Math.round(100*적중/표본)`과 일치. `'예측 적중'`만 분자.
- **bonusRate 분리:** `'기대 이상'`은 hitRate에 합산되지 않고 별도 bonusRate로 잡힘(같은 표본에서 hitRate + bonusRate가 의도대로 분리되는지).
- **ready 게이트:** sampleSize < MIN_SAMPLE → `ready:false`; >= MIN_SAMPLE → `ready:true`.
- 빈 배열 → `{sampleSize:0, hitRate:0, bonusRate:0, ready:false}`.

## Acceptance Criteria

```bash
node data-pipeline/test/recap-history.test.mjs   # exit 0, 모든 단언 통과
node --check data-pipeline/build.mjs             # build.mjs 여전히 파싱 OK (아직 미수정이지만 회귀 가드)
```

## AC 검증 방법

`node data-pipeline/test/recap-history.test.mjs`가 exit 0으로 모든 테스트 통과를 출력하면 통과. 통과하면 `tasks/2-track-record/index.json`의 phase 2 status를 `"completed"`로 변경하라. 3회 시도 후에도 실패하면 status를 `"error"`로 바꾸고 `error_message`를 기록하라.

## 주의사항

- **`build.mjs`를 import하지 마라.** top-level `main().catch()`가 실제 네트워크 빌드를 돌린다. `recap.mjs`만 import.
- recap.mjs의 구현을 바꾸지 마라 — 테스트만 작성. recap.mjs 동작이 명세와 다르면 그건 phase 1 회귀이니 `error_message`에 적고 멈춰라(테스트를 명세에 맞추되, recap.mjs를 명세에서 벗어나게 고치지 마라).
- 테스트는 외부 네트워크·파일 fixture 없이 인라인 객체 리터럴로 구성하라(헤드리스·오프라인에서 결정적으로 통과해야 함).
- verdict 문자열은 정확히 `'예측 적중'`/`'기대 이상'`/`'기대 이하'`(공백·한글 정확히).
