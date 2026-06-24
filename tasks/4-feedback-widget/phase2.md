# Phase 2: ui

## 사전 준비

아래 범위만 읽어라:

- `app/services/feedback.ts` 전체 (Phase 1 산출물 — FeedbackEntry, TAGS_UP, TAGS_DOWN, saveFeedback, sendToDiscord, hasFeedback 시그니처)
- `app/screens/GameDetail.tsx` 전체 (현재 레이아웃 + 데이터 로딩 방식 파악)
- `app/theme.ts` 전체 (색상·spacing 확인용)
- `app/types.ts` Game 타입 (status 필드, honjam 필드 — 약 L1-60)
- `tasks/4-feedback-widget/docs-diff.md` (Phase 0 문서 변경 내용 빠르게 파악)

## 작업 내용

아래 2가지 작업을 순서대로 수행한다.

---

### 1. `app/components/FeedbackWidget.tsx` 신규 생성

경기 후 피드백 UI 컴포넌트. GameDetail에서 임포트한다.

**Props:**
```typescript
interface FeedbackWidgetProps {
  gameId: string;
  predictedScore: number;
  matchLabel: string;  // Discord 메시지용 "원정팀 vs 홈팀" 문자열
}
```

**State machine (이 순서를 반드시 지킬 것):**
```
idle → thumbs_select → tag_select → submitting → done
```
- `idle`: 초기 상태. 컴포넌트 마운트 시 `hasFeedback(gameId)`를 호출해 이미 피드백이 있으면 바로 `done`으로 전환.
- `thumbs_select`: 👍 / 👎 선택 화면. 선택하면 `tag_select`로 전환.
- `tag_select`: 선택한 thumbs에 맞는 태그 목록 표시 (TAGS_UP 또는 TAGS_DOWN). 태그 하나 선택 시 `submitting`으로 전환.
- `submitting`: "저장 중..." 표시. 이 상태에서 모든 버튼 비활성화 (더블 탭 방지). `saveFeedback` + `sendToDiscord` 호출 후 `done`으로 전환.
- `done`: "피드백 감사해요 👋" 또는 선택한 이모지 표시. 재투표 UI 없음 (UI 상 완료 상태 고정).

**핵심 규칙:**
- `submitting` 상태에서는 모든 TouchableOpacity/Pressable이 비활성화되어야 한다 (더블 탭 방지).
- `sendToDiscord` 실패가 사용자에게 노출되지 않아야 한다 (done 상태로 정상 전환).
- 태그 선택 없이 스킵 가능한 UI는 제공하지 않는다 — 반드시 태그 하나를 선택해야 제출됨 (기타 포함).
- 스타일은 `theme.ts`의 색상·spacing을 사용한다. 레트로 8비트 스타일 앱과 일관되게.

**Discord 전송 시 `matchLabel` 사용:**
- `sendToDiscord(entry, matchLabel)` 호출 시 `matchLabel`을 전달해 메시지에 "원정팀 vs 홈팀" 표시.

---

### 2. `app/screens/GameDetail.tsx` 수정

**수정 위치:** 기존 UI 최하단 (관전포인트·꿀잼 근거 블록 아래).

**추가 조건:**
```typescript
{game.status === 'FINAL' && game.honjam != null && (
  <FeedbackWidget
    gameId={game.gameId}
    predictedScore={game.honjam.score}
    matchLabel={`${game.away.name} vs ${game.home.name}`}
  />
)}
```

**중요**: `game.status !== 'FINAL'` 또는 `game.honjam === null`이면 FeedbackWidget을 절대 렌더하지 않는다.

---

## Acceptance Criteria

```bash
# 1. 타입 체크
cd app && npx tsc --noEmit

# 2. 번들 무결성
cd app && npx expo export --platform web --output-dir dist
```

## 수동 QA 항목 (디바이스/Expo Go — phase 블로커 아님)

아래 항목은 헤드리스에서 검증 불가하다. 수동 확인 필요하지만 phase 합격에 필수는 아님:

- [ ] `game.status === 'FINAL' && game.honjam` 조건 만족 시 FeedbackWidget 렌더됨
- [ ] `game.status !== 'FINAL'` 또는 `game.honjam === null` 시 FeedbackWidget 미렌더
- [ ] 👍 선택 → TAGS_UP 태그 4개 표시
- [ ] 👎 선택 → TAGS_DOWN 태그 4개 표시
- [ ] 태그 선택 → submitting 상태 (버튼 비활성화) → done 상태
- [ ] done 상태에서 GameDetail 재진입 시 done 상태 유지 (hasFeedback 체크)
- [ ] Discord 전송 실패 시 앱 크래시 없음 (네트워크 끊고 테스트)

## AC 검증 방법

위 자동 AC 2개 커맨드를 순서대로 실행하라. 모두 통과하면 `tasks/4-feedback-widget/index.json`의 phase 2 status를 `"completed"`로 변경하라.
3회 시도 후에도 실패하면 `"error"`로 변경하고 `error_message`를 기록하라.

## 주의사항

- `GameDetail.tsx`의 기존 레이아웃(꿀잼지수·선발·관전포인트·근거 블록)을 건드리지 마라 — FeedbackWidget은 최하단에 추가만 한다.
- `FeedbackWidget`에서 `sendToDiscord` 실패가 state machine을 `done`으로 전환하지 못하게 막으면 안 된다 — 실패해도 `done`으로 전환해야 사용자가 막히지 않는다.
- `app/test/feedback.tags.test.mjs`의 TAGS 하드코딩 값이 `feedback.ts`의 TAGS_*와 일치하는지 확인하라 (Phase 1에서 slug를 바꿨다면 테스트 파일도 함께 업데이트).
- `data-pipeline/output/*.json`은 건드리지 마라.
- 기존 테스트(`data-pipeline/test/recap-history.test.mjs`)를 깨뜨리지 마라.
