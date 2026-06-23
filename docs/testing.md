# Testing Policy

> plan-and-build 의 "테스트 논의" 단계와 각 phase 의 AC(Acceptance Criteria) 가 따르는 기준.
> 핵심 원칙: **AC 는 헤드리스 환경에서 실제로 실행 가능한 커맨드여야 한다.** "동작해야 한다" 같은 추상 서술 금지.

## 현재 테스트 자산
- 전용 단위 테스트 프레임워크(jest 등)는 **아직 없다.** MVP 속도 우선 결정([adr.md](adr.md) ADR-012 맥락).
- 검증은 **타입 체크 + 번들 무결성 + 파이프라인 실행**으로 대체한다(디바이스 없이 가능).

## 검증 게이트 (phase AC 로 그대로 사용)

### 앱 (`app/`)
```bash
cd app
npx tsc --noEmit                                  # 타입·문법 오류 0
npx expo export --platform web --output-dir dist  # JS 번들 성공 = import/해상도/구문 오류 0
```
- `tsc --noEmit` 통과 = 타입 계약(`types.ts` ↔ data-schema) 일관.
- `expo export` 성공 = 모든 import 해상도/구문 정상(번들 가능).
- **헤드리스에서 앱 런타임 동작(실제 화면 렌더)은 검증하지 않는다** — 디바이스/에뮬레이터 필요. 위 두 커맨드가 phase 합격 기준.

### 파이프라인 (`data-pipeline/`)
```bash
node data-pipeline/build.mjs    # exit 0 + output/*.json 생성/갱신
```
- 외부 KBO 엔드포인트에 의존하므로 네트워크 실패 시 exit 1 은 "정상 방어"다(앱은 직전 JSON 유지). AC 작성 시 네트워크 불가 환경을 구분할 것.

## 정책
1. **Mock 보다 실제 데이터.** 단위 테스트를 도입한다면 KBO 응답을 통째로 mocking 하기보다, `data-pipeline/output/*.json` 실산출물이나 고정 fixture 로 `computeHonjam()` 등 순수 로직을 검증한다. UI 데이터 계약은 실제 JSON 으로 확인.
2. **순수 로직 우선.** 꿀잼지수 계산처럼 외부 의존 없는 순수 함수가 테스트 1순위 대상.
3. **회귀 방지.** 기존에 통과하던 `tsc --noEmit` / `expo export` 를 깨뜨리는 변경은 phase 실패로 간주.
4. **AC = 실행 가능한 커맨드.** 각 phase 는 위 게이트 중 해당하는 것을 명시적으로 포함한다.
