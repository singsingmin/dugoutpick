# User Flow

표기: `→` 전환, `?` 분기. 화면명은 code-architecture.md 라우트와 일치.

## 진입
```
앱 실행 → Splash(오늘야구각 픽셀 로고)
  ? 저장된 응원팀 있음 (AsyncStorage)
     없음 → Onboarding → 팀 저장 → Today
     있음 → Today
```

## 탭 네비게이션 (하단 3탭, 기본=Today)
```
[⚾ 오늘경기 Today] [👤 내 팀 MyTeam] [⚙️ 설정 Settings]
```

## Today (오늘경기)
```
recommendedGameId = 히어로 카드(대형 꿀잼지수+한줄이유+양팀 배지)
나머지 게임 = 꿀잼 높은 순 리스트(시간·구장·꿀잼지수)
  → 카드 탭 → GameDetail(gameId)
  ? games 비어있음 → 빈 상태("오늘은 경기가 없다")
```

## GameDetail (경기 상세)
```
표시: 꿀잼지수(대형) / 한줄예측=honjam.reason / 관전포인트=honjam.points[] /
      선발 매치업(starter.name·era, null이면 '미정') / time·stadium / 양팀 rank
  → 뒤로 → 직전 화면
```

## MyTeam (내 팀, 피드형·세로 스크롤)
```
① 내 팀 다음/오늘 경기 카드(꿀잼+관전포인트) → 탭 시 GameDetail
② 현재 순위·승률·연승연패 (standings에서 내 팀 행)
③ 최근 결과
  ? 내 팀 오늘 경기 없음 → "다음 경기 없음" + 순위/최근결과만
```

## Settings (설정, 최소)
```
응원팀 변경 → Onboarding 재사용(변경 후 저장)
데이터 갱신시각(games.updatedAt) 표시
앱 정보(버전)
```
