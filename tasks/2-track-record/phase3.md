# Phase 3: `build.mjs` 통합 — frozen 마킹 + recap-history 누적 + trackRecord 임베드

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `docs/spec.md` — 파이프라인 계약(§5), 트랙레코드 불변 규칙(§6)
- `docs/data-schema.md` — `recap-history.json`, `games.json` `trackRecord`, `honjam.frozen`
- `docs/adr.md` — 누적 트랙레코드 ADR
- `tasks/2-track-record/docs-diff.md` — 이번 task의 문서 변경 기록

그리고 직전 phase 산출물을 반드시 읽어라:

- `data-pipeline/recap.mjs` — `MIN_SAMPLE`, `WINDOW`, `resolveFrozen`, `toRecord`, `mergeHistory`, `aggregate`
- `data-pipeline/test/recap-history.test.mjs` — 이 모듈의 계약(테스트가 보증하는 동작)
- `data-pipeline/build.mjs` — 통합 대상. 특히:
  - L7 import 영역(`teams.mjs` import 스타일)
  - L441-445: 직전 산출물에서 `prevHonjam` 읽는 블록(try/catch)
  - L447-505: `games = rawGames.map(...)` — freeze branch(L457), recap 계산(L476-490)
  - L514-519: 산출물 write 영역(L515 games.json write)

이전 phase에서 만든 `recap.mjs`를 꼼꼼히 읽고, 그 시그니처와 규칙을 정확히 이해한 뒤 통합하라.

## 작업 내용

`build.mjs`에 `recap.mjs`를 import해 아래를 통합한다. **꿀잼지수 계산식·recap actual 계산식은 건드리지 마라**(이미 검증됨). 추가만 한다.

### 1) import 추가 (파일 상단 import 영역)
```js
import { resolveFrozen, toRecord, mergeHistory, aggregate, WINDOW, MIN_SAMPLE } from './recap.mjs';
```

### 2) 직전 산출물에서 `prevStatus`도 읽기 (L441-445 블록)
현재 직전 games.json을 한 번 읽어 `prevHonjam[gameId]`를 채운다. **같은 한 번의 read**에서 `prevStatus[gameId] = g.status`도 함께 채워라(별도 read 금지). 즉:
```js
const prevHonjam = {};
const prevStatus = {};
try {
  const prev = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'games.json'), 'utf8'));
  for (const g of prev.games || []) {
    if (g.gameId && g.honjam) prevHonjam[g.gameId] = g.honjam;
    if (g.gameId) prevStatus[g.gameId] = g.status;
  }
} catch { /* 직전 산출물 없음 → 신규 */ }
```

### 3) freeze branch에서 `honjam.frozen` 마킹 (games.map 내부, L456-461 일대)
freeze branch(직전 honjam을 그대로 쓰는 경로)에서 `resolveFrozen`으로 frozen을 계산해 honjam 객체에 박아라. computeHonjam으로 새로 계산하는 경로에는 frozen을 설정하지 않는다(SCHEDULED이거나 post-hoc → frozen 없음/false). 예:
```js
let honjam = null;
if (status !== 'SCHEDULED' && prevHonjam[g.G_ID]) {
  const frozen = resolveFrozen({ status, prevHonjam: prevHonjam[g.G_ID], prevStatus: prevStatus[g.G_ID] });
  honjam = { ...prevHonjam[g.G_ID], frozen };   // 경기 시작 후엔 경기 전 값 고정 + frozen 보존/발화
} else if (sa && sh) {
  honjam = computeHonjam(...같은 인자...);        // frozen 미설정
}
```
**불변:** freeze branch 조건은 기존대로 `status !== 'SCHEDULED'`(즉 LIVE/FINAL/CANCELED 포함). CANCELED에서도 frozen이 보존돼야 취소-재개 경기가 살아남는다(케이스4). 이 조건을 좁히지 마라.

### 4) recap-history 누적 + trackRecord 임베드 (games 산출 후, write 직전)
`games` 배열이 완성된 뒤, `recommendedGameId` 계산 부근에서 아래를 **이 순서대로** 수행하라:
```js
// (a) 직전 누적 로드 (없으면 빈 history)
let history = [];
try {
  const h = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'recap-history.json'), 'utf8'));
  history = Array.isArray(h.records) ? h.records : [];
} catch { /* 첫 실행 → 빈 history */ }

// (b) 이번 빌드의 적격 레코드만 추출 (toRecord가 frozen·verdict null 등 게이트 처리)
const incoming = games.map(g => toRecord(g, date)).filter(Boolean);

// (c) append-only 멱등 병합
const merged = mergeHistory(history, incoming);

// (d) 롤링 집계
const trackRecord = aggregate(merged, { window: WINDOW, minSample: MIN_SAMPLE });

// (e) recap-history.json write (source of truth)
fs.writeFileSync(path.join(OUT_DIR, 'recap-history.json'),
  JSON.stringify({ updatedAt, ...trackRecord, records: merged }, null, 2));
```
그리고 games.json write(L515)에서 객체에 `trackRecord`를 **최상단(updatedAt 다음, recommendedGameId 앞 권장)** 으로 임베드하라:
```js
fs.writeFileSync(path.join(OUT_DIR, 'games.json'),
  JSON.stringify({ date, dateText: dt, updatedAt, trackRecord, recommendedGameId, games }, null, 2));
```
`updatedAt`은 기존 변수를 재사용(이미 L512에 있음). 순서 의존: **(c) merge → (d) aggregate → (e) write → games.json 임베드**. 한 빌드 내 동기 흐름이라 안전하다.

### 5) 로그 1줄 (선택, 기존 console.log 스타일)
누적 상태 가시화: `console.log('[build] recap-history: +' + incoming.length + ' new, total ' + merged.length + ', hitRate ' + trackRecord.hitRate + '% (n=' + trackRecord.sampleSize + ', ready=' + trackRecord.ready + ')');`

### 워크플로
`.github/workflows/update-data.yml`은 **수정하지 마라.** 기존 `git add data-pipeline/output/*.json`이 신규 `recap-history.json`을 자동 커버하며, "updatedAt-only diff 스킵" 필터와도 정합한다(레코드 추가 시에만 real change → 커밋).

## Acceptance Criteria

```bash
node --check data-pipeline/build.mjs                 # build.mjs 파싱·문법 OK
node data-pipeline/test/recap-history.test.mjs       # recap.mjs 계약 여전히 통과(회귀 가드)
# build.mjs가 recap.mjs를 정상 import하는지 (정적 확인 — 네트워크 빌드는 돌리지 않음)
grep -q "from './recap.mjs'" data-pipeline/build.mjs && echo "import OK"
grep -q "recap-history.json" data-pipeline/build.mjs && echo "history write OK"
grep -q "trackRecord" data-pipeline/build.mjs && echo "embed OK"
```

## AC 검증 방법

위 커맨드가 모두 에러 없이 통과하면(`node --check` exit 0, 테스트 exit 0, grep 3개 OK 출력) 통과로 본다. 통과하면 `tasks/2-track-record/index.json`의 phase 3 status를 `"completed"`로 변경하라. 3회 시도 후에도 실패하면 status를 `"error"`로 바꾸고 `error_message`를 기록하라.

## 주의사항

- **`node data-pipeline/build.mjs`(실제 빌드)를 AC로 돌리지 마라** — KBO 네트워크 의존이라 헤드리스/오프라인에서 exit 1이 정상 방어다(testing.md). 산출물 JSON을 수동 재생성·커밋하지도 마라(Actions 자동 갱신, push 충돌 유발).
- **꿀잼지수 공식(`computeHonjam`)·recap actual 계산(L482 `rawActual`)·`calibrate`를 수정하지 마라.** frozen 마킹·누적·임베드만 추가.
- freeze branch 조건 `status !== 'SCHEDULED'`를 좁히지 마라(CANCELED 포함 유지 — 취소-재개 frozen 보존).
- `recap.mjs`를 수정하지 마라(계약 고정). build.mjs 쪽만 통합.
- 기존 산출물 5종(games/standings/teams/recent/report) write를 깨뜨리지 마라 — recap-history.json은 **추가** write다.
- frozen을 freeze branch 밖(computeHonjam 결과)에 설정하지 마라 — post-hoc 오염.
