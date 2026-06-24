# Phase 5: 앱 화면 통합 — Today + Settings에 트랙레코드 배지 노출

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `docs/spec.md` — 앱 라우트(§2), 데이터 로딩 계약(§4), 트랙레코드 노출 규칙
- `docs/data-schema.md` — `games.json` `trackRecord`
- `docs/code-architecture.md` — 앱 폴더 구조, 8비트 테마
- `docs/testing.md` — 앱 AC(`tsc --noEmit` + `expo export`), dev 시드 trackRecord-없음 = '집계 중' 정상
- `tasks/2-track-record/docs-diff.md` — 이번 task의 문서 변경 기록

그리고 직전 phase 산출물을 반드시 읽어라:

- `app/types.ts` — `TrackRecord`, `GamesData.trackRecord?`, `Honjam.frozen?`(phase 4 추가분)
- `app/components/TrackRecordBadge.tsx` — phase 4가 만든 배지(Props: `track?`, `variant?: 'today'|'settings'`)

그리고 연결 대상 화면의 현재 구조를 읽고 일관성을 맞춰라:

- `app/screens/Today.tsx` — `loadGames()`로 `GamesData` 로드, `Body`에서 날짜행(dateRow) 렌더. 섹션 스타일 패턴.
- `app/screens/Settings.tsx` — `loadGames()`로 `updatedAt`만 가져옴. '데이터' 섹션(SectionLabel + Panel).
- `app/components/SectionLabel.tsx`, `app/components/Panel.tsx`, `app/theme.ts`(spacing/colors)

## 작업 내용

phase 4의 `TrackRecordBadge`를 두 화면에 연결한다. 데이터는 이미 로드되는 `GamesData.trackRecord`에서 읽는다(새 fetch·새 로더 추가 금지).

### 1) `app/screens/Today.tsx`
- `Body`는 이미 `data: GamesData`를 받는다. `data.trackRecord`를 `TrackRecordBadge`에 넘겨라.
- **배치:** 날짜행(`styles.dateRow`, "갱신 …" 줄) **바로 아래**, 첫 섹션(liveGames/finished/recommended) 위에 `<TrackRecordBadge track={data.trackRecord} variant="today" />`를 렌더. (Today 상단 신뢰 배지)
- import 추가: `import TrackRecordBadge from '../components/TrackRecordBadge';`
- 월요 리포트 분기(`isKstMonday()`)는 별도 early-return이라 배지를 안 넣어도 된다(평일 Today 본문에만).

### 2) `app/screens/Settings.tsx`
- 현재 `loadGames().then(d => setUpdatedAt(d.updatedAt))` 으로 updatedAt만 쓴다. 이를 확장해 `trackRecord`도 state로 보관하라:
  - `const [track, setTrack] = useState<TrackRecord | null>(null);`
  - useEffect 안에서 `loadGames().then(d => { active && setUpdatedAt(d.updatedAt); active && setTrack(d.trackRecord ?? null); })`. (한 번의 loadGames로 둘 다 — 추가 fetch 금지)
  - import: `import type { TrackRecord } from '../types';`, `import TrackRecordBadge from '../components/TrackRecordBadge';`
- **배치:** '데이터' 섹션(갱신 시각 Panel) 안 또는 바로 아래에 `<TrackRecordBadge track={track} variant="settings" />` 렌더. settings variant라 bonusRate('기대 이상 N%')까지 부가 노출된다.

데이터가 아직 로딩 중(`null`)이거나 `trackRecord`가 없으면 배지는 phase 4 규칙대로 '집계 중'을 보여준다(추가 분기 불필요 — 컴포넌트가 처리).

## Acceptance Criteria

```bash
cd app && npx tsc --noEmit
cd app && npx expo export --platform web --output-dir dist
```

## AC 검증 방법

`tsc --noEmit`이 오류 0으로 통과하고, `expo export --platform web`이 번들 성공(에러 없이 dist 생성)하면 통과. 두 커맨드 모두 통과하면 `tasks/2-track-record/index.json`의 phase 5 status를 `"completed"`로 변경하라. 3회 시도 후에도 실패하면 status를 `"error"`로 바꾸고 `error_message`를 기록하라.

## 주의사항

- 새 데이터 로더·새 fetch 경로를 만들지 마라 — `data.trackRecord`(이미 로드되는 games.json)에서만 읽는다.
- `app/data/load.ts`·`config.ts`를 수정하지 마라(games.json에 임베드돼 있으므로 기존 로더로 충분).
- `app/assets/data/*.json`(번들 시드)을 수동 수정·재생성하지 마라(Actions 자동 갱신, 수동 금지). 시드에 trackRecord가 없어 dev에서 '집계 중'이 떠도 정상이다.
- Today의 월요 리포트 early-return 경로를 깨뜨리지 마라.
- 기존 `tsc --noEmit` / `expo export` 통과를 깨뜨리지 마라. 회귀 시 phase 실패.
- `expo export`가 무겁다 — 30분 phase 타임아웃 안에 끝나야 한다. 불필요한 의존성 추가 금지.
