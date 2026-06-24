# User Intervention Log

> 자율 주행 하네스(headless)는 **CLI 로 끝낼 수 없는 작업**을 직접 수행하지 않는다.
> 그런 지점을 만나면 여기에 "무엇을 / 왜 / 어떻게" 기록해 두고, 사용자가 나중에 직접 처리한다.
> plan-and-build 세션은 배포·외부 인증·수동 콘솔 작업이 필요하면 이 파일에 항목을 추가한다.

## 기록 형식
```
### <날짜> <짧은 제목>
- 상황: 왜 자동화 불가인가
- 필요한 수동 조치: 사용자가 해야 할 정확한 단계
- 차단 여부: 이 작업이 끝나야 다음이 진행되는가 (blocking / non-blocking)
```

## 알려진 상시 개입 포인트 (참조)
하네스가 새로 발견한 게 아니라, 이 프로젝트가 구조적으로 사람 손이 필요한 곳:

- **모바일 빌드/제출 (EAS)** — `app/eas.json` 기반 `eas build` / `eas submit` 은 Expo 계정 로그인·앱스토어 자격증명이 필요해 headless 자동화 대상 아님. 코드 변경 후 앱 재빌드 필요 여부는 매번 명시(앱 코드 변경=필요, 파이프라인/워크플로/문서 변경=불필요).
- **앱스토어/플레이스토어 심사 제출** — 사람 계정·심사 메타데이터 필요.
- **GitHub Actions 시크릿 / PAT** — 데이터 갱신 워크플로와 외부 cron(cron-job.org)이 쓰는 토큰 발급·교체는 사용자가 콘솔에서 직접.
- **외부 cron 트리거(cron-job.org)** — 5분마다 GitHub `workflow_dispatch` 호출(스케줄 cron 신뢰성 우회). 설정 변경은 cron-job.org 대시보드에서 수동.
- **GitHub Pages 설정** — 웹 배포는 Pages 설정·도메인 등 콘솔 작업이 필요(번들 경로는 `scripts/pwa-patch.mjs` 가 패치).
- **데이터 산출물 수동 재생성 금지** — `data-pipeline/output/*.json` 과 앱 번들 JSON 은 Actions 가 자동 갱신한다. 수동 `build.mjs` 재생성·커밋은 push 충돌을 유발하므로 하지 말 것(코드만 커밋).

## 항목

### 2026-06-24 누적 적중률 트랙레코드 — APK 재빌드 + 파이프라인 push 필요
- 상황: 앱 코드(types.ts·배지 컴포넌트·Today/Settings 화면) 변경이라 APK 재빌드 필요. `build.mjs`·`recap.mjs` 등 파이프라인 코드 변경은 `origin/main` push 해야 Actions가 라이브 반영(로컬 커밋만으로는 안 바뀜). 적중률 표본은 운영 며칠(하루 5경기 기준 최소 2일, sampleSize >= 10) 누적돼야 배지가 '집계 중' → 실수치로 전환되며, 이는 운영시간 의존이지 인간 개입 아님.
- 필요한 수동 조치:
  1. `git push origin main` — 파이프라인 코드 Actions 라이브 반영.
  2. EAS APK 재빌드(`eas build --platform android`) 및 배포.
- 차단 여부: non-blocking — 코드·테스트는 CLI로 완결, 배포만 사용자 몫.
