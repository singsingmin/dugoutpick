# Phase 2: pipeline

## 사전 준비

아래 파일만 읽어라:

- `data-pipeline/build.mjs` lines 614-634 — recap-history 로드 + trackRecord 집계 + games.json write 부분
- `data-pipeline/recap.mjs` lines 49-63 — `aggregate()` 함수 반환 구조 확인
- `/tasks/5-recap-preview/docs-diff.md` — Phase 0 변경 기록

## 작업 내용

`data-pipeline/build.mjs`에서 `aggregate()` 호출 직후, `trackRecord.ready === false`일 때 `recentRecapPreview` 배열을 `trackRecord` 객체에 부착한다.

현재 코드 (line ~622):
```js
const trackRecord = aggregate(merged, { window: WINDOW, minSample: MIN_SAMPLE });
```

이 라인 직후에 아래 블록을 추가한다:
```js
// 집계 미달 시 최근 5경기 프리뷰 (선별 금지: 있는 그대로 slice)
if (!trackRecord.ready && merged.length > 0) {
  trackRecord.recentRecapPreview = merged.slice(-5).reverse().map(r => ({ pred: r.pred, verdict: r.verdict }));
}
```

**핵심 규칙**:
- `merged.slice(-5)`: append-only 배열의 끝에서 5개 = 가장 최근 5경기
- `.reverse()`: 최신 경기가 배열 앞으로 (newest-first 표시 순서)
- `.map(r => ({ pred: r.pred, verdict: r.verdict }))`: `pred`와 `verdict`만 추출 (gameId, date 등 불필요한 필드 제거)
- 선별 금지: `verdict === '기대 이하'` 결과도 그대로 포함 (filter 없음)
- `trackRecord.ready === true`이면 이 블록 실행 안 함 → `recentRecapPreview` 필드 없음

`games.json` write 라인(line 628)은 수정 불필요:
```js
fs.writeFileSync(path.join(OUT_DIR, 'games.json'), JSON.stringify({ date, dateText: dt, updatedAt, trackRecord, recommendedGameId, games }, null, 2));
```
`trackRecord` 객체에 `recentRecapPreview`가 이미 부착되어 있으므로 자동으로 포함된다.

## Acceptance Criteria

```bash
# 파이프라인 코드 정적 검증: 문법 오류 없음
node --check data-pipeline/build.mjs
echo "exit: $?"
```

exit 0이면 통과. (실제 build 실행은 네트워크 필요 — AC에서 제외)

추가 확인: 수동으로 아래 스니펫이 올바른 결과를 내는지 확인
```bash
node -e "
const merged = [
  { date: '20260624', gameId: 'A', pred: 62, actual: 39, verdict: '기대 이하' },
  { date: '20260624', gameId: 'B', pred: 5, actual: 68, verdict: '기대 이상' },
  { date: '20260624', gameId: 'C', pred: 13, actual: 2, verdict: '기대 이하' },
];
const preview = merged.slice(-5).reverse().map(r => ({ pred: r.pred, verdict: r.verdict }));
console.log(JSON.stringify(preview));
// 기대: [{pred:13,verdict:'기대 이하'},{pred:5,verdict:'기대 이상'},{pred:62,verdict:'기대 이하'}]
"
```

## AC 검증 방법

위 커맨드를 실행하라. exit 0이고 preview 배열이 newest-first 순서로 나오면 통과.
통과하면 `/tasks/5-recap-preview/index.json`의 phase 2 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고 `"error_message"` 기록.

## 주의사항

- `recap.mjs`의 `aggregate()` 함수 자체를 수정하지 마라. `build.mjs`에서 후처리로 붙인다.
- `ready === true` 경로에 `recentRecapPreview`가 섞이지 않도록 반드시 `if (!trackRecord.ready)` 가드.
- `merged.reverse()`가 아닌 `merged.slice(-5).reverse()` — 원본 배열(merged)을 mutate하지 않는다.
- `games.json` write 라인을 수정하지 마라.
