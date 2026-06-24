# Data Schema

앱이 소비하는 정적 JSON 3종. 파이프라인(`data-pipeline/build.mjs`)이 KBO 실데이터로 생성. **앱은 읽기 전용 — 꿀잼지수는 파이프라인에서 이미 계산됨**(앱은 재계산 안 함, 의도: adr.md ADR-004).

## games.json
오늘 경기 + 꿀잼지수. 앱의 메인 데이터.
```jsonc
{
  "date": "20260531",              // YYYYMMDD (KST 기준)
  "dateText": "2026년 5월 31일",
  "updatedAt": "2026-05-31T00:06:00.000Z",  // ISO, 파이프라인 실행시각
  "trackRecord": {                 // 롤링 적중률 집계(recap-history.json 미러). 옵셔널 — 표본 부족·구버전 시드에서 없을 수 있음(→ '집계 중' 표시)
    "window": 50,                  // 집계 윈도우(최근 N건)
    "sampleSize": 23,              // 윈도우 내 실제 집계된 레코드 수
    "hitRate": 71,                 // 0~100 정수. verdict==='예측 적중' 비율(%)
    "bonusRate": 17,               // 0~100 정수. verdict==='기대 이상' 비율(%). hitRate와 별개(합산 금지)
    "ready": true                  // sampleSize >= 10(MIN_SAMPLE)일 때만 true
  },
  "recommendedGameId": "20260531LTNC0",     // 최고 꿀잼지수 경기, null 가능
  "games": [{
    "gameId": "20260531LTNC0",     // = KBO G_ID (YYYYMMDD+원정코드+홈코드+N)
    "time": "14:00",
    "stadium": "창원",
    "status": "SCHEDULED",         // SCHEDULED | FINAL | CANCELED
    "broadcast": "M-T",            // 중계 채널코드(원문), 표시용
    "away": {
      "code": "LT",                // 팀코드, teams.json과 매칭
      "name": "롯데",
      "rank": 8,                   // 당일 순위
      "score": null,              // FINAL일 때만 숫자, 아니면 null
      "starter": { "name": "비슬리", "era": 3.71 }  // 미등록/미규정시 null 또는 era:null
    },
    "home": { /* away와 동일 구조 */ },
    "honjam": {                    // 순위 데이터 없으면 null (계산 불가)
      "score": 83,                 // 0~100, 보정 후 표시값
      "reason": "낙동강 더비 · 승률 0.420 완전 동률의 초접전",  // 한 줄 예측(카드용)
      "points": ["낙동강 더비", "...", "..."],  // 관전포인트 최대 3개(상세용)
      "factors": { "close":1.0, "quality":0.22, "form":0.30, "rivalry":0.7, "playoff":1.0, "pitcher":0.27 },  // 0~1 원시 기여값(디버그/튜닝용)
      "frozen": true               // 경기 전 freeze된 예측임을 표시(정직성 게이트용). 앱은 무시. 옵셔널 — 경기 전 스냅샷 없이 FINAL로 처음 수집된 경기는 없음(영원히 false)
    }
  }]
}
```
**nullable 규칙:** `score`는 경기 전 null. `starter`/`starter.era`는 선발 미등록·미규정시 null → UI는 '미정'. `honjam`은 순위 매칭 실패시 null. `trackRecord`는 표본 부족(sampleSize < 10)·구버전 시드에서 없을 수 있음(옵셔널) — 이 경우 배지는 '집계 중'으로 표시하는 것이 의도된 동작.

## standings.json
10팀 순위표. 내 팀 탭 / 순위 표시용.
```jsonc
{
  "updatedAt": "...",
  "standings": [{
    "rank": 1, "code": "LG", "name": "LG",
    "games": 52, "win": 32, "loss": 20, "draw": 0,
    "winRate": 0.615, "gamesBehind": 0,
    "last10": "7승0무3패",    // 원문 문자열
    "streak": "2승",          // 원문(연속), "11패" 등
    "home": "18-0-10", "away": "14-0-10"  // 승-무-패
  }]
}
```

## teams.json
구단 레퍼런스(정적). 온보딩 팀선택·배지 색상용. **온보딩은 fetch 전에 필요하므로 앱에 번들 권장.**
```jsonc
{ "teams": [{ "code": "HT", "name": "KIA", "fullName": "KIA 타이거즈", "color": "#EA0029" }] }
```
코드 매핑: HT=KIA, SS=삼성, LG=LG, OB=두산, KT=KT, SK=SSG, LT=롯데, HH=한화, NC=NC, WO=키움.

## recap-history.json
크로스데이트 누적 적중률 파일. 파이프라인 산출물. **append-only** — 같은 gameId가 이미 있으면 덮어쓰지 않는다(5분 주기 재실행·재빌드에 중복·드리프트 방지).
```jsonc
{
  "updatedAt": "2026-06-24T10:30:00.000Z",  // ISO, 마지막 갱신 시각
  "window": 50,                              // 롤링 집계 윈도우(최근 N건). 상수: WINDOW=50
  "sampleSize": 23,                          // 윈도우 내 실제 집계된 레코드 수
  "hitRate": 71,                             // 0~100 정수. verdict==='예측 적중' 비율(%)
  "bonusRate": 17,                           // 0~100 정수. verdict==='기대 이상' 비율(%). hitRate와 별개(합산 금지)
  "ready": true,                             // sampleSize >= 10(MIN_SAMPLE)일 때만 true. false면 앱은 '집계 중' 표시
  "records": [                               // append 순서 = 발생 순서. 정렬·재배열 금지
    {
      "date": "20260623",                    // YYYYMMDD, 경기 날짜
      "gameId": "20260623SSLG0",             // KBO G_ID
      "pred": 78,                            // 경기 전 freeze된 꿀잼지수(honjam.score, frozen===true)
      "actual": 84,                          // 실제 꿀잼지수(경기 후 재계산)
      "verdict": "기대 이상"                   // '예측 적중' | '기대 이상' | '기대 이하' | null
    }
  ]
}
```
**정직성 게이트:** `records`에 들어가는 항목은 반드시 `honjam.frozen===true`(경기 전 freeze된 예측)에서만 나온다. 첫 sighting이 이미 FINAL이라 경기 전 freeze 없던 경기는 영구 제외. `verdict`가 null인 레코드는 집계에 넣지 않는다.

**롤링 집계:** `hitRate`·`bonusRate`·`sampleSize`는 `records` 배열의 끝 `window`(=50)개 기준. `ready`는 `sampleSize >= MIN_SAMPLE(=10)`일 때만 true.

**알려진 한계:** FINAL 후 KBO 사후 스코어 정정(몰수·기록 정정)은 append-only dedup 특성상 반영되지 않는다(빈도 낮음, 수용된 한계).
