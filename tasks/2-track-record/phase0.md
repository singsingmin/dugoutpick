# Phase 0: 문서 업데이트 (누적 적중률 트랙레코드)

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `docs/spec.md` — 라우트·데이터모델·파이프라인 계약·불변 규칙
- `docs/data-schema.md` — 앱이 소비하는 정적 JSON 3종의 정밀 스키마
- `docs/code-architecture.md` — 파이프라인/앱 분리 구조
- `docs/adr.md` — 아키텍처 결정 기록(ADR-002 캐시폴백, ADR-004/005 꿀잼지수 단일출처)
- `docs/testing.md` — 검증 게이트(AC) 정책
- `docs/roadmap.md` — 백로그(특히 섹션 C 데이터·정확도)
- `docs/user-intervention.md` — 사람 손이 필요한 지점 기록

그리고 이번 task가 구현할 대상 코드를 읽어 현재 상태를 파악하라:

- `data-pipeline/build.mjs` (특히 L440-505: prevHonjam freeze, recap 계산, games 산출)
- `data-pipeline/.github/workflows` 가 아니라 `.github/workflows/update-data.yml` (산출물 커밋 로직)
- `app/types.ts` (데이터 타입 단일 출처)

## 배경 — 이번 task가 추가하는 것 (전체 설계의 단일 출처)

요구사항: **꿀잼지수 누적 적중률 트랙레코드** — 날짜를 넘어 쌓이는 객관 적중 지표를 앱에 노출.

현재 `build.mjs`는 FINAL 경기마다 `recap = {actual, verdict}`를 계산하지만(L476-490), `games.json`은 **오늘 경기만** 담고 매 빌드 덮어써져 날짜를 넘는 누적이 없다. 이 task는 다음을 추가한다:

1. **`data-pipeline/output/recap-history.json`** — append-only 크로스데이트 누적 파일. source of truth.
2. **정직성 게이트(frozen)** — 경기 전에 freeze된 예측만 적중률에 집계(post-hoc 재계산 pred 영구 배제).
3. **집계 임베드** — 롤링 집계값을 `games.json` 최상단 `trackRecord`로 미러링(앱은 새 fetch 없이 이미 받는 games.json에서 읽음).
4. **앱 신뢰 배지** — Today 상단 + Settings에 "최근 N경기 예측 적중률 XX%" 1줄 + 정의 병기.

### 확정 설계 (이 task 전체가 따르는 규칙 — 후속 phase가 이 정의를 구현한다)

**recap-history.json 구조**
```jsonc
{
  "updatedAt": "ISO",
  "window": 50,            // 적중률 집계 윈도우(최근 N건)
  "sampleSize": 23,        // 윈도우 내 실제 집계된 레코드 수
  "hitRate": 71,           // 0~100 정수. verdict==='예측 적중' 비율(%)
  "bonusRate": 17,         // 0~100 정수. verdict==='기대 이상' 비율(%). hitRate와 별개(합산 금지)
  "ready": true,           // sampleSize >= MIN_SAMPLE(10) 일 때만 true
  "records": [             // append 순서 = 발생 순서 (정렬·재배열 금지)
    { "date": "20260623", "gameId": "20260623SSLG0", "pred": 78, "actual": 84, "verdict": "기대 이상" }
  ]
}
```

**games.json 최상단에 추가되는 필드**
```jsonc
{ "date": "...", "dateText": "...", "updatedAt": "...",
  "trackRecord": { "window": 50, "sampleSize": 23, "hitRate": 71, "bonusRate": 17, "ready": true },
  "recommendedGameId": "...", "games": [...] }
```

**Honjam 객체에 추가되는 필드:** `frozen?: boolean` — 이 honjam.score가 경기 전 값으로 freeze되었음을 표시(정직성 게이트용). 앱은 무시.

**정직성 게이트 규칙 (불변 — 깨면 트랙레코드가 거짓이 됨):**
- 적중률에 집계되는 레코드는 반드시 **경기 전에 freeze된 예측(`honjam.frozen===true`)**에서만 나온다.
- `frozen`은 `freeze branch`(직전 산출물의 honjam을 그대로 쓰는 경로)에서, **직전 상태가 SCHEDULED였던 진짜 경기전→경기중/후 전이일 때만 최초 발화**하고 이후 보존만 한다. computeHonjam으로 새로 계산한 값에는 frozen을 설정하지 않는다.
- 첫 sighting이 이미 FINAL이라 경기 전 freeze가 없던 경기는 frozen이 영원히 false → 누적에서 영구 제외.
- `recap.verdict`가 null인 레코드는 누적에 넣지 않는다(분모만 채우고 분자엔 안 잡혀 적중률을 부당하게 깎음).
- append-only: 같은 gameId가 이미 있으면 **덮어쓰지 않는다**(첫 기록 고수). 5분 주기 재실행/재빌드에 중복·드리프트 금지.

**알려진 한계 (문서에 명시):**
- 적중률 표본은 운영 시간이 쌓여야 의미 있다. 첫 ~2일(KBO 하루 5경기 기준 표본<10)은 반드시 '집계 중'으로만 표기.
- FINAL 후 KBO 사후 스코어 정정(몰수·기록 정정)은 append-only dedup 특성상 트랙레코드에 반영되지 않는다(빈도 낮음, 수용된 한계).
- dev/오프라인 번들 시드(`app/assets/data/games.json`)에는 `trackRecord`가 없을 수 있다 → 이 경우 배지는 '집계 중'으로 뜨는 것이 **의도된 동작**(번들 시드는 라이브가 아니므로 트랙레코드가 없는 게 정직하다). QA가 버그로 오인하지 않도록 명시.

**상수:** `MIN_SAMPLE = 10`, `WINDOW = 50`. 후속 phase에서 `data-pipeline/recap.mjs` 상단 export 상수로 둔다.

## 작업 내용

위 확정 설계를 아래 문서들에 반영하라. **코드는 건드리지 마라(이 phase는 문서만).**

1. **`docs/data-schema.md`**
   - `games.json` 섹션에 `trackRecord` 최상단 필드 추가(위 구조). nullable 규칙에 "trackRecord는 표본 부족·구버전 시드에서 없을 수 있음(옵셔널)" 추가.
   - `honjam` 객체 설명에 `frozen?: boolean`(경기 전 freeze 표시, 앱은 무시) 추가.
   - 새 산출물 `recap-history.json` 섹션 신설(위 구조 + append-only/정직성 게이트/윈도우=append순 끝 N개 설명).

2. **`docs/spec.md`**
   - §3(데이터 모델)에 `recap-history.json`을 파이프라인 산출물로 추가하고, `games.json`의 `trackRecord` 계약 1줄 추가.
   - §5(파이프라인 계약)에 "FINAL 경기의 경기 전 freeze된 예측만 recap-history.json에 append-only 누적, 롤링 집계를 games.json에 임베드" 추가.
   - §6(불변 규칙)에 "트랙레코드는 frozen 게이트를 통과한(경기 전 freeze) 예측만 집계한다. verdict=null·표본<MIN_SAMPLE는 노출 금지" 추가.

3. **`docs/adr.md`**
   - 새 ADR 1건 추가(다음 ADR 번호 사용). 제목 예: "누적 적중률 트랙레코드 — frozen 정직성 게이트 + append-only 누적 + 집계 임베드".
   - 결정 요지: ① 크로스데이트 누적은 별도 append-only 파일(recap-history.json), ② 정직성 게이트=frozen(경기 전 예측만 집계, post-hoc 영구배제), ③ 앱 노출은 별도 fetch 대신 games.json 임베드(네트워크 표면 0 증가), ④ 표본<10이면 '집계 중'(과장 방지), ⑤ hitRate와 bonusRate('기대 이상') 분리(합산 금지). 기각안: recap-history 전체를 앱이 fetch(무한 증가 낭비), prevStatus만으로 게이트(post-hoc 둔갑 버그).

4. **`docs/testing.md`**
   - "파이프라인(`data-pipeline/`)" 섹션에 **순수 로직 테스트 컨벤션** 명문화: data-pipeline의 테스트는 `node:assert` + 의존성 0으로 작성하고, `node data-pipeline/test/*.test.mjs`로 실행한다. **`build.mjs`는 top-level `main().catch()` 구동이라 import하면 실제 네트워크 빌드가 돌므로 테스트에서 import 금지** — 순수 로직은 `data-pipeline/recap.mjs` 같은 부작용 없는 모듈로 분리해 테스트한다.
   - "헤드리스에서 dev 번들 시드는 `trackRecord`가 없어 배지가 '집계 중'으로 뜨는 것이 정상" 1줄 추가(QA 오인 방지).

5. **`docs/roadmap.md`**
   - 섹션 C의 "꿀잼지수 공식 실경기 검증·튜닝 — recap 데이터 누적" 항목에 진행 표시: 누적 트랙레코드(recap-history.json + 적중률 배지) 구현됨을 반영(체크 또는 하위 노트). 가중치 자동 보정은 여전히 미완으로 남긴다.

6. **`docs/user-intervention.md`**
   - "## 항목"에 이번 task 항목 추가(기록 형식 준수):
     - 제목: `2026-06-24 누적 적중률 트랙레코드 — APK 재빌드 + 파이프라인 push 필요`
     - 상황: 앱 코드(types/배지/화면) 변경이라 APK 재빌드 필요. build.mjs 변경은 origin/main push해야 Actions가 라이브 반영(로컬 커밋만으론 안 바뀜). 적중률 표본은 운영 며칠 누적돼야 의미(첫 ~2일 '집계 중')이며 이는 운영시간이지 인간 개입 아님.
     - 필요한 수동 조치: ① main push(파이프라인 라이브 반영), ② EAS APK 재빌드/배포.
     - 차단 여부: non-blocking(코드·테스트는 CLI로 완결, 배포만 사용자 몫).

## Acceptance Criteria

```bash
# 6개 문서가 수정되었고 핵심 키워드가 들어갔는지 확인 (Git Bash / POSIX sh)
grep -l "recap-history" docs/data-schema.md docs/spec.md
grep -l "trackRecord" docs/data-schema.md docs/spec.md
grep -l "frozen" docs/data-schema.md docs/spec.md docs/adr.md
grep -l "집계 중" docs/testing.md
grep -q "recap-history\|trackRecord\|적중률" docs/roadmap.md && echo "roadmap OK"
grep -q "APK\|적중률\|트랙레코드" docs/user-intervention.md && echo "intervention OK"
```

## AC 검증 방법

위 grep 커맨드들이 각 파일을 정상 출력하면(에러 없이) 통과로 본다. 통과하면 `tasks/2-track-record/index.json`의 phase 0 status를 `"completed"`로 변경하라. 문서 작성이 3회 시도 후에도 누락되면 status를 `"error"`로 바꾸고 `error_message`를 기록하라.

## 주의사항

- **코드 파일을 수정하지 마라.** 이 phase는 문서(`docs/*.md`)만 건드린다. `build.mjs`·`types.ts`·앱 코드는 후속 phase 담당.
- 기존 ADR 번호를 재사용하지 마라 — 마지막 ADR 다음 번호를 쓴다.
- 기존 문서의 다른 내용을 삭제하지 마라. 추가·갱신만.
- `docs-diff.md`는 직접 만들지 마라 — runner가 phase 0 완료 후 자동 생성한다.
- 상수값(MIN_SAMPLE=10, WINDOW=50)을 문서에 다른 숫자로 적지 마라. 후속 phase 코드와 일치해야 한다.
