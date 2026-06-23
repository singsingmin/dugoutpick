# Spec — 라우트 · 데이터 모델 · 계약

> plan-and-build 의 주 참고서. 화면 전환의 전체 그림은 [flow.md](flow.md), JSON 필드의 정밀 정의는 [data-schema.md](data-schema.md), 코드 배치는 [code-architecture.md](code-architecture.md) 를 단일 출처로 둔다. 여기서는 "구현 시 합의된 계약"만 응집한다.

## 1. 시스템 경계
```
[GitHub Actions, 하루 5회 + 외부 cron 5분]
  data-pipeline/build.mjs → output/*.json → commit/push
                                   │ fetch(raw URL / GitHub Pages)
[Expo 앱(app/)] ←───────────────────┘  표시 전용. 꿀잼지수 재계산 금지.
```
- **앱은 읽기 전용 소비자.** 꿀잼지수·이유·관전포인트는 파이프라인이 이미 계산한 값을 그대로 표시한다(재계산 금지, ADR-004/005).
- 파이프라인과 앱은 **느슨하게 결합**: 스크래퍼가 깨져도 앱은 마지막 커밋 JSON / AsyncStorage 캐시로 생존.

## 2. 앱 라우트 (React Navigation)
native-stack + bottom-tabs 조합. 화면명은 `app/navigation/` 및 `app/screens/` 와 1:1.

| 라우트 | 종류 | 파라미터 | 역할 |
|---|---|---|---|
| `Splash` | stack | — | 픽셀 로고. 응원팀 저장 여부로 분기 |
| `Onboarding` | stack | — | 응원팀 선택(팀명+색상 그리드) → AsyncStorage 저장. 최초 1회 / 설정에서 재사용 |
| `Tabs` | bottom-tabs | — | 기본 진입 = `Today` |
| `Today` | tab | — | 추천 히어로(최고 꿀잼) + 나머지 경기(꿀잼 높은 순) |
| `MyTeam` | tab | — | 피드형: 내 팀 다음경기 · 순위 · 최근결과 |
| `Settings` | tab | — | 응원팀 변경 · 데이터 갱신시각 · 앱 정보 |
| `GameDetail` | stack | `gameId: string` | 꿀잼지수 / reason / points / 선발 매치업 / 양팀 rank |

분기 규칙: `Splash`에서 AsyncStorage 응원팀 있으면 `Tabs`, 없으면 `Onboarding`. (상세 → [flow.md](flow.md))

## 3. 데이터 모델 (앱이 소비하는 정적 JSON 3종)
정밀 스키마·nullable 규칙은 [data-schema.md](data-schema.md). 계약 요약:

- **games.json** — 메인 데이터. `recommendedGameId`(최고 꿀잼, null 가능) + `games[]`(각 경기 + `honjam{score,reason,points,factors}`). `score`는 경기 전 null, `starter`/`era`는 미등록 시 null, `honjam`은 순위 매칭 실패 시 null.
- **standings.json** — 10팀 순위표. MyTeam / 순위 표시용.
- **teams.json** — 구단 레퍼런스(코드·팀명·색상). 온보딩이 fetch 전에 필요 → **앱에 번들**.

타입은 `app/types.ts` 에 명문화(data-schema 미러). 스키마 변경 시 `types.ts` 와 data-schema.md 를 함께 갱신한다.

## 4. 데이터 로딩 계약 (`app/data/`)
- **dev/MVP**: `assets/data/*.json` 번들 import.
- **prod**: `data/config.ts` 의 `REMOTE_BASE_URL` 원격 fetch → 성공 시 AsyncStorage 캐시, 실패 시 마지막 캐시 폴백.
- 환경 분기는 `data/config.ts` **한 곳**에만 격리.

## 5. 파이프라인 계약 (`data-pipeline/build.mjs`)
- 입력: KBO 3개 HTTP 엔드포인트(브라우저 불필요). 처리: 순위→지표맵 / 경기+선발 / 투수ERA맵 → `computeHonjam()`.
- 꿀잼지수 로직은 이 파일에 **응집**(앱과 공유 안 함). 공식 튜닝 시 앱 재배포 불필요.
- **실패 시 exit 1** → Actions 가 커밋 안 함 → 앱은 직전 JSON 유지.
- teams 단일 출처 = `data-pipeline/teams.mjs` → `teams.json`.

## 6. 불변 규칙 (구현 시 깨지 말 것)
1. 꿀잼지수는 파이프라인 단일 출처. 앱·문서 어디서도 재구현 금지.
2. 앱은 데이터 표시 전용. 네트워크 실패가 크래시로 이어지면 안 됨(캐시 폴백 필수).
3. 외부 의존 최소화: 파이프라인 0개, 앱도 무거운 라이브러리 지양.
4. 데이터 산출물(`data-pipeline/output/*.json`, 앱 번들 JSON)은 Actions 가 자동 갱신 — 수동 재생성·커밋 금지(push 충돌 유발).
