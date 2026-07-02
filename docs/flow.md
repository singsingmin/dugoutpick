# User Flow

표기: `→` 전환, `?` 분기. 화면명은 code-architecture.md 라우트와 일치.

## 진입
```
앱 실행 → Splash(오늘야구각 픽셀 로고)
  ? 저장된 응원팀 있음 (AsyncStorage)
     없음 → Onboarding → 팀 저장 → Today
     있음 → Today
```

## 탭 네비게이션 (하단 4탭, 기본=Today)
```
[⚾ 오늘경기 Today] [📊 순위 Standings] [👤 내 팀 MyTeam] [🎒 라커룸 LockerRoom]
```

## Today (오늘경기)
```
recommendedGameId = 히어로 카드(대형 꿀잼지수+한줄이유+양팀 배지)
지금 볼 각 = status==='LIVE' 경기 LiveCard(실시간 점수·이닝·주자·"지금 N"=live.heat)
나머지 게임 = 꿀잼 높은 순 리스트(시간·구장·꿀잼지수/점수/상태칩)
  → 카드 탭 → GameDetail(gameId)
  ? games 비어있음 → 빈 상태("오늘은 경기가 없다")
갱신시각(games.updatedAt, KST) 표시
```

## GameDetail (경기 상세)
```
표시: 꿀잼지수(대형, 선택 스킨 배지) / 한줄예측=honjam.reason / 관전포인트=honjam.points[] /
      선발 매치업(starter.name·era·승패, null이면 '미정') / time·stadium / 양팀 rank
  ? status==='SCHEDULED'|'LIVE' & lineup → 라인업 시트(LineupSheet)
  ? status==='LIVE' → 실시간 점수·라이브 상태
  ? status==='FINAL' → 결산(recap.actual·verdict) + 승/패/세이브(decision)
     & honjam!=null → 경기 후 피드백 위젯(👍/👎 + 이유 태그 → Discord 웹훅)
  → 뒤로 → 직전 화면
```

## MyTeam (내 팀, 피드형·세로 스크롤)
```
? 월요일 → 상단 월요 리포트(MondayReport: 지난주 결산 + 이번주 빅매치/일정)
① 내 팀 다음/오늘 경기 카드(꿀잼+관전포인트) → 탭 시 GameDetail
② 현재 순위·승률·연승연패 (standings에서 내 팀 행) → "전체 순위" → Standings
③ 최근 결과 (recent.json)
  ? 내 팀 오늘 경기 없음 → "다음 경기 없음" + 순위/최근결과만
```

## Standings (순위표)
```
10팀 전체 순위표(승·패·무·승률·게임차·연속·최근10). MyTeam에서 진입.
  → 뒤로 → MyTeam
```

## LockerRoom (라커룸 — 활동·꾸미기·보상 허브)
```
응원팀 변경 → Onboarding 재사용(변경 후 저장)
꿀잼지수 스킨 → SkinSelect
야구공 센터 → BaseballCenter
우상단 톱니(⚙️) → Settings(실제 앱 설정)
```

## Settings (설정 — 라커룸 톱니로 진입, 스택)
```
데이터 갱신시각(games.updatedAt, KST) · 꿀잼지수 적중률(trackRecord)
(dev/preview 빌드) 야구공 테스트/초기화 디버그 · 앱 정보(버전)
  → 뒤로 → LockerRoom
```

## SkinSelect (꿀잼지수 스킨 선택 + 구매)
```
현재적용 바(선택 스킨 + 우측 ⚾ 야구공 잔액 → 탭 시 BaseballCenter) + 카테고리 탭(전체/유니폼/야구장/스페셜)
+ 섹션 그리드(기본/컬러/화이트/줄무늬 유니폼 · 야구장 · 스페셜)
  ? 보유 스킨 탭 → 즉시 적용(user.scoreSkinId)
  ? 미보유 currency 스킨 탭 → 구매 모달(가격·잔액) → 구매 시 차감·보유·완료 모달(바로 적용)
      ? 잔액 부족 → 부족 안내 모달
  미보유 카드엔 ⚾가격 배지. → 뒤로 → LockerRoom
```

## BaseballCenter (야구공 센터 — 라커룸에서 진입)
```
현재 보유 야구공 · 오늘 출석 보상(하루 1회 +5, 7일 연속 +20, KST)
연속 출석 현황 · 7일 출석 보드 · 최근 야구공 내역(→ 전체 내역 바텀시트, 최근 30일)
  → 뒤로 → LockerRoom  (광고 보상은 추후 확장 슬롯)
```
