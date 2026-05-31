# 오늘야구각 (DugoutPick) — App

KBO 경기를 꿀잼지수(0~100)로 점수화해 "오늘 뭐 볼지" 골라주는 Expo(React Native + TypeScript) 앱.
설계 배경은 `../docs/`(prd·flow·data-schema·code-architecture·adr) 참고.

## 실행
```bash
cd app
npm install          # 최초 1회
npx expo start       # 개발 서버
```
- 실폰: Expo Go 앱으로 QR 스캔
- 에뮬레이터: 터미널에서 `i`(iOS) / `a`(Android), 웹: `w`

## 검증
```bash
npx tsc --noEmit                                   # 타입 체크
npx expo export --platform ios --output-dir dist   # JS 번들 무결성
```

## 데이터
- 개발/MVP: `assets/data/*.json` 번들 사용 (파이프라인 `../data-pipeline/output` 산출물).
- 배포: `data/config.ts`의 `REMOTE_BASE_URL`에 원격 JSON URL을 넣으면 fetch + AsyncStorage 캐시로 전환(오프라인 폴백).
- ⚠️ 꿀잼지수·이유·관전포인트는 파이프라인에서 계산된 값이며 앱은 표시만 한다(재계산 금지, ADR-004/005).

## 구조
```
App.tsx              폰트 로드 + NavigationContainer
theme.ts / types.ts  8비트 디자인 토큰 / 데이터 타입
navigation/          RootStack(Splash·Onboarding·Tabs·GameDetail) + BottomTabs
screens/             Splash, Onboarding, Today, GameDetail, MyTeam, Settings
components/          PixelText, Panel, PixelButton, TeamBadge, HonjamBadge, GameCard
data/                config(env분기) · load(번들/원격+캐시) · team(AsyncStorage)
assets/              Galmuri11.ttf(픽셀폰트) · data/*.json(번들 데이터)
```
