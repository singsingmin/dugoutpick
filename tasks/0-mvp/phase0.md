# Phase 0: scaffold (프로젝트 토대)

## 사전 준비

먼저 아래 문서를 반드시 읽고 프로젝트의 아키텍처와 설계 의도를 완전히 이해하라:

- `docs/prd.md` — 제품 정의·목표·범위
- `docs/code-architecture.md` — 앱 폴더 구조, 기술 선택, Phase AC 전략 (★ 핵심)
- `docs/adr.md` — ADR-001(Expo), ADR-009(8비트 UI), ADR-012(TypeScript), ADR-013(Galmuri 폰트)
- `docs/data-schema.md` — games/standings/teams JSON 구조 (types.ts 작성 근거)

기존 산출물 확인:

- `data-pipeline/output/games.json`, `standings.json`, `teams.json` — 앱이 소비할 실데이터 (앱에 번들)
- `data-pipeline/teams.mjs` — 10구단 코드·색상 단일 출처
- `vendor/fonts/Galmuri11.ttf` — 미리 받아둔 8비트 한글 픽셀폰트 (app으로 복사할 것)

## 작업 내용

저장소 루트에 **`app/` 서브디렉토리**로 Expo(TypeScript) 앱을 생성하고 토대를 잡는다. 이 phase는 **화면 로직을 만들지 않는다** — 빌드 토대 + 디자인 토큰 + 타입 + 데이터/폰트 자산 준비까지만.

1. **Expo TS 앱 생성** (저장소 루트에서):
   ```bash
   npx create-expo-app@latest app --template blank-typescript
   ```
   생성 후 `app/`이 작업 루트. 이하 모든 경로는 `app/` 기준.

2. **의존성 설치** (`cd app` 후, 버전 호환 위해 반드시 `npx expo install` 사용):
   ```bash
   npx expo install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context @react-native-async-storage/async-storage expo-font
   ```

3. **폰트 자산 복사**: `vendor/fonts/Galmuri11.ttf` → `app/assets/fonts/Galmuri11.ttf` (디렉토리 생성 후 복사).

4. **번들 데이터 복사**: `data-pipeline/output/*.json`(games/standings/teams) → `app/assets/data/`. 이 JSON이 개발 중 데이터 소스(ADR-002, dev=번들).

5. **`app/types.ts` 작성** — `docs/data-schema.md`를 그대로 TS 타입으로 옮긴다. 최소 다음 타입을 export:
   - `Team { code: string; name: string; fullName: string; color: string }`
   - `Starter { name: string; era: number | null }`
   - `TeamSide { code: string; name: string; rank: number | null; score: number | null; starter: Starter | null }`
   - `Honjam { score: number; reason: string; points: string[]; factors: Record<string, number> }`
   - `Game { gameId: string; time: string; stadium: string; status: 'SCHEDULED'|'FINAL'|'CANCELED'; broadcast: string; away: TeamSide; home: TeamSide; honjam: Honjam | null }`
   - `GamesData { date: string; dateText: string; updatedAt: string; recommendedGameId: string | null; games: Game[] }`
   - `Standing { rank: number; code: string|null; name: string; games: number; win: number; loss: number; draw: number; winRate: number; gamesBehind: number; last10: string; streak: string; home: string; away: string }`
   - `StandingsData { updatedAt: string; standings: Standing[] }`
   - `TeamsData { teams: Team[] }`

6. **`app/theme.ts` 작성** — 8비트 도트 디자인 토큰 (ADR-009). 다음을 export:
   - `colors`: 어두운 배경 기반 팔레트. 최소 `bg`(짙은색), `surface`, `text`, `textDim`, `accent`(비비드), `border`, `good`/`bad` 등. 비비드·고대비.
   - `fonts`: `{ pixel: 'Galmuri11' }` (로드된 폰트 패밀리명).
   - `border`: 8비트용 두꺼운 각진 테두리 값 (`width`, `radius: 0`).
   - `spacing`: 4의 배수 스케일.
   - `honjamColor(score: number): string` — 점수대별 색(높을수록 뜨거운 색) 헬퍼.

7. **`app/App.tsx` 수정** — `expo-font`의 `useFonts`로 `Galmuri11`을 로드. 로드 전엔 `null`(혹은 빈 View) 반환, 로드 후엔 임시 화면(중앙에 `theme.fonts.pixel`을 적용한 `<Text>오늘야구각</Text>`, 배경 `colors.bg`) 렌더. 네비게이션은 다음 phase에서 붙이므로 여기선 단일 화면이면 충분.

## Acceptance Criteria

```bash
cd app
npx tsc --noEmit
```

추가 확인(통과 필수):
```bash
test -f app/assets/fonts/Galmuri11.ttf
test -f app/assets/data/games.json
test -f app/assets/data/standings.json
test -f app/assets/data/teams.json
test -f app/types.ts
test -f app/theme.ts
```

## AC 검증 방법

위 커맨드를 실행하라. `tsc --noEmit`이 에러 0으로 통과하고 모든 `test -f`가 성공하면 `tasks/0-mvp/index.json`의 phase 0 status를 `"completed"`로 변경하라.
3회 이상 수정해도 실패하면 status를 `"error"`로, 에러 내용을 `"error_message"`에 기록하라.
사용자 개입이 반드시 필요한 상황(네트워크 차단으로 패키지 설치 불가 등)이면 status를 `"blocked"`, `"blocked_reason"`에 사유를 기록하고 중단하라.

## 주의사항

- **화면/네비게이션 로직을 만들지 마라.** 이 phase는 토대까지만. screens/, components/, data/ 폴더 로직은 다음 phase 담당.
- `npm install`로 네비게이션 패키지를 직접 설치하지 마라. 반드시 `npx expo install`로 — Expo SDK 호환 버전을 보장해야 런타임 에러가 안 난다.
- 폰트 패밀리명은 정확히 `Galmuri11`로 통일하라(theme.fonts.pixel과 useFonts 키 일치). 불일치 시 텍스트가 시스템 폰트로 깨진다.
- 번들 JSON은 `app/assets/data/`에 두고, `resolveJsonModule`이 tsconfig에 켜져 있어야 import 가능 — 필요시 `app/tsconfig.json`에 `"resolveJsonModule": true, "esModuleInterop": true` 추가.
- 기존 create-expo-app이 생성한 설정을 불필요하게 갈아엎지 마라.
