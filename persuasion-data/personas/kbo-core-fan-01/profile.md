---
persona_id: kbo-core-fan-01
version: 1
created_at: 2026-06-24
updated_at: 2026-06-24
company_meta:
  industry: "B2C — KBO 야구 관전 소비자"
  size: "1 (개인 의사결정 + 함께 보는 지인 그룹)"
  stage: "신규 앱 설치/지속사용 검토"
keyman:
  id: km
  role: "코어 KBO 팬 (한화 이글스 팬, 30대 직장인)"
  decision_authority: full        # 자기 폰에 자기가 설치 — 의사결정 단독
  budget_range_krw: "무료 (광고/구독 거부감 있음, 가치 명확하면 소액 결제 가능)"
  tech_literacy: high
  risk_preference: moderate
  personality_notes: "야구 커뮤니티/네이버 스포츠 헤비유저. '폼 잡는' 앱 싫어하고 정보 밀도와 정확도로 판단. 부정확하면 바로 삭제."
  current_pains:
    - "매일 5경기 중 퇴근 후 한 경기만 챙겨볼 때 뭐가 꿀잼인지 미리 모름"
    - "네이버 스포츠/포털은 일정·순위는 주지만 '오늘 이 경기가 왜 볼 만한지'는 안 알려줌"
    - "내 팀(한화) 경기 외에는 관심 끄게 되는데, 명경기를 놓치고 나중에 하이라이트로 후회"
  existing_alternatives:
    - "네이버 스포츠 앱 / 포털 야구 페이지"
    - "KBO 공식앱, 각 구단 앱"
    - "야구 커뮤니티(엠팍 등)에서 눈치껏 골라보기"
  buy_triggers:
    - "꿀잼지수가 실제 명경기와 체감상 일치(신뢰 형성)"
    - "한 줄 이유/관전포인트가 '오 그래서 볼 만하네' 싶게 구체적"
  reject_triggers:
    - "점수가 실제 경기 재미와 어긋남(예: 박빙인데 낮게, 일방적인데 높게)"
    - "데이터가 안 맞거나 갱신이 늦음(선발/순위 틀림)"
    - "로그인 강요, 과한 광고, 무거움"
  communication_style: "야구 친구들에게는 '이 앱 꿀잼지수 잘 맞더라'식으로 짧게 공유, 비팬에게는 굳이 추천 안 함"
trust_with_salesman: 50           # 신규 앱에 대한 기본 의심(정보앱은 정확도로만 신뢰 획득)
stakeholders:
  - id: sh-watch-buddy
    role: "함께 야구 보는 절친 (같은 코어 팬, 다른 팀)"
    relation_to_keyman: direct
    influence: 65
    decision_weight_hint: "keyman이 '이거 써봐' 하면 바로 깔아보는 관계, 피드백도 솔직"
    tech_literacy: high
    personality_notes: "본인도 헤비 팬이라 꿀잼지수 정확도를 깐깐하게 검증함"
    trust_with_keyman: 80
    connected_to:
      - { id: sh-casual-friend, weight: 40 }
  - id: sh-casual-friend
    role: "가끔 야구 보는 캐주얼 지인"
    relation_to_keyman: downstream
    influence: 25
    decision_weight_hint: "코어 팬이 추천하면 호기심에 한 번 깔아보는 정도, 재미없으면 금방 이탈"
    tech_literacy: medium
    personality_notes: "규칙/지표 잘 모름. '오늘 뭐 볼지' 골라주는 단순함에 끌리지만 금방 식음"
    trust_with_keyman: unknown
    connected_to: []
competing_solutions:
  - name: "네이버 스포츠 / 포털 야구"
    usage: using
    strengths: ["방대한 데이터", "이미 매일 들어감", "무료/신뢰"]
    weaknesses: ["'오늘 뭐가 꿀잼인지' 큐레이션 없음", "정보 과잉"]
    switching_cost: low
  - name: "KBO 공식앱 / 구단 앱"
    usage: aware
    strengths: ["공식 데이터", "내 팀 중심 기능"]
    weaknesses: ["경기 간 비교/추천 없음", "UX 무거움"]
    switching_cost: low
  - name: "야구 커뮤니티(엠팍 등)"
    usage: using
    strengths: ["사람 손맛 큐레이션/여론"]
    weaknesses: ["객관 점수 아님", "노이즈 많음"]
    switching_cost: low
---

# 배경 서술

대전 출신, 현재 수도권 거주 30대 직장인, 평생 한화 이글스 팬("보살팬"으로 불릴 만큼 긴 암흑기를 견뎌온 인내형). 평일에는 퇴근이 늦어 5경기를 다 볼 수 없고, 보통 하나만 골라 본다. 내 팀 경기는 결과와 무관하게 챙기지만, 내 팀이 일찍 무너지거나 경기가 없는 날엔 "다른 경기 중 뭐가 볼 만한가"를 놓고 매번 고민한다. 네이버 스포츠로 일정·순위는 보지만, 그게 "오늘 이 경기가 왜 재밌는지"를 알려주진 않아 결국 감으로 고르거나 커뮤니티 여론에 의존한다. 종종 다른 경기에서 끝내기·역전 명경기가 나온 걸 다음 날 하이라이트로 보고 "이걸 놓쳤네" 하고 아쉬워한다.

새 앱에 대한 기대치보다 의심이 크다. 특히 "지수/점수"를 내세우는 앱은 그 숫자가 실제 체감과 맞아야만 신뢰한다 — 한두 번 박빙 경기를 낮게 매기거나 일방적 경기를 높게 매기면 바로 신뢰를 잃고 삭제한다. 반대로 꿀잼지수가 몇 번 잘 맞으면 "이거 의외로 잘 맞네" 하며 친구들에게 가볍게 공유한다.

## 조직 역학 메모

이 페르소나의 "의사결정 네트워크"는 회사가 아니라 **야구를 함께 소비하는 관계망**이다.
- keyman(코어 팬)은 자기 폰에 자기가 설치하므로 도입 결정권은 단독(full). 다만 "계속 쓸지"는 정확도가 좌우.
- direct stakeholder = 함께 야구 보는 절친(같은 코어 팬). keyman의 추천을 바로 받아들이지만, 본인도 헤비 팬이라 꿀잼지수를 깐깐하게 검증한다. 이 사람의 신뢰가 곧 입소문의 1차 관문.
- downstream stakeholder = 캐주얼 지인. 코어 팬이 추천하면 호기심에 깔지만, 재미·습관이 안 붙으면 빠르게 이탈한다. "오늘 뭐 볼지 골라주는 단순함"이 유일한 후킹 포인트.

→ 시뮬레이션 관점: 이 앱의 성패는 (1) 코어 팬이 꿀잼지수를 신뢰하게 만들고, (2) 그 신뢰가 절친→캐주얼로 전파되는가에 달려 있다. 정확도 미스가 reject_trigger 의 핵심.
