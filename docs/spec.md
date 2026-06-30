# Spec — 라우트 · 데이터 모델 · 계약

> plan-and-build 의 주 참고서. 화면 전환의 전체 그림은 [flow.md](flow.md), JSON 필드의 정밀 정의는 [data-schema.md](data-schema.md), 코드 배치는 [code-architecture.md](code-architecture.md) 를 단일 출처로 둔다. 여기서는 "구현 시 합의된 계약"만 응집한다.

## 1. 시스템 경계
```
[GitHub Actions, 하루 5회 + 외부 cron 5분]
  data-pipeline/build.mjs → output/*.json → commit/push (raw)
                                   │ fetch(raw)
[Cloudflare Worker(cf-worker)] ←───┘  games.json에 KBO 실시간 점수/라이브 오버레이, 그 외 패스스루
                                   │ fetch(REMOTE_BASE_URL = Worker)
[Expo 앱(app/)] ←───────────────────┘  표시 전용. 꿀잼지수 재계산 금지.
```
- **앱은 읽기 전용 소비자.** 꿀잼지수·이유·관전포인트는 파이프라인이 이미 계산한 값을 그대로 표시한다(재계산 금지, ADR-004/005).
- **Worker는 라이브 오버레이 층**(ADR-018): 정적 games.json 위에 KBO 실시간 점수·상태(LIVE)·`live` 객체·취소사유만 덧씌운다. 꿀잼지수는 손대지 않음. KBO API 실패 시 정적 데이터 폴백.
- 파이프라인·Worker·앱은 **느슨하게 결합**: 스크래퍼가 깨져도 앱은 마지막 커밋 JSON / AsyncStorage 캐시로 생존, Worker가 죽어도 정적 데이터로 폴백.

## 2. 앱 라우트 (React Navigation)
native-stack + bottom-tabs 조합. 화면명은 `app/navigation/` 및 `app/screens/` 와 1:1.

| 라우트 | 종류 | 파라미터 | 역할 |
|---|---|---|---|
| `Splash` | stack | — | 픽셀 로고. 응원팀 저장 여부로 분기 |
| `Onboarding` | stack | — | 응원팀 선택(팀명+색상 그리드) → AsyncStorage 저장. 최초 1회 / 설정에서 재사용 |
| `Tabs` | bottom-tabs | — | 기본 진입 = `Today` |
| `Today` | tab | — | 추천 히어로(최고 꿀잼) + 지금 볼 각(LIVE) + 나머지 경기(꿀잼 높은 순) |
| `MyTeam` | tab | — | 피드형: 내 팀 다음경기 · 순위 · 최근결과 · 월요 리포트 |
| `Settings` | tab | — | 응원팀 변경 · 꿀잼지수 스킨 · 데이터 갱신시각 · 앱 정보 |
| `GameDetail` | stack | `gameId: string` | 꿀잼지수 / reason / points / 선발 매치업 / 양팀 rank / 라인업 / (FINAL)결산·피드백 |
| `Standings` | stack | — | 10팀 순위표 전체 |
| `SkinSelect` | stack | — | 꿀잼지수 배지 스킨 선택(유니폼 3종 + 전광판). 탭=즉시 적용 |

분기 규칙: `Splash`에서 AsyncStorage 응원팀 있으면 `Tabs`, 없으면 `Onboarding`. (상세 → [flow.md](flow.md))

## 3. 데이터 모델 (앱이 소비하는 정적 JSON 3종 + 파이프라인 누적 파일)
정밀 스키마·nullable 규칙은 [data-schema.md](data-schema.md). 계약 요약:

- **games.json** — 메인 데이터. `trackRecord`(롤링 적중률 집계, 옵셔널) + `recommendedGameId`(최고 꿀잼, null 가능) + `games[]`(각 경기 + `honjam{score,reason,points,factors,frozen?}` + `live`/`recap`/`decision`/`lineup`/`cancelReason`). `score`/`live`/`recap` 등 라이브·종료 필드는 **Worker가 오버레이**(ADR-018). `honjam`은 순위 매칭 실패 시 null. `trackRecord`는 표본 부족·구버전 시드에서 없을 수 있음(옵셔널) — 이 경우 배지는 '집계 중'.
- **standings.json** — 10팀 순위표. MyTeam / Standings 화면용.
- **recent.json** — 팀별 최근 경기 결과. MyTeam 피드 '최근 결과'용.
- **report.json** — 월요 리포트(지난주 결산 + 이번주 빅매치/일정). MondayReport용.
- **teams.json** — 구단 레퍼런스(코드·팀명·색상). 온보딩이 fetch 전에 필요 → **앱에 번들**(항상 동기 로드).
- **recap-history.json** (파이프라인 산출물, 앱은 직접 fetch 안 함) — 크로스데이트 누적 적중률. append-only. 롤링 집계값은 games.json의 `trackRecord`로 미러링돼 앱에 전달(별도 fetch 0).

타입은 `app/types.ts` 에 명문화(data-schema 미러). 스키마 변경 시 `types.ts` 와 data-schema.md 를 함께 갱신한다.

## 4. 피드백 시스템 (경기 후 사용자 평가)
- 경기 상세 화면(`GameDetail`)에서 `game.status === 'FINAL' && game.honjam != null` 조건일 때만 FeedbackWidget 노출
- 사용자가 👍/👎 선택 후 이유 태그(slug 기반)를 선택하면 AsyncStorage에 저장 + Discord 웹훅으로 전송
- AsyncStorage 키: `dugout.feedback.{gameId}` (게임별 개별 키)
- 피드백 데이터 구조:
  ```
  { gameId, predictedScore, thumbs: 'up'|'down', reasonTag: string|null, reasonLabel: string|null, ts: ISO8601 }
  ```
- Discord 전송 실패는 무음 처리 (앱 크래시 없음)
- 웹훅 URL: `app.config.js`의 `extra.discordWebhookUrl` 환경변수로 주입 (`.env.local` → `DISCORD_WEBHOOK_URL`)

## 4b. 꿀잼지수 배지 스킨 (ScoreSkin)
- `ScoreSkinRenderer`가 선택 스킨의 `kind`로 분기: `jersey`(유니폼 SVG, `JerseyScoreBadge`) / `scoreboard`(레트로 전광판, `ScoreboardScoreBadge`).
- 스킨 ID: `jersey.classic`/`jersey.pinstripe`/`jersey.cream`/`scoreboard.vintage` (`utils/scoreSkinConfig.ts` 단일 출처).
- AsyncStorage 키 `user.scoreSkinId`. 구키 `user.uniformPreset`은 `normalizeScoreSkinId()`가 `jersey.*`로 마이그레이션.
- 전역 상태는 `context/ScoreSkin.tsx`(Provider + `useScoreSkin`). 상세·제약 → ADR-019.

## 5. 데이터 로딩 계약 (`app/data/`)
- **dev/MVP 폴백**: `assets/data/*.json` 번들 import.
- **prod**: `data/config.ts` 의 `REMOTE_BASE_URL`(= Cloudflare Worker) 원격 fetch → 성공 시 AsyncStorage 캐시, 실패 시 마지막 캐시 → 번들 순 폴백.
- `teams.json`은 온보딩이 fetch 전에 필요하므로 항상 번들(동기) 로드.
- 환경 분기는 `data/config.ts` **한 곳**에만 격리.

## 6. 파이프라인 계약 (`data-pipeline/build.mjs`)
- 입력: KBO 3개 HTTP 엔드포인트(브라우저 불필요). 처리: 순위→지표맵 / 경기+선발 / 투수ERA맵 → `computeHonjam()`.
- 꿀잼지수 로직은 이 파일에 **응집**(앱과 공유 안 함). 공식 튜닝 시 앱 재배포 불필요.
- **실패 시 exit 1** → Actions 가 커밋 안 함 → 앱은 직전 JSON 유지.
- teams 단일 출처 = `data-pipeline/teams.mjs` → `teams.json`.
- **트랙레코드 누적:** FINAL 경기 중 `honjam.frozen===true`(경기 전 freeze된 예측)인 것만 `recap-history.json`에 append-only 누적. 롤링 집계(최근 window=50건)를 `games.json`의 `trackRecord`에 임베드해 앱에 전달(별도 네트워크 요청 0 증가).

## 7. 불변 규칙 (구현 시 깨지 말 것)
1. 꿀잼지수는 파이프라인 단일 출처. 앱·문서 어디서도 재구현 금지.
2. 앱은 데이터 표시 전용. 네트워크 실패가 크래시로 이어지면 안 됨(캐시 폴백 필수).
3. 외부 의존 최소화: 파이프라인 0개, 앱도 무거운 라이브러리 지양.
4. 데이터 산출물(`data-pipeline/output/*.json`, 앱 번들 JSON)은 Actions 가 자동 갱신 — 수동 재생성·커밋 금지(push 충돌 유발).
5. **트랙레코드 정직성 게이트:** 적중률 집계는 `frozen===true`(경기 전 freeze) 예측만 포함한다. post-hoc 재계산 예측은 영구 제외. `verdict===null`·`sampleSize < MIN_SAMPLE(10)` 상태는 앱에 노출 금지('집계 중' 표시).
