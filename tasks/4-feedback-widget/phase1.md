# Phase 1: infra

## 사전 준비

아래 범위만 읽어라:

- `app/app.json` 전체 (마이그레이션 베이스 — expo 설정 전체)
- `app/types.ts` L1-50 (Game, Honjam 타입 확인용)
- `tasks/4-feedback-widget/docs-diff.md` (Phase 0에서 변경된 문서 내용 빠르게 파악)

이전 phase 작업물:
- `docs/spec.md` — 피드백 시스템 섹션 (dugout.feedback.{gameId} 키, FeedbackEntry 구조) 확인

## 작업 내용

아래 5가지 작업을 순서대로 수행한다.

---

### 1. `app/app.json` → `app/app.config.js` 마이그레이션

`app/app.json`을 삭제하고, 동일 위치에 `app/app.config.js`를 생성한다.

기존 `app.json` 내용을 그대로 이전하되 `extra` 블록에 `discordWebhookUrl` 추가:

```js
// app/app.config.js
module.exports = {
  expo: {
    // ... 기존 app.json의 expo 블록 내용 그대로 ...
    extra: {
      eas: {
        projectId: "2dca77a5-dcf4-4759-863d-91e1cf81dcc7"
      },
      discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || null,
    }
  }
};
```

**중요**: `app.json`과 `app.config.js`가 동시에 존재하면 Expo가 `app.config.js`를 우선한다. 마이그레이션 후 `app.json`은 삭제해야 충돌이 없다.

---

### 2. `.env.local` 생성 + `.gitignore` 추가

프로젝트 루트(DugoutPick/)에 `.env.local` 파일 생성:
```
DISCORD_WEBHOOK_URL=your_webhook_url_here
```

루트 `.gitignore`에 `.env.local` 항목 추가 (이미 있으면 스킵):
```
.env.local
```

---

### 3. `app/services/feedback.ts` 신규 생성

아래 인터페이스와 함수를 구현한다.

**타입 정의:**
```typescript
export interface FeedbackTag {
  slug: string;       // 코드 내부 식별자 (예: 'score_gap')
  label: string;      // 표시용 한국어 (예: '점수 격차 너무 컸음')
  thumbs: 'up' | 'down';
}

export interface FeedbackEntry {
  gameId: string;
  predictedScore: number;
  thumbs: 'up' | 'down';
  reasonTag: string | null;   // FeedbackTag.slug, 기타/스킵 시 null
  reasonLabel: string | null; // FeedbackTag.label, 기타/스킵 시 null
  ts: string;                 // ISO8601
}
```

**태그 정의** (꿀잼지수 6요소에 대응):
```typescript
export const TAGS_DOWN: FeedbackTag[] = [
  { slug: 'score_gap',      label: '점수 격차 너무 컸음',  thumbs: 'down' },
  { slug: 'starter_change', label: '선발 교체됨',          thumbs: 'down' },
  { slug: 'low_tension',    label: '생각보다 루즈했음',    thumbs: 'down' },
  { slug: 'other_down',     label: '기타',                 thumbs: 'down' },
];

export const TAGS_UP: FeedbackTag[] = [
  { slug: 'dramatic_end',   label: '끝내기·역전 명경기',   thumbs: 'up' },
  { slug: 'ace_dominant',   label: '선발 투수 압도적',     thumbs: 'up' },
  { slug: 'close_game',     label: '박빙 접전',            thumbs: 'up' },
  { slug: 'other_up',       label: '기타',                 thumbs: 'up' },
];
```

**함수 시그니처 및 핵심 규칙:**

```typescript
const FEEDBACK_KEY = (gameId: string) => `dugout.feedback.${gameId}`;

// AsyncStorage에 피드백 저장 (append — 덮어쓰지 않음, 타임스탬프로 구분)
export async function saveFeedback(entry: FeedbackEntry): Promise<void>

// Discord 웹훅으로 전송 — 실패 시 무음 처리 (try/catch 필수, 예외 절대 밖으로 던지지 말 것)
// 웹훅 URL은 Constants.expoConfig?.extra?.discordWebhookUrl 에서 읽는다
// 메시지 포맷 (단순 텍스트):
// [피드백] {YYYY-MM-DD} {away} vs {home}
// 예측: {predictedScore}점 | 평가: {thumbsEmoji} {thumbsLabel}
// 이유: {reasonLabel ?? '(없음)'}
// gameId: {gameId} | ts: {ts}
export async function sendToDiscord(entry: FeedbackEntry, matchLabel: string): Promise<void>

// 해당 게임에 이미 피드백을 남겼는지 확인
// AsyncStorage에서 해당 키를 읽어 항목이 1개 이상 있으면 true
export async function hasFeedback(gameId: string): Promise<boolean>
```

**구현 시 주의**:
- `saveFeedback`은 기존 피드백 배열에 append (덮어쓰기 금지). 기존 값을 파싱해 배열에 push 후 저장.
- `sendToDiscord`는 반드시 `try/catch`로 감싸 예외를 삼킬 것. `console.error`로 로그는 남겨도 됨.
- `Constants.expoConfig?.extra?.discordWebhookUrl`이 null이면 전송을 조용히 스킵한다.
- `@react-native-async-storage/async-storage`는 이미 설치되어 있음 (기존 코드 참고).
- `expo-constants`는 이미 설치되어 있음.

---

### 4. `app/test/feedback.tags.test.mjs` 신규 생성

`app/test/` 디렉토리 생성 후 아래 테스트 파일을 작성한다.

태그 slug 유니크성을 검증하는 스크립트:
- TAGS_UP 내 모든 slug가 서로 유니크한지
- TAGS_DOWN 내 모든 slug가 서로 유니크한지
- TAGS_UP과 TAGS_DOWN 간 slug 교집합이 없는지

**중요**: 이 파일은 `.mjs`이고 TypeScript import가 불가능하다. 태그 배열을 이 파일 안에 동일하게 하드코딩하여 검증한다 (유지보수 비용을 감수하고 독립성 확보).

```js
// app/test/feedback.tags.test.mjs
import assert from 'node:assert';

// feedback.ts의 TAGS_* 와 동일한 값 — 변경 시 함께 업데이트
const TAGS_DOWN = [
  { slug: 'score_gap' },
  { slug: 'starter_change' },
  { slug: 'low_tension' },
  { slug: 'other_down' },
];
const TAGS_UP = [
  { slug: 'dramatic_end' },
  { slug: 'ace_dominant' },
  { slug: 'close_game' },
  { slug: 'other_up' },
];

// 유니크성 검증
const downSlugs = TAGS_DOWN.map(t => t.slug);
assert.equal(new Set(downSlugs).size, downSlugs.length, 'TAGS_DOWN slug 중복');

const upSlugs = TAGS_UP.map(t => t.slug);
assert.equal(new Set(upSlugs).size, upSlugs.length, 'TAGS_UP slug 중복');

// 교집합 없음
const intersection = upSlugs.filter(s => downSlugs.includes(s));
assert.equal(intersection.length, 0, `TAGS_UP/DOWN slug 교집합 존재: ${intersection}`);

console.log('✓ 태그 slug 유니크성 검증 통과');
```

---

## Acceptance Criteria

```bash
# 1. 타입 체크
cd app && npx tsc --noEmit

# 2. 태그 slug 유니크성
node app/test/feedback.tags.test.mjs
```

## AC 검증 방법

위 2개 커맨드를 순서대로 실행하라. 모두 통과하면 `tasks/4-feedback-widget/index.json`의 phase 1 status를 `"completed"`로 변경하라.
3회 시도 후에도 실패하면 `"error"`로 변경하고 `error_message`를 기록하라.

## 주의사항

- `app.json`을 `app.config.js`로 교체한 뒤 `app.json`은 반드시 삭제하라 — 둘 다 존재하면 Expo가 `app.config.js`를 무시하거나 경고를 낸다.
- `.env.local`에 실제 웹훅 URL을 넣지 마라 — placeholder로 두면 된다. 실제 URL 설정은 `docs/user-intervention.md`를 보고 사용자가 직접 입력.
- `app/services/feedback.ts`에서 `sendToDiscord`의 예외가 절대 외부로 나와선 안 된다. try/catch 누락 시 GameDetail 크래시로 이어짐.
- `data-pipeline/output/*.json`은 건드리지 마라.
- 기존 테스트(`data-pipeline/test/recap-history.test.mjs`)를 깨뜨리지 마라.
