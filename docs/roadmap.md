# 로드맵 — 오늘야구각 (DugoutPick)

> MVP(6 phase) 완료 + 라이브 데이터 파이프라인 안정화 + Android APK 산출 완료 이후의 백로그.
> 운영 방식: 야구 찐팬 1명 + 야구 초보팬 1명과 함께 사용하며 피드백 기반 개선.
> 최종 정리: 2026-06-24.

## A. ✨ 기능 다듬기 (사용 경험)
- [ ] **아이콘 Phosphor 교체** (2026-07-01 EAS 재빌드 예정) — 현재 `@expo/vector-icons(MaterialCommunityIcons)` A단계 완료. `phosphor-react-native` 설치 후 `AppIcon.tsx` 매핑만 교체(30분 작업). EAS 재빌드와 묶어서 진행.
유저 피드백 받으며 다듬는 게 효율적.
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

## C. 🔧 기술 부채 (마감 있음)
- [ ] **워크플로 Node20 → v5** — `actions/checkout`·`actions/setup-node` v4 → v5. **2026-09-16 전까지**(Node20 deprecation).
- [ ] **PAT 만료 관리** — cron-job.org용 fine-grained PAT. 만료 시 cron 401로 멈춤(실패 알림으로 커버). 재발급 후 cron-job.org 헤더값 교체.
- [ ] **Play Store 공개 전 Discord 웹훅 재검토** — 현재 APK 번들에 웹훅 URL 포함(2명 내부 테스터용). 공개 배포 전 서버 프록시 또는 웹훅 전용 채널 교체 필요.

---
참고 문서: [prd.md](prd.md) · [adr.md](adr.md) · [flow.md](flow.md) · [data-schema.md](data-schema.md)
