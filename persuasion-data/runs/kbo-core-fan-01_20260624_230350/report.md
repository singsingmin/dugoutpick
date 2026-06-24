---
report_type: simulation_report
run_id: kbo-core-fan-01_20260624_230350
persona_id: kbo-core-fan-01
persona_version: 1
final_verdict: 실패
failure_reason: keyman_drop
execution_risk: 중간
created_at: 2026-06-24T23:35:00+09:00
---

# 최종 판정

**실패 — keyman_drop**

keyman(코어 KBO 팬)의 `decision: drop`, `confidence: 68`. 성사 기준(decision == convince_stakeholders AND confidence > 75)을 모두 충족하지 못함. keyman은 "조용히 직접 설치 후 2~3주 관찰" 전략을 선택했으나, 지인에게 적극 권유하는 단계로 진입하지 않았다 — 이는 stakeholder 설득 단계가 열리지 않았음을 의미한다.

---

# 단계별 요약

- **5a keyman 초기**
  - decision: `drop` / confidence: 68
  - 핵심 사유: ① 트랙레코드가 "집계 중"으로 정확도 증거 부재, ② 피드백 루프(👍👎)가 "개발 예정"으로 자기개선 주장이 현재형 아님, ③ UX 성숙도 증거(스크린샷·리뷰) 없음, ④ 네이버 스포츠+엠팍 루틴의 관성 — 검증 전 공유 불가 판단.

- **5b 직접 stakeholder**: 미수행 (keyman_drop으로 시뮬 조기 종료)

- **5c keyman 재응답 + 재검토 라운드**: 미수행

- **5d 실무자 (BFS)**: 미수행 (B2C 개인 의사결정 구조 — 조직 내 실무자 없음)

---

# 실행 리스크

**중간** — keyman은 `decision_authority: full`(자기 폰에 자기가 설치)이라 조직 내 마찰은 없다. 시뮬 상 통과했다고 가정할 때 남는 리스크:

1. **정확도 한 번 어긋나면 즉시 삭제**: keyman의 profile `reject_triggers`에 명시된 대로, 박빙 경기에 낮은 지수 하나만 나와도 트러스트 리셋→삭제 직결. `trust_with_salesman: 50`은 신뢰가 아직 신용등급이 없는 상태임을 의미한다.
2. **입소문 경로 차단 가능성**: keyman이 만족해도 sh-watch-buddy가 iPhone 유저라면 공유 루트 자체가 막힌다. sh-watch-buddy(influence 65)는 가장 중요한 1차 전파자인데 iOS 미지원은 이 경로를 원천 봉쇄할 수 있다.
3. **sh-watch-buddy의 독립 검증**: keyman이 "이거 잘 맞더라"고 공유해도 sh-watch-buddy 본인도 코어 팬이라 꿀잼지수를 독립적으로 검증한다(influence 65, trust_with_keyman 80). 두 번째 정확도 관문.
4. **sh-casual-friend 조기 이탈**: downstream 유저는 호기심에 설치하더라도 재미·습관이 안 붙으면 금방 이탈 — 단순함이 유일한 후킹 포인트이므로 온보딩 마찰이 없어야 함.

→ 전반적으로 개인 B2C 특성상 조직 장벽은 없지만, 정확도 검증 실패 시 cascading churn이 빠르고 소리 없이 일어나는 구조다.

---

# 가치제안 개선 포인트

> 세션 수가 1(keyman_initial만 존재)이므로 모든 우려는 동일 세션에서 도출됨. 빈도 대신 발화 비중·강도로 순위화.

1. **정확도 증거 부재 (트랙레코드 미집계)** — 언급 세션 수 1, 핵심 drop 사유
   > "트랙레코드 배지를 신뢰 장치로 내세웠는데, '2026시즌 전 경기 집계 중'이라는 문구는 검증 데이터가 아직 없다는 말이다."
   → 트랙레코드가 10경기 이상 쌓이기 전까지는 이 신뢰 장치가 오히려 역효과. 최소 표본(예: "최근 20경기 기준") 도달 전까지는 수치 공개를 보류하거나, 대신 개별 경기 사례("이 경기 예측 vs 실제" 1~2건 스크린샷)를 전면에 배치할 것.

2. **hitRate 판정 기준 불명확** — 언급 세션 수 1, 걱정/의문점 첫 번째
   > "지수 80인 경기가 연장 접전이면 적중인가, 실제 하이라이트 재생 수로 결정하는가? 기준이 운영자 재량이면 트랙레코드도 신뢰할 수 없다."
   → 적중 판정 기준(예: "경기 후 OPS 합산 X 이상" 또는 "연장전·끝내기 포함")을 앱 내 트랙레코드 설명에 명시. 투명성이 신뢰의 핵심.

3. **자기개선 루프 미구현** — 언급 세션 수 1, 구체적 이유 두 번째
   > "현재 버전은 고정 가중치 룰베이스 알고리즘이 전부이고, 자기개선은 미래형이다."
   → "쓸수록 더 맞아지는 구조"라는 표현은 현재 사실이 아니므로 현재형으로 쓰면 역효과. 가치제안에서 피드백 루프를 "계획" 섹션으로 격리하거나, 현재 가능한 투명성 메시지("현재는 고정 가중치, 실사용 피드백으로 시즌 중 튜닝 예정")로 교체.

4. **iOS 미지원** — 언급 세션 수 1, 걱정/의문점 세 번째
   > "sh-watch-buddy 절친이 iPhone 유저라면 공유 루트 자체가 막힌다."
   → 코어 팬의 1차 공유 상대(직접 stakeholder)가 iOS 유저일 확률이 높다면 입소문 경로 자체가 차단됨. iOS 빌드 우선순위 재검토 필요. 단기적으로는 가치제안에 "Android 우선, iOS 출시 예정 시점" 명시로 기대치 관리.

5. **당일 선발 변경 반영 속도** — 언급 세션 수 1, 걱정/의문점 네 번째
   > "KBO 당일 선발 변경(경기 2시간 전 공지)이 항상 제때 잡히는가? 선발 투수 정보가 틀리면 즉시 신뢰 소멸이다."
   → 선발 정보는 꿀잼지수의 핵심 입력값 중 하나(에이스 등판 요소)이므로 오탐 시 치명적. "5분 갱신" 주기를 가치제안에 명시했지만, KBO 당일 변경 감지가 실제로 얼마나 빠른지 내부 검증 후 SLA를 더 구체적으로 제시할 것 (예: "KBO 공지 후 10분 이내 반영").

---

# 페르소나 보정 힌트

- **파일: 01_keyman_initial.md** — `decision: drop`이지만 본문 마지막에 "조용히 직접 설치 → 2~3주 관찰" 전략을 서술함. 즉 keyman은 자신의 설치를 배제하지 않았는데도 `drop`으로 판정됐다. 이는 "타인에게 권유하지 않겠다"는 의미의 drop이지 "앱에 전혀 관심 없다"는 뜻이 아니다. 현재 `decision` 필드가 "keyman 본인의 설치 의향"과 "stakeholder 설득 의향"을 구분하지 않아 정보 손실이 발생함. 향후 시뮬에서 `self_install_intent: maybe/yes/no` 필드를 별도로 추가하는 것을 고려할 것.

- **파일: 01_keyman_initial.md** — keyman의 `trust_with_salesman: 50`과 `risk_preference: moderate`를 감안하면 confidence 68은 자연스럽다(75 문턱을 살짝 하회). 그러나 시뮬에서 keyman이 정확도 관련 우려를 5개 연속으로 나열한 것은 moderate risk-preference 프로파일보다 high-skepticism 성향에 더 가깝게 재현된 인상이 있다. `personality_notes`("부정확하면 바로 삭제")의 강경한 표현이 시뮬에서 과다 반영된 가능성 있음 — 보정 시 "일단 써보는 관성"도 동등 비중으로 반영할 것.

- **파일: 01_keyman_initial.md** — sh-watch-buddy의 `trust_with_keyman: unknown` 필드가 시뮬에서 참조되지 않았다(5b 미수행으로 인해). 다만 keyman이 "절친에게 권할 수 있는 단계가 아니다"라고 판단한 대목에 sh-watch-buddy의 깐깐한 검증 성향이 간접적으로 반영되어 있어, 향후 5b 단계가 수행될 경우 `trust_with_keyman: unknown`이 낙관적 bias를 유발할 수 있음을 주의할 것.

---

# 세션 로그

- 01_keyman_initial.md — decision: drop, confidence: 68
- 02_stakeholder_*.md — 미생성 (keyman_drop 조기 종료)
- 03_keyman_response_*_round*.md — 미생성
- 04_stakeholder_recheck_*_round*.md — 미생성
- 05_staff_*.md — 미생성 (B2C 페르소나 — 해당 없음)
