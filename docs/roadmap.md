# 로드맵 — 오늘야구각 (DugoutPick)

> MVP(6 phase) 완료 + 라이브 데이터 파이프라인 안정화 + Android APK 산출 완료 이후의 백로그.
> 운영 방식: 야구 찐팬 1명 + 야구 초보팬 1명과 함께 사용하며 피드백 기반 개선.
> 최종 정리: 2026-06-24.

## A. ✨ 기능 다듬기 (사용 경험)
- [x] **아이콘 커스텀 SVG 교체** (2026-06-29) — 커스텀 SVG로 교체 완료.
- [x] **라이브 인앱 폴링** (2026-06-25) — LIVE 경기 존재 시 60초 자동 갱신(useFocusEffect + interval 병행). 배터리 영향 최소화 위해 LIVE 게임 없으면 폴링 중단.
- [x] **라인업 조회** (2026-06-25) — `Schedule.asmx/GetLineUpAnalysis` API로 선발 타순(1~9번·포지션·이름) fetch → games.json 포함. 경기 상세 선발투수 섹션 옆 버튼 → 바텀시트 표시. 발표 전 추정 타순도 "최근 기준 추정" 표시로 제공.
- [ ] **로컬 알림** — 내 팀 경기 시작/접전 알림. 서버 없이 가능(PRD에서 "추후"로 미룬 것).
- [ ] **heat: 역전 직후 가산** — 직전 스냅샷 비교 필요. heat v2에서 보류한 드라마 요소.
- [ ] **LLM 기반 텍스트 다양화** — 한 줄 예측·관전 포인트·월요 리포트 한줄평을 Claude Haiku/Sonnet으로 생성. 규칙 기반 템플릿의 반복 느낌 해소, 팀별 밈·말투 반영(`data-pipeline/team-context.json` 활용). 구현 조건: GitHub Actions secret에 `ANTHROPIC_API_KEY` 추가 필요. 파이프라인에서 gameId+date 키로 캐시해 2분 빌드마다 LLM 호출하지 않도록 설계. 비용 Haiku 기준 시즌 전체 ~$2.

## B. 📊 데이터·정확도
- [ ] **꿀잼지수 공식 실경기 검증·튜닝** — recap(예측 vs 실제 적중률) 데이터 누적 → 가중치 보정.
  - [x] **누적 트랙레코드 구현** (2026-06-24) — `recap-history.json` append-only 누적 + 롤링 적중률 집계 + `games.json trackRecord` 임베드 + 앱 배지(Today 상단·Settings). 가중치 자동 보정은 표본 충분히 쌓인 후 별도 작업.
- [x] **ERA 커버리지 개선** (2026-06-02 완료) — 규정 미달 선발도 player ID 개별 조회로 ERA·승·패 표시(하이브리드). 시즌 기록 없는 투수만 '-'.
- [ ] **라이브 UI 실디바이스 검증** — 데이터는 검증됨. 실제 라이브 중 화면 렌더는 미검증.
- [ ] **꿀잼지수 가중치 튜닝** — 피드백 데이터 누적(👍👎 + 이유 태그) 후 진행.
  튜닝 개시 기준: 피드백 표본 30건 이상 누적 시. reasonTag 분포로 어느 요소 가중치가 실제 체감과 어긋나는지 판단.

## B-2. ⚡ 실시간 갱신 (Cloudflare Worker 하이브리드)
- [x] **games.json만 Worker로 이전** (2026-06-29) — 라이브 데이터 갱신 지연 4~5분 → 30초로 개선. 배포 완료(`dugoutpick-kbo-live.tkdals8401.workers.dev`).
  - AS-IS: `cron(2분) → GitHub Actions(2분) → 정적 JSON → 앱 폴링`
  - TO-BE: `앱 폴링(30초) → Cloudflare Worker → KBO API 직접 호출`
  - `standings.json`, `report.json` 등 실시간성 낮은 데이터는 기존 파이프라인 유지 (하이브리드)
  - 작업 절차:
    1. Cloudflare 계정 + Wrangler CLI 설정
    2. `build.mjs`의 KBO API 호출·파싱·꿀잼지수 계산 로직 → Worker(TypeScript) 이식
    3. Worker 내 30초 캐시 적용 (KBO API 과부하 방지)
    4. `app/data/config.ts`의 `REMOTE_BASE_URL` → Worker URL로 변경 (games.json만)
    5. games.json 생성 Actions 비활성화
  - 비용: 무료 플랜 100,000 req/일 → 현재 규모 충분, 수백 명 이상 시 $5/월
  - 예상 작업: 하루 분량 (Phase 1 Worker 구축이 핵심)

## C. 🔧 기술 부채 (마감 있음)
- [x] **워크플로 Node20 → v5** (2026-06-29) — `actions/checkout`·`actions/setup-node` v4 → v5 완료.
- [ ] **PAT 만료 관리** — cron-job.org용 fine-grained PAT. 만료 시 cron 401로 멈춤(실패 알림으로 커버). 재발급 후 cron-job.org 헤더값 교체.
- [ ] **Play Store 공개 전 Discord 웹훅 재검토** — 현재 APK 번들에 웹훅 URL 포함(2명 내부 테스터용). 공개 배포 전 서버 프록시 또는 웹훅 전용 채널 교체 필요.

## D. 🗓️ 비시즌 콘텐츠 (리서치 중)

> KBO 비시즌: 11월~3월 (약 4~5개월). 현재 앱은 이 기간 동안 "오늘 경기" 탭이 비어 앱을 열 이유가 없음.

- [ ] **비시즌 모드 화면** ← 우선 구현 후보
  - 개막일까지 카운트다운 + 지난 시즌 팀별 요약 카드(W/L, 꿀잼지수 평균, 최고 경기 TOP3)
  - 시즌 마지막 빌드에서 생성한 정적 JSON 재활용 → 추가 API 불필요
  - 앱 코드 분기(`isOffseason()`) + `offseason-summary.json` 파이프라인 추가로 구현 가능
  - 구현 비용 낮고 비시즌 내내 동작

- [ ] **스토브리그 트래커** ← 데이터 가용성 리서치 필요
  - FA 계약·트레이드·외국인 선수 교체·팀별 주요 변화를 피드 형식으로 표시
  - ⚠️ KBO 공식 API에 FA·트레이드 데이터 없음 → 뉴스 파싱 또는 수동 큐레이션 필요
  - ⚠️ 연봉 협상 금액은 비공개 多 → 구조화 데이터 없음
  - 선택지 A: 수동 `offseason-news.json` 편집 + 앱 피드 표시 (큐레이션 비용 발생)
  - 선택지 B: KBO API에서 잡히는 외국인 선수 등록/말소·1군 엔트리 변화만 자동화 (범위 축소)
  - → 비시즌 모드 기본 화면 먼저 운영해보고 사용자 반응 봐가며 결정

## E. 🎨 스킨 · 재화 · 상점 (장기 로드맵)

> 꿀잼지수 배지(JerseyScoreBadge)의 `uniformPreset` 확장 구조를 활용.
> 재화 도입 전에 반드시 계정 시스템이 선행되어야 함 — 재화 초기화·스킨 유실 불만 방지.

### Phase 1 — 스킨 다양화 (서버 불필요, 현재 아키텍처)
- [x] `uniformPreset` 구현: default · classic · pinstripe · vintage 4종
- [ ] 야구공 외 배지 스킨: 글러브·헬멧·심판 카운터 등 야구 관련 오브젝트
- [ ] 스킨 선택 UI (Settings 또는 별도 탭)

### Phase 2 — 계정 시스템 (Phase 1 이후 필수 선행)
- [ ] 익명 UID 발급(기기 종속) → 재설치 시 복원 코드로 연결 가능
- [ ] 선택적 Google / Apple 로그인 연동
- [ ] 서버: 계정·재화·스킨 보유 현황 저장 (Supabase 또는 Firebase 검토)
- [ ] 재화·스킨 데이터의 서버 동기화

### Phase 3 — 재화 + 출석 + 상점 (계정 시스템 이후)
- [ ] 야구공(🏈) 재화 시스템
- [ ] 일일 출석 체크 → 야구공 지급
- [ ] 광고 시청 보상 (선택적)
- [ ] 상점 화면: 야구공으로 스킨 구입

### Phase 4 — 수익화 (검토 중)
- [ ] 인앱 결제(IAP)로 야구공 구입
- [ ] 출시 전 Play Store / App Store 정책 검토 필요

---
참고 문서: [prd.md](prd.md) · [adr.md](adr.md) · [flow.md](flow.md) · [data-schema.md](data-schema.md)
