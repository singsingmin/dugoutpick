# Phase 4: ac-verify

## 사전 준비

이 phase는 이전 phase들의 결과물을 검증만 한다. 추가 파일 읽기 불필요.

읽어야 할 파일:
- `/tasks/5-recap-preview/index.json` — phase 0~3이 모두 "completed"인지 확인

## 작업 내용

Phase 0~3에서 구현된 변경사항에 대해 최종 AC 검증을 수행한다.

### 검증 1: TypeScript 타입 검사

```bash
cd app && npx tsc --noEmit
```

### 검증 2: 웹 번들 export (번들 무결성)

```bash
cd app && npx expo export --platform web --output-dir /tmp/dugoutpick-web-export
```

성공 시 `/tmp/dugoutpick-web-export` 디렉토리가 생성되고 index.html 등이 포함됨.

### 검증 3: 파이프라인 문법 검사

```bash
node --check data-pipeline/build.mjs
```

### 검증 4: recentRecapPreview 로직 스모크 테스트

```bash
node -e "
const merged = [
  { date: '20260624', gameId: 'A', pred: 85, actual: 9, verdict: '기대 이하' },
  { date: '20260624', gameId: 'B', pred: 74, actual: 48, verdict: '기대 이하' },
  { date: '20260624', gameId: 'C', pred: 13, actual: 2, verdict: '기대 이하' },
  { date: '20260624', gameId: 'D', pred: 5, actual: 68, verdict: '기대 이상' },
  { date: '20260624', gameId: 'E', pred: 62, actual: 39, verdict: '기대 이하' },
];
const preview = merged.slice(-5).reverse().map(r => ({ pred: r.pred, verdict: r.verdict }));
const ok = preview.length === 5 && preview[0].pred === 62 && preview[4].pred === 85;
console.log(ok ? 'PASS' : 'FAIL', JSON.stringify(preview));
"
```

기대 출력: `PASS [{"pred":62,"verdict":"기대 이하"},{"pred":5,"verdict":"기대 이상"},{"pred":13,"verdict":"기대 이하"},{"pred":74,"verdict":"기대 이하"},{"pred":85,"verdict":"기대 이하"}]`

## Acceptance Criteria

- 검증 1: exit 0, 타입 에러 없음
- 검증 2: exit 0, /tmp/dugoutpick-web-export 생성됨
- 검증 3: exit 0
- 검증 4: "PASS" 출력

## AC 검증 방법

위 4가지 검증을 순서대로 실행하라.

모두 통과하면:
1. `/tasks/5-recap-preview/index.json`의 phase 4 status를 `"completed"`로 변경
2. `feat(recap-preview): phase 4 — ac-verify` 커밋

하나라도 실패하면:
- 실패한 검증을 진단하고 이전 phase 파일에서 어느 부분이 잘못됐는지 파악
- 수정할 수 없으면 status를 `"error"`로 변경하고 `"error_message"` 기록

## 주의사항

- 이 phase에서 코드를 수정하지 마라. 검증만 한다.
- 웹 export 실패 시 `/tmp/dugoutpick-web-export` 디렉토리 권한 문제일 수 있음 — 다른 경로로 시도.
- Windows 환경이므로 `/tmp/` 대신 `C:/Temp/` 사용 가능.
