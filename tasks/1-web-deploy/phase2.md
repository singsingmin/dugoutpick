# Phase 2: github-deploy

## 사전 준비

먼저 아래 문서들을 반드시 읽고 프로젝트의 전체 아키텍처와 설계 의도를 완전히 이해하라:

- `docs/code-architecture.md` — 데이터 파이프라인 구조 (GitHub Actions 기반)
- `.github/workflows/update-data.yml` — 기존 워크플로 패턴 참고 (concurrency, permissions 설정 방식)

그리고 이전 phase의 작업물을 반드시 확인하라:

- `app/app.json` — web 섹션 (baseUrl: "/dugoutpick" 확인)
- `app/package.json` — react-native-web, react-dom 설치 여부 확인
- `app/web/index.html` — PWA 템플릿 존재 확인

이전 phase에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업 내용

### 목표
`app/` 코드가 변경될 때마다 자동으로 웹을 빌드하고 GitHub Pages(`gh-pages` 브랜치)에 배포하는 GitHub Actions 워크플로를 생성한다.
배포 후 접근 URL: `https://singsingmin.github.io/dugoutpick/`

### 1. GitHub Actions 워크플로 생성

`.github/workflows/deploy-web.yml` 파일을 생성하라.

**워크플로 설계 요건:**

- **트리거:**
  - `push` to `main` (paths: `app/**`) — 앱 코드 변경 시 자동 배포
  - `workflow_dispatch` — 수동 실행 (최초 배포 및 긴급 재배포용)

- **Node 버전:** 20 (기존 `update-data.yml`과 동일)

- **빌드 단계:**
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4` (node-version: '20')
  3. `npm ci` — `app/` 디렉토리에서 실행 (`working-directory: app`)
  4. `npx expo export --platform web` — `app/` 디렉토리에서 실행 (`working-directory: app`)

- **배포 단계:**
  - `peaceiris/actions-gh-pages@v4` 사용
  - `publish_dir`: `./app/dist` (빌드 산출물 경로)
  - `github_token`: `${{ secrets.GITHUB_TOKEN }}`
  - `enable_jekyll`: false (`.nojekyll` 파일 자동 생성 — `_expo/` 경로의 언더스코어 이슈 방지)

- **Permissions:**
  ```yaml
  permissions:
    contents: write
  ```

- **Concurrency:**
  ```yaml
  concurrency:
    group: deploy-web
    cancel-in-progress: true
  ```
  (중복 배포 방지 — 이전 배포 취소 후 새 배포 진행)

### 2. 워크플로 파일 구조 예시

```yaml
name: Deploy Web

on:
  push:
    branches: [main]
    paths:
      - 'app/**'
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: deploy-web
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        working-directory: app
        run: npm ci
      - name: Build web
        working-directory: app
        run: npx expo export --platform web
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./app/dist
          enable_jekyll: false
```

## Acceptance Criteria

아래 명령으로 워크플로 YAML 유효성 확인:

```bash
# YAML 파싱 오류 없음 확인 (python으로 체크)
python -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-web.yml'))" && echo "YAML valid"
```

그리고 빌드 자체가 정상 동작하는지 로컬에서 확인:

```bash
cd app && npx expo export --platform web
```

- YAML 파싱 오류 없음
- `expo export --platform web` 종료 코드 0
- `app/dist/index.html` 존재

## AC 검증 방법

위 AC 커맨드를 실행하라. 모두 통과하면 `/tasks/1-web-deploy/index.json`의 phase 2 status를 `"completed"`로 변경하라.
수정 3회 이상 시도해도 실패하면 status를 `"error"`로 변경하고, 에러 내용을 index.json의 해당 phase에 `"error_message"` 필드로 기록하라.
작업 중 사용자 개입이 반드시 필요한 상황이 발생하면 status를 `"blocked"`로, `"blocked_reason"` 필드에 사유를 기록하고 즉시 중단하라.

## 주의사항

- `.github/workflows/update-data.yml` 파일은 절대 수정하지 마라. 데이터 파이프라인 워크플로다.
- `enable_jekyll: false`(또는 `.nojekyll` 생성)를 반드시 포함하라. Expo 번들이 `_expo/` 경로를 사용하는데, Jekyll은 언더스코어로 시작하는 폴더를 무시한다.
- `publish_dir`은 `./app/dist`여야 한다. `app/` 서브디렉토리에서 빌드하므로 루트 기준 경로를 명시한다.
- `app/` 디렉토리 밖의 기존 파일(특히 `update-data.yml`)은 이 phase에서 수정하지 마라.
- 이 phase 완료 후 사용자가 GitHub 레포 Settings → Pages → Source를 `gh-pages` 브랜치로 직접 설정해야 사이트가 활성화된다. 이는 코드로 자동화할 수 없으므로, phase 완료 시 index.json의 `blocked_reason`이 아닌 일반 완료로 처리하라 (설정 안내는 워크플로 주석으로 남겨도 좋음).
