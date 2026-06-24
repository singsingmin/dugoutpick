# Phase 1: `data-pipeline/recap.mjs` 순수 로직 모듈 신설

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `docs/data-schema.md` — `recap-history.json` 구조, `games.json` `trackRecord`, `honjam.frozen` (이번 task에서 추가됨)
- `docs/spec.md` — 파이프라인 계약, 트랙레코드 불변 규칙
- `docs/adr.md` — 누적 트랙레코드 ADR(frozen 게이트/append-only/임베드)
- `docs/testing.md` — data-pipeline 순수 로직 테스트 컨벤션(node:assert, 0-deps, build.mjs import 금지)
- `tasks/2-track-record/docs-diff.md` — 이번 task의 문서 변경 기록

그리고 대상 코드를 읽어 현재 형상을 파악하라:

- `data-pipeline/build.mjs` — 특히 L440-505. `prevHonjam` freeze(L457), `recap` 계산(L476-490: `pred = honjam ? honjam.score : null`, `verdict`는 actual/pred로 '기대 이상'/'예측 적중'/'기대 이하' 또는 null), games 산출 구조.
- `data-pipeline/teams.mjs` — 0-deps ESM 모듈 작성 스타일 참고.

## 작업 내용

`data-pipeline/recap.mjs` 를 **의존성 0의 순수 ESM 모듈**로 신설한다. 이 모듈은 `build.mjs`가 import해 쓰며, top-level 부작용(네트워크/파일IO)이 **절대 없어야** 한다(테스트가 import하기 때문). 아래 export를 정확한 시그니처로 구현하라. 구현체 내부는 재량이되, 명시된 규칙은 반드시 지켜라.

### 1) 상수
```js
export const MIN_SAMPLE = 10;  // 이 미만이면 ready=false ('집계 중')
export const WINDOW = 50;      // 적중률 집계 윈도우(최근 N건)
```

### 2) `resolveFrozen({ status, prevHonjam, prevStatus })` → `boolean`
freeze branch가 생성할 honjam에 찍을 `frozen` 값을 계산한다(정직성 게이트의 핵심).
- `prevHonjam`이 없으면(null/undefined) → `false`.
- 있으면 → `prevHonjam.frozen === true || prevStatus === 'SCHEDULED'`.
- **규칙:** frozen은 (a) 이미 frozen이었거나 (b) 직전 상태가 SCHEDULED였던 진짜 경기전→경기중/후 전이일 때만 true. 그 외(예: 직전이 FINAL인 post-hoc 경기)는 false를 유지해 **영구 배제**된다. 이 함수는 `status !== 'SCHEDULED'`인 freeze branch에서만 호출되지만, 함수 자체는 위 boolean만 순수 계산한다.

### 3) `toRecord(game, date)` → `record | null`
FINAL 게임 객체로부터 누적 레코드를 만든다. 아래 **모든** 조건을 만족할 때만 `{ date, gameId, pred, actual, verdict }`, 아니면 `null`:
- `game.status === 'FINAL'`
- `game.recap != null`
- `game.honjam != null && game.honjam.frozen === true`  ← 경기 전 freeze된 예측만
- `game.recap.verdict != null`  ← **verdict가 null인 레코드는 거른다**(분모만 채우고 분자엔 안 잡혀 적중률을 부당하게 깎음 — CTO 필수 가드)
- `typeof game.honjam.score === 'number'`

레코드 값: `pred = game.honjam.score`, `actual = game.recap.actual`, `verdict = game.recap.verdict`, `gameId = game.gameId`, `date = date`(인자, YYYYMMDD).

### 4) `mergeHistory(existing, incoming)` → `record[]`
append-only 멱등 병합.
- `existing`(null/undefined → `[]`로 취급)의 순서를 **그대로 보존**하고, `incoming` 중 gameId가 existing에 **없는 것만** 끝에 incoming 순서대로 추가한다.
- **이미 있는 gameId는 절대 덮어쓰지 않는다**(첫 기록 고수). incoming 내부에서도 같은 gameId가 둘이면 첫 번째만.
- 동일 입력에 대해 여러 번 호출해도 결과가 동일해야 한다(멱등). 같은 gameId가 다른 actual로 재유입돼도 **첫 값을 고수**한다.

### 5) `aggregate(records, opts)` → `{ window, sampleSize, hitRate, bonusRate, ready }`
시그니처: `aggregate(records, { window = WINDOW, minSample = MIN_SAMPLE } = {})`.
- 윈도우 = **records 배열의 append 순서 끝에서 `window`개**(`records.slice(-window)`). **정렬·재배열 금지** — append-only라 삽입순 = 발생순이다(날짜/gameId로 재정렬하면 같은 날 경기가 시각순이 아니라 사전순으로 잘려 "최근"의 의미가 어긋난다).
- `sampleSize` = 윈도우 슬라이스 길이.
- `hitRate` = `sampleSize > 0` 이면 `Math.round(100 * (verdict==='예측 적중' 개수) / sampleSize)`, 아니면 `0`.
- `bonusRate` = `sampleSize > 0` 이면 `Math.round(100 * (verdict==='기대 이상' 개수) / sampleSize)`, 아니면 `0`. **hitRate에 합산하지 마라**(별개 지표).
- `ready` = `sampleSize >= minSample`.
- `window` = 사용한 window 값 그대로 반환.

verdict 문자열 상수는 build.mjs와 정확히 일치해야 한다: `'예측 적중'`, `'기대 이상'`, `'기대 이하'`.

## Acceptance Criteria

```bash
node --check data-pipeline/recap.mjs   # 문법 OK
# 부작용 없이 import되고 export가 전부 존재하는지 (네트워크/파일IO 0)
node --input-type=module -e "
import('./data-pipeline/recap.mjs').then(m => {
  const need = ['MIN_SAMPLE','WINDOW','resolveFrozen','toRecord','mergeHistory','aggregate'];
  for (const k of need) if (m[k] === undefined) throw new Error('missing export: '+k);
  // 빠른 스모크
  if (m.resolveFrozen({status:'FINAL', prevHonjam:{frozen:false}, prevStatus:'FINAL'}) !== false) throw new Error('resolveFrozen post-hoc must be false');
  if (m.resolveFrozen({status:'LIVE', prevHonjam:{}, prevStatus:'SCHEDULED'}) !== true) throw new Error('resolveFrozen SCHEDULED transition must be true');
  const a = m.aggregate([], {});
  if (a.ready !== false || a.sampleSize !== 0) throw new Error('empty aggregate must be not-ready, size 0');
  console.log('recap.mjs OK');
});
"
```

## AC 검증 방법

위 두 커맨드가 에러 없이 `recap.mjs OK`를 출력하면 통과. 통과하면 `tasks/2-track-record/index.json`의 phase 1 status를 `"completed"`로 변경하라. 3회 시도 후에도 실패하면 status를 `"error"`로 바꾸고 `error_message`를 기록하라.

## 주의사항

- **top-level 부작용 금지.** import만으로 어떤 fetch·파일 읽기·콘솔 출력도 일어나면 안 된다(테스트가 import한다). 순수 함수와 상수만 export.
- **`build.mjs`를 수정하지 마라** — 통합은 phase 3 담당. 이 phase는 `recap.mjs` 신설만.
- 테스트 파일(`test/`)도 이 phase에서 만들지 마라 — phase 2 담당.
- `Math.round`로 정수화(소수 hitRate 금지). verdict 문자열 오타 주의(공백·한글 정확히).
- `mergeHistory`는 입력 배열을 **변형(mutate)하지 마라** — 새 배열을 반환.
