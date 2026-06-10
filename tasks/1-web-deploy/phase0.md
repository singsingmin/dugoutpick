# Phase 0: web-build

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `docs/code-architecture.md` — 코드 아키텍처 (앱 구조, 데이터 흐름)
- `docs/adr.md` — 기술 결정사항 (Expo 선택 이유, 서버리스 설계)
- `app/package.json` — 현재 의존성 현황
- `app/app.json` — 현재 Expo 설정

이전 phase 없음 (첫 번째 phase).

## 작업 내용

### 목표
Expo 앱이 웹 브라우저에서 정상 빌드되도록 의존성과 설정을 추가한다.
최종 배포 URL: `https://singsingmin.github.io/dugoutpick/`

### 1. 웹 의존성 설치

`app/` 디렉토리에서 아래 패키지를 설치하라:
- `react-native-web` — RN 컴포넌트를 웹 DOM으로 변환하는 핵심 라이브러리
- `react-dom` — React 웹 렌더러 (현재 설치된 react 버전과 맞춰서 설치)

```bash
cd app
npm install react-native-web react-dom
```

### 2. app.json 웹 설정 업데이트

`app/app.json`의 `"web"` 섹션을 아래와 같이 교체하라:

```json
"web": {
  "bundler": "metro",
  "output": "static",
  "baseUrl": "/dugoutpick",
  "favicon": "./assets/favicon.png"
}
```

- `bundler: "metro"`: Expo 54 기본 웹 번들러
- `output: "static"`: 정적 파일 export (GitHub Pages 배포용)
- `baseUrl: "/dugoutpick"`: GitHub Pages 경로 (`singsingmin.github.io/dugoutpick/`)에 필수

### 3. .gitignore에 dist 폴더 추가

루트의 `.gitignore` 파일(없으면 `app/.gitignore`)에 아래를 추가하라:

```
app/dist/
```

빌드 산출물은 git으로 추적하지 않는다. GitHub Actions가 CI에서 빌드 후 gh-pages 브랜치에 배포한다.

### 4. 웹 빌드 실행 및 오류 수정

`app/` 디렉토리에서 웹 export를 실행하라:

```bash
cd app
npx expo export --platform web
```

빌드 오류가 발생하면 원인을 분석하고 수정하라. 예상 가능한 오류 유형과 대응:

- **모듈 not found**: 누락된 웹 호환 패키지 추가 설치
- **StyleSheet 비호환 속성**: 해당 속성을 `Platform.select({ web: ..., default: ... })`로 분기
- **native-only API 사용**: `Platform.OS === 'web'` 조건으로 분기 또는 빈 구현 제공
- **폰트 로드 실패**: expo-font는 웹에서 CSS font-face로 동작하므로 별도 수정 불필요한 경우가 많음

수정 후 재빌드하여 통과할 때까지 반복 (최대 3회 시도).

## Acceptance Criteria

`app/` 디렉토리에서 아래 명령 실행:

```bash
npx expo export --platform web
```

- 종료 코드 0 (에러/경고로 인한 비정상 종료 없음)
- `app/dist/index.html` 파일 존재
- `app/dist/_expo/` 또는 `app/dist/assets/` 디렉토리 존재 (JS 번들/에셋 포함 확인)

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/1-web-deploy/index.json`의 phase 0 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.
작업 중 사용자 개입이 반드시 필요한 상황(API key 제공, 외부 서비스 인증, 수동 설정 등)이 발생하여 직접 해결이 불가능하면 status를 `"blocked"`로, `"blocked_reason"` 필드에 사유를 구체적으로 기록하고 작업을 즉시 중단하라.

## 주의사항

- `app/` 디렉토리 밖의 파일(`.github/workflows/`, `data-pipeline/` 등)은 이 phase에서 절대 수정하지 마라.
- `app.json`의 `android`, `ios` 섹션은 절대 수정하지 마라. 기존 APK 빌드 설정을 보존해야 한다.
- `baseUrl: "/dugoutpick"` 값은 절대 변경하지 마라. GitHub Pages URL 구조에 직접 영향을 준다.
- `npm install` 은 반드시 `app/` 디렉토리에서 실행하라 (루트 디렉토리에 package.json 없음).
- `app/dist/` 폴더를 git에 커밋하지 마라. `.gitignore` 처리 후 빌드 결과물이 스테이징되지 않는지 확인하라.
