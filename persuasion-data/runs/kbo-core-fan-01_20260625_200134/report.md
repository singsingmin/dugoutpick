---
report_type: simulation_report
run_id: kbo-core-fan-01_20260625_200134
persona_id: kbo-core-fan-01
persona_version: 1
final_verdict: 실패
failure_reason: keyman_drop
execution_risk: 중간
created_at: 2026-06-25T20:30:00+09:00
---

# 최종 판정

**실패 — keyman_drop**

keyman(km)이 1단계(keyman_initial)에서 `decision: drop`을 선택했다. 성사 조건(`decision == convince_stakeholders` AND `confidence > 75`) 모두 미달: decision=drop, confidence=72. 이후 단계(5b~5d)는 실행되지 않았다.

---

# 단계별 요약

- **5a keyman 초기**: decision=**drop** / confidence=72 / 핵심 사유: 꿀잼지수의 유일한 신뢰 기준인 트랙레코드가 "집계 중(20경기 미달)"이라 자기증명 불가 + UX·완성도 증거 없음 + iOS 미지원으로 추천 네트워크 단절 가능성.
- **5b 직접 stakeholder**: 미실행 (keyman_drop으로 중단)
- **5c keyman 재응답 + 재검토 라운드**: 미실행
- **5d 실무자 (BFS)**: 미실행
  - reject: N/A
  - critical_accept: N/A
  - accept: N/A
  - positive_accept: N/A

---

# 실행 리스크

**중간** (시뮬레이션 상 통과했다면 잔존했을 리스크 추정)

keyman의 `decision_authority: full`이므로 설치 결정 자체는 단독 가능하다. 그러나 실제 지속 사용과 입소문 전파 경로에 다음 위험이 남는다:

- **트랙레코드 공개 전 이탈**: 설치 직후 꿀잼지수가 한두 번 체감과 어긋나면 "신뢰 베이스라인 50"이 즉시 0으로 귀결 → 삭제. trust_with_salesman 50 + 트랙레코드 부재 = 초기 이탈 구간이 가장 위험.
- **iOS 갭 — 추천 네트워크 단절**: sh-watch-buddy가 iOS 사용자라면 keyman의 설치가 있더라도 1차 입소문 관문이 막힌다. 가치제안에 iOS 타임라인이 "향후"로만 처리됨.
- **5d 실무자 세션 없음**: stakeholder·실무자 거부 비율을 정량화할 데이터가 없어 리스크 상한을 확인할 수 없다. authority=full이지만 불확실성으로 '중간'으로 평정.

---

# 가치제안 개선 포인트

> 모든 근거는 01_keyman_initial.md 단일 세션. 세션 수 표기(N=1)는 이번 run의 샘플 한계를 의미한다.

1. **트랙레코드 부재(집계 중) — 자기증명 장치의 역설** — 언급한 세션 수 1, 대표 발화: *"이 앱이 제일 강조하는 자기증명 장치가 지금은 없다. 공식이 투명한 것과, 그 공식이 실제로 잘 맞는 것은 다른 이야기다."*
   - 개선 방향: 20경기 달성 전에라도 "최근 5경기 한 줄 결과 복기(예: 예측 80→연장전, 예측 45→7점차)" 같은 소규모 증거라도 노출할 것.

2. **경기 전 데이터의 한계 — 예측 불가 명경기 문제** — 언급한 세션 수 1, 대표 발화: *"실제 명경기는 예측 불가 요소(선발 난조, 이변, 연장)로 만들어지는 경우가 많다. 낮게 예측했는데 명경기가 나오면 바로 신뢰 잃는다."*
   - 개선 방향: "사전 지수가 낮아도 이변으로 명경기가 날 수 있다"는 면책성 문구보다, 이변 명경기 사례에서도 지수가 어떻게 작동했는지(예: "지수 55짜리 경기가 연장 끝내기로 터진 사례 포함")를 솔직하게 보여주는 것이 더 효과적.

3. **추정 라인업 정확도 미지수** — 언급한 세션 수 1, 대표 발화: *"이 추정이 얼마나 틀리는가. 코어 팬은 잘못된 선발 정보에 매우 민감하다."*
   - 개선 방향: 추정 타순의 정확도 지표(예: "최근 10경기 기준 선발 1~3번 일치율 X%") 또는 추정 기준(최근 5경기 기준)을 명시. "추정임을 명시"만으로는 코어 팬의 의심을 해소하기 어렵다.

4. **선발 투수 변경 10분 반영 SLA 미검증** — 언급한 세션 수 1, 대표 발화: *"'약 10분 이내'가 실제 KBO 현장에서 검증된 수치인지 불명."*
   - 개선 방향: "파이프라인 주기 기반"이라는 기술적 설명 대신 "KBO 공지 → 앱 반영까지 평균 X분, 최대 Y분 (2026-06 실측)"처럼 실측 수치로 교체.

5. **iOS 미지원 → 추천 네트워크 단절** — 언급한 세션 수 1, 대표 발화: *"절친(sh-watch-buddy)이 iOS 사용자라면 추천 네트워크 자체가 단절될 수 있다."*
   - 개선 방향: 가치제안 내 "향후 계획" 항목에 iOS 빌드 예상 시점을 명시하거나, 당장 "iOS용 PWA 링크"라도 제공해 네트워크 단절 리스크를 낮출 것.

---

# 페르소나 보정 힌트

- **파일: 01_keyman_initial.md** — keyman은 "시도 자체의 비용은 낮다(기존 앱을 버릴 필요 없이 병행)"고 스스로 언급했음에도 drop을 선택했다. `risk_preference: moderate` + 낮은 전환비용이라면 적어도 "설치 후 확인"(=convince_stakeholders 아닌 conditional_install) 수준의 유보적 수용이 더 자연스러웠을 수 있다. trust_with_salesman=50이 drop 방향으로 과도하게 수렴했을 가능성 있음. → 향후 보정: `trust 50 + 전환비용 low` 조합에서는 "일단 설치해보되 트랙레코드 확인 후 판단" 노선의 threshold를 낮출 것 검토.

- **파일: 01_keyman_initial.md** — sh-watch-buddy의 플랫폼(iOS 여부)이 `trust_with_keyman: unknown` 필드로 인해 불확실성 요인으로 처리되었다. keyman이 "절친이 iOS라면"이라는 조건부 우려를 제기했는데, 이 unknown이 단정적 리스크로 수렴된 흔적이 있다. 프로파일에 sh-watch-buddy의 플랫폼(Android/iOS) 속성을 추가하면 이 분기의 해상도가 높아질 것.

---

# 세션 로그

- 01_keyman_initial.md — decision: drop / confidence: 72 / 5개 우려 항목
- 02_stakeholder_*.md — 미생성 (keyman_drop으로 중단)
- 03_keyman_response_*_round*.md — 미생성
- 04_stakeholder_recheck_*_round*.md — 미생성
- 05_staff_*.md — 미생성
