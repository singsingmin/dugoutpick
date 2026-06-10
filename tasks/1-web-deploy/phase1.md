# Phase 1: pwa-config

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `docs/adr.md` — 디자인 결정사항 (ADR-009/015: 팔레트 — 배경 #F3E9CE, 포레스트 그린 #34663F)
- `docs/prd.md` — 제품 개요 (앱명, 타깃 유저)
- `app/app.json` — 현재 Expo 설정 (phase 0에서 업데이트된 상태)

그리고 이전 phase의 작업물을 반드시 확인하라:

- `app/app.json` — phase 0에서 web 섹션이 추가된 상태 확인
- `app/package.json` — react-native-web, react-dom 설치 여부 확인
- `app/dist/index.html` — phase 0에서 생성된 웹 빌드 출력물 확인

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업 내용

### 목표
아이폰 Safari에서 "홈 화면에 추가"를 했을 때 앱처럼 동작하도록 PWA(Progressive Web App) 설정을 추가한다.
앱 이름: **오늘야구각**, 테마색: **#34663F**(포레스트 그린), 배경: **#F3E9CE**(크림)

### 1. app.json PWA 메타데이터 추가

`app/app.json`의 `"web"` 섹션에 아래 필드를 추가하라:

```json
"web": {
  "bundler": "metro",
  "output": "static",
  "baseUrl": "/dugoutpick",
  "favicon": "./assets/favicon.png",
  "name": "오늘야구각",
  "shortName": "오늘야구각",
  "description": "KBO 경기 꿀잼지수 추천 앱",
  "themeColor": "#34663F",
  "backgroundColor": "#F3E9CE",
  "lang": "ko"
}
```

이 설정은 Expo가 빌드 시 `manifest.json`을 자동 생성하는 데 사용된다.

### 2. 커스텀 web/index.html 템플릿 생성

`app/web/index.html` 파일을 생성하라. 아이폰에서 홈 화면 추가 시 네이티브 앱처럼 동작하려면 Apple 전용 meta 태그가 필요하다.

Expo Metro 웹 번들러의 `web/index.html` 템플릿 형식에 맞게 작성하라. 반드시 포함해야 할 내용:

**필수 Apple PWA meta 태그:**
```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="오늘야구각" />
```

**아이콘 링크 (홈화면 아이콘):**
```html
<link rel="apple-touch-icon" href="/dugoutpick/assets/icon.png" />
```

**테마 색상:**
```html
<meta name="theme-color" content="#34663F" />
```

Expo 54 Metro 웹 번들러의 index.html 템플릿은 `%%EXPO_HEAD%%` 플레이스홀더를 사용해 Expo가 자동으로 script 태그 등을 주입한다. Expo 공식 문서나 기존 Expo 앱의 web/index.html 형식을 참고해 올바른 플레이스홀더를 포함하라.

### 3. 빌드 재실행 및 검증

```bash
cd app
npx expo export --platform web
```

생성된 `app/dist/index.html`을 열어 아래를 확인:
- apple-mobile-web-app-capable meta 태그 존재
- apple-mobile-web-app-title meta 태그 존재
- manifest.json 링크 태그 존재

## Acceptance Criteria

`app/` 디렉토리에서:

```bash
npx expo export --platform web
```

그리고:
```bash
# dist/index.html에 apple PWA meta 태그 포함 확인
grep -c "apple-mobile-web-app-capable" dist/index.html
# 출력이 1 이상이어야 함

# manifest 링크 존재 확인
grep -c "manifest" dist/index.html
# 출력이 1 이상이어야 함
```

- `expo export --platform web` 종료 코드 0
- `dist/index.html`에 `apple-mobile-web-app-capable` 포함
- `dist/index.html`에 manifest 링크 포함

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/1-web-deploy/index.json`의 phase 1 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.
작업 중 사용자 개입이 반드시 필요한 상황이 발생하면 status를 `"blocked"`로, `"blocked_reason"` 필드에 사유를 기록하고 즉시 중단하라.

## 주의사항

- `app.json`의 `android`, `ios` 섹션은 절대 수정하지 마라.
- `app/web/index.html`을 새로 생성할 때, Expo가 자동 주입하는 스크립트/스타일 플레이스홀더(`%%EXPO_HEAD%%` 등)를 빠뜨리면 앱이 로딩되지 않는다. Expo 54 Metro 웹 번들러의 공식 템플릿 형식을 반드시 확인하라.
- `apple-touch-icon` href 경로에 `baseUrl`(`/dugoutpick`)을 포함해야 한다. 그렇지 않으면 아이콘이 로드되지 않는다.
- `app/` 디렉토리 밖의 파일(`.github/workflows/` 등)은 이 phase에서 수정하지 마라.
