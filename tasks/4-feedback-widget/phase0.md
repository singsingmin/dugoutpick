# Phase 0: docs

## 사전 준비

아래 범위만 읽어라:

- `docs/spec.md` 전체 (시스템 경계·AsyncStorage 키·데이터 흐름 파악용)
- `docs/roadmap.md` 전체 (B항 꿀잼지수 튜닝, C항 기술 부채 내용 확인)
- `docs/user-intervention.md` 전체 (기록 형식 + 기존 항목 파악)

이전 phase 없음 (첫 번째 phase).

## 작업 내용

아래 3개 문서를 수정한다. 새 파일 생성 없음.

---

### 1. `docs/spec.md` — 피드백 시스템 섹션 추가

"데이터 로딩 전략" 또는 "AsyncStorage 키" 섹션 근처에 아래 내용을 추가한다.

**추가할 내용:**

피드백 시스템 (경기 후 사용자 평가):
- 경기 상세 화면(`GameDetail`)에서 `game.status === 'FINAL' && game.honjam != null` 조건일 때만 FeedbackWidget 노출
- 사용자가 👍/👎 선택 후 이유 태그(slug 기반)를 선택하면 AsyncStorage에 저장 + Discord 웹훅으로 전송
- AsyncStorage 키: `dugout.feedback.{gameId}` (게임별 개별 키)
- 피드백 데이터 구조:
  ```
  { gameId, predictedScore, thumbs: 'up'|'down', reasonTag: string|null, reasonLabel: string|null, ts: ISO8601 }
  ```
- Discord 전송 실패는 무음 처리 (앱 크래시 없음)
- 웹훅 URL: `app.config.js`의 `extra.discordWebhookUrl` 환경변수로 주입 (`.env.local` → `DISCORD_WEBHOOK_URL`)

---

### 2. `docs/roadmap.md` — 2곳 수정

**B. 데이터·정확도 항목에 추가:**

```
- [ ] **꿀잼지수 가중치 튜닝** — 피드백 데이터 누적(👍👎 + 이유 태그) 후 진행.
  튜닝 개시 기준: 피드백 표본 30건 이상 누적 시. reasonTag 분포로 어느 요소 가중치가 실제 체감과 어긋나는지 판단.
```

**C. 기술 부채 항목에 추가:**

```
- [ ] **Play Store 공개 전 Discord 웹훅 재검토** — 현재 APK 번들에 웹훅 URL 포함(2명 내부 테스터용). 공개 배포 전 서버 프록시 또는 웹훅 전용 채널 교체 필요.
```

---

### 3. `docs/user-intervention.md` — 새 항목 추가

기존 항목 아래에 아래 항목을 추가한다:

```
### 2026-06-24 피드백 웹훅 — Discord 웹훅 URL 생성 + .env.local 설정
- 상황: Discord 웹훅 URL은 CLI로 생성 불가(Discord 웹 UI 필요). `.env.local`에 수동 입력 필요.
- 필요한 수동 조치:
  1. Discord에서 비공개 채널 생성 (예: #dugoutpick-feedback)
  2. 채널 설정 → 연동 → 웹훅 → 새 웹훅 생성 → URL 복사
  3. 프로젝트 루트에 `.env.local` 파일 생성:
     ```
     DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
     ```
  4. `.env.local`이 `.gitignore`에 포함되어 있는지 확인 (Phase 1에서 자동 추가됨)
  5. 이후 EAS 빌드 시 환경변수 주입 필요 (eas.json 또는 빌드 시 --env 플래그)
- 차단 여부: blocking — 이 설정 없이는 피드백 전송 기능이 동작하지 않음 (저장은 되나 Discord 전송 안 됨).
```

---

## Acceptance Criteria

```bash
# 문서 수정 확인 (문법 이상 없음, 내용 누락 없음)
node -e "
const fs = require('fs');
const spec = fs.readFileSync('docs/spec.md', 'utf8');
const roadmap = fs.readFileSync('docs/roadmap.md', 'utf8');
const ui = fs.readFileSync('docs/user-intervention.md', 'utf8');
if (!spec.includes('dugout.feedback.')) throw new Error('spec.md: 피드백 AsyncStorage 키 누락');
if (!roadmap.includes('피드백 표본 30건')) throw new Error('roadmap.md: 튜닝 기준 누락');
if (!roadmap.includes('Play Store 공개 전 Discord 웹훅 재검토')) throw new Error('roadmap.md: 웹훅 재검토 항목 누락');
if (!ui.includes('DISCORD_WEBHOOK_URL')) throw new Error('user-intervention.md: 웹훅 설정 가이드 누락');
console.log('✓ 모든 문서 업데이트 확인');
"
```

## AC 검증 방법

위 커맨드를 실행하라. 통과하면 `tasks/4-feedback-widget/index.json`의 phase 0 status를 `"completed"`로 변경하라.
3회 시도 후에도 실패하면 `"error"`로 변경하고 `error_message`를 기록하라.

## 주의사항

- 기존 문서의 다른 내용을 변경하지 마라 — 이 phase는 추가만 한다.
- `docs-diff.md`는 `scripts/gen-docs-diff.py`가 자동 생성하므로 직접 작성하지 마라.
- `data-pipeline/output/*.json`은 건드리지 마라.
