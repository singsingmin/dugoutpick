# 로드맵 — 오늘야구각 (DugoutPick)

> MVP(6 phase) 완료 + 라이브 데이터 파이프라인 안정화 + Android APK 산출 완료 이후의 백로그.
> 북극성(prd.md): **빠른 출시 → 시장 검증 → 다음 YC batch.** 망설일 땐 "더 빨리 출시 + 깨져도 안 죽는 쪽".
> 최종 정리: 2026-06-02.

## A. 🚀 출시 준비 (실제 사용자 손에 — 최우선)
앱·APK가 이미 있으니 시장 반응 테스트가 다음 최대 임팩트.
- [ ] **Play Store 내부테스트/비공개 출시** — APK 보유, production AAB 프로필(eas.json) 설정 완료. 가장 가까운 단계.
- [ ] **앱 아이콘 · 스플래시 자산 제작** — 현재 Expo 기본값. 스토어 등록에 필요.
- [ ] **iOS 빌드** — 현재 Android만. App Store는 Apple 개발자 계정 $99/년 비용 결정 필요.
- [ ] **베타 테스터 모집 + 피드백 루프**

## B. ✨ 기능 다듬기 (사용 경험)
유저 피드백 받으며 다듬는 게 효율적.
- [ ] **라이브 인앱 폴링** — 현재 탭 재진입 시에만 갱신(useFocusEffect). 화면 켜둔 채 자동 갱신되는 실시간 티커(배터리/요청량 트레이드오프 고려).
- [ ] **로컬 알림** — 내 팀 경기 시작/접전 알림. 서버 없이 가능(PRD에서 "추후"로 미룬 것).
- [ ] **heat: 역전 직후 가산** — 직전 스냅샷 비교 필요. heat v2에서 보류한 드라마 요소.

## C. 📊 데이터·정확도
- [ ] **꿀잼지수 공식 실경기 검증·튜닝** — recap(예측 vs 실제 적중률) 데이터 누적 → 가중치 보정.
  - [x] **누적 트랙레코드 구현** (2026-06-24) — `recap-history.json` append-only 누적 + 롤링 적중률 집계 + `games.json trackRecord` 임베드 + 앱 배지(Today 상단·Settings). 가중치 자동 보정은 표본 충분히 쌓인 후 별도 작업.
- [x] **ERA 커버리지 개선** (2026-06-02 완료) — 규정 미달 선발도 player ID 개별 조회로 ERA·승·패 표시(하이브리드). 시즌 기록 없는 투수만 '-'.
- [ ] **라이브 UI 실디바이스 검증** — 데이터는 검증됨. 실제 라이브 중 화면 렌더는 미검증.

## D. 🔧 기술 부채 (마감 있음)
- [ ] **워크플로 Node20 → v5** — `actions/checkout`·`actions/setup-node` v4 → v5. **2026-09-16 전까지**(Node20 deprecation).
- [ ] **PAT 만료 관리** — cron-job.org용 fine-grained PAT. 만료 시 cron 401로 멈춤(실패 알림으로 커버). 재발급 후 cron-job.org 헤더값 교체.

---
참고 문서: [prd.md](prd.md) · [adr.md](adr.md) · [flow.md](flow.md) · [data-schema.md](data-schema.md)
