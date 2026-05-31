# Phase 6: integration (통합 · 마감 · 최종 검증)

## 사전 준비

먼저 아래 문서를 반드시 읽어라:

- `docs/flow.md` — 전체 사용자 흐름 E2E (이 흐름이 끊김 없이 연결되는지 점검)
- `docs/prd.md` — 완료 기준 (이 phase에서 충족 여부 확인)
- `docs/code-architecture.md` — Phase AC 전략(여기서 `expo export`까지 수행)

이전 phase 산출물 전체를 확인하라:

- `app/App.tsx`, `app/navigation/*`, `app/screens/*`(전부), `app/components/*`, `app/data/*`, `app/theme.ts`, `app/types.ts`

## 작업 내용

지금까지 만든 조각을 하나의 동작하는 앱으로 통합하고 마감한다. **새 기능을 추가하지 말고**, 연결·일관성·견고성·마감에 집중하라.

1. **흐름 연결 점검**(flow.md 기준): Splash→(분기)→Onboarding/Tabs, Today→GameDetail, MyTeam→GameDetail, Settings→Onboarding→Tabs. 끊긴 네비게이션·잘못된 param·타입 불일치가 있으면 고친다.

2. **빈 상태/에러 상태 일관화**: 데이터 없음(경기 없는 날), 응원팀 없음, 로딩 실패 시 앱이 죽지 않고 8비트 톤의 안내를 보이도록 모든 화면 점검.

3. **8비트 톤 일관성 점검**: 모든 화면이 `theme.ts` 토큰을 쓰는지, 픽셀 폰트가 적용되는지, 이미지 사용이 없는지(ADR-009) 확인. 시스템 폰트로 깨지는 텍스트가 있으면 `PixelText`로 교체.

4. **안전 영역**: `react-native-safe-area-context`로 노치/하단 영역 처리(헤더·탭바·콘텐츠 겹침 방지).

5. **앱 메타**: `app/app.json`의 앱 이름을 "오늘야구각"으로, slug/버전 정리. (네이티브 스플래시/아이콘 자산 제작은 범위 밖 — 기본값 유지 가능.)

6. **README**: 저장소 루트에 `app/README.md` 생성 — 앱 실행법(`cd app && npx expo start`, Expo Go QR로 실폰 테스트), 데이터 소스(번들 JSON, 원격 전환은 `data/config.ts`), 폴더 구조 요약.

## Acceptance Criteria

```bash
cd app
npx tsc --noEmit
npx expo export --platform ios --output-dir dist
```
- `tsc --noEmit`: 타입/문법 에러 0.
- `expo export`: JS 번들이 에러 없이 생성(import/모듈 해상도/구문 오류 0). `dist/`는 .gitignore에 포함되어 있으니 커밋되지 않는다.

추가:
```bash
test -f app/README.md
```

## AC 검증 방법

위 커맨드 실행. `tsc --noEmit`과 `expo export`가 모두 성공하고 `README.md`가 존재하면 phase 6 status를 `"completed"`로 변경. 3회 이상 실패 시 `"error"` + `"error_message"`. 개입 필요 시 `"blocked"` + `"blocked_reason"`.

## 주의사항

- **새 화면/기능을 추가하지 마라.** 이 phase는 통합·마감·검증 전용.
- `expo export`가 실패하면 대개 이전 phase의 import 경로 오류·미설치 패키지·플랫폼 비호환 모듈이 원인 — 새 코드를 쓰지 말고 원인을 추적해 수정하라.
- 디바이스에서의 실제 렌더링(UI 픽셀 단위 검증)은 이 phase의 AC가 아니다(사람이 Expo Go로 확인, ADR-014). 번들이 깨지지 않는 선까지가 자동 검증 범위.
- 기존 화면 로직을 불필요하게 재작성하지 마라. 연결과 버그 수정에 한정.
