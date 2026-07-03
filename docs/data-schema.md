# Data Schema

앱이 소비하는 JSON. 파이프라인(`data-pipeline/build.mjs`)이 KBO 실데이터로 생성하고, **앱이 실제로 fetch하는 엔드포인트는 Cloudflare Worker**(`cf-worker`)다. **앱은 읽기 전용 — 꿀잼지수는 파이프라인에서 이미 계산됨**(앱은 재계산 안 함, 의도: adr.md ADR-004).

## Worker 라이브 오버레이 (중요)
앱의 `REMOTE_BASE_URL`은 GitHub raw가 아니라 **Worker**를 가리킨다(ADR-018). Worker가 경로별로:
- **`games.json`**: 정적 파이프라인 JSON 위에 KBO 실시간 데이터를 덧씌운다 — `status`(LIVE 포함 재판정), `score`(LIVE/FINAL), `cancelReason`, `live`(라이브 오버레이 객체). `honjam`은 손대지 않음(frozen 그대로). KBO API 실패 시 정적 데이터로 폴백.
- **그 외(`standings.json`/`recent.json`/`report.json`)**: GitHub raw 패스스루.

따라서 아래 스키마에서 `status: 'LIVE'`, `live`, FINAL의 `score`/`recap`/`decision`, `cancelReason`은 **Worker가 채우거나 갱신**하는 필드다(정적 JSON에는 비어있거나 직전 값).

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
    "ready": true,                 // sampleSize >= 10(MIN_SAMPLE)일 때만 true
    "recentRecapPreview": [        // 옵셔널. ready=false일 때만 존재 — 최근 최대 5경기의 frozen 예측·판정 배열(newest first). 선별 없음('기대 이하'도 포함). ready=true면 파이프라인이 이 필드를 생략함
      { "pred": 78, "verdict": "기대 이상" }
    ]
  },
  "recommendedGameId": "20260531LTNC0",     // 최고 꿀잼지수 경기, null 가능
  "games": [{
    "gameId": "20260531LTNC0",     // = KBO G_ID (YYYYMMDD+원정코드+홈코드+N)
    "time": "14:00",
    "stadium": "창원",
    "status": "SCHEDULED",         // SCHEDULED | LIVE | FINAL | CANCELED (LIVE는 Worker가 판정)
    "cancelReason": null,          // CANCELED일 때 사유(예: "우천취소"), 아니면 null (Worker가 CANCEL_SC_NM로 채움)
    "broadcast": "M-T",            // 중계 채널코드(원문), 표시용
    "away": {
      "code": "LT",                // 팀코드, teams.json과 매칭
      "name": "롯데",
      "rank": 8,                   // 당일 순위
      "score": null,              // LIVE/FINAL일 때만 숫자(Worker 오버레이), 아니면 null
      "starter": { "name": "비슬리", "era": 3.71, "w": 4, "l": 2 }  // 미등록/미규정시 null 또는 필드 null
    },
    "home": { /* away와 동일 구조 */ },
    "honjam": {                    // 순위 데이터 없으면 null (계산 불가)
      "score": 83,                 // 0~100, 보정 후 표시값
      "reason": "낙동강 더비 · 승률 0.420 완전 동률의 초접전",  // 한 줄 예측(카드용)
      "points": ["낙동강 더비", "...", "..."],  // 관전포인트 최대 3개(상세용)
      "factors": { "close":1.0, "quality":0.22, "form":0.30, "rivalry":0.7, "playoff":1.0, "pitcher":0.27 },  // 0~1 원시 기여값(디버그/튜닝용)
      "frozen": true               // 경기 전 freeze된 예측임을 표시(정직성 게이트용). 앱은 무시. 옵셔널 — 경기 전 스냅샷 없이 FINAL로 처음 수집된 경기는 없음(영원히 false)
    },
    "live": {                      // status==='LIVE'일 때만 Worker가 채움. 아니면 null
      "inning": 8, "half": "B",   // 이닝 / 'T'(초)·'B'(말)
      "out": 2,
      "b1": true, "b2": false, "b3": true,  // 루상 주자 점유
      "pitcher": "원종현",          // 현재 수비팀 투수
      "batter": "최정",             // 현재 공격팀 타자
      "heat": 78,                  // '지금 볼 각' 실시간 흥미도 0~100 (liveHeat: 점수차·이닝·끝내기/연장 기반)
      "label": "8회말 1점차 접전"     // 상황 요약 문자열(liveLabel)
    },
    "recap": {                     // status==='FINAL'일 때만. 경기 후 꿀잼결산
      "actual": 84,                // 실제 꿀잼(예측과 같은 0~100 보정 척도)
      "verdict": "예측보다 더 꿀잼! 🔥"  // 판정 문구, null 가능
    },
    "decision": {                  // status==='FINAL'일 때만. 승/패/세이브 투수
      "win": "임찬규", "lose": "원태인", "save": "고우석"  // 각각 null 가능(무승부·세이브 없음)
    },
    "lineup": {                    // SCHEDULED/LIVE만 — null이면 미제공
      "confirmed": true,           // 정식 라인업 확정 여부
      "home": [{ "order": 1, "pos": "지명타자", "name": "..." }],  // 타순
      "away": [/* 동일 */]
    }
  }]
}
```
**nullable 규칙:** `score`는 경기 전 null(LIVE/FINAL에서 Worker가 채움). `starter`/`starter.era`/`w`/`l`은 미등록·미규정시 null → UI는 '미정'. `honjam`은 순위 매칭 실패시 null. `live`는 LIVE에서만, `recap`/`decision`은 FINAL에서만, `lineup`은 SCHEDULED/LIVE에서만 존재(그 외 null). `trackRecord`는 표본 부족(sampleSize < 10)·구버전 시드에서 없을 수 있음(옵셔널) — 이 경우 배지는 '집계 중'으로 표시하는 것이 의도된 동작.

### `live.heat` / `live.label` — '지금 볼 각' 실시간 흥미도 (v1.1)
경기중 점수판 우상단에 "지금 N"으로 노출(LiveCard). 꿀잼지수(경기 전 예측, frozen)와 **별개**의 실시간 지표. **2층 구조**(ADR-021):

**raw (Worker·build.mjs, 무상태)** — `live.heat`/`live.label`에 담기는 값. `data-pipeline/liveHeatCore.mjs` 단일 정의(Worker는 동일 로직 복제):
- `closeF` = 점수차별 lookup(0=1.0 / 1=0.94 / 2=0.78 / 3=0.58 / 4=0.38 / 5=0.20 / 6+=0.06). **절대 점수차**라 이기든 지든 동일.
- `lateF = 0.35 + 0.65 × (min(inning + (말?0.5:0), 9.5) / 9.5)^1.2` — 후반·9회말로 갈수록 비선형 가산(9회초<9회말).
- `heat = 78 × closeF × lateF` + 보너스(9회말·연장말 1점차↓ +12 / 9회초 등 1점차↓ +5 / 연장 2점차↓ 최대+12 / 난타전 3점차↓ 최대+8). clamp 0~100.
- `label`: 우선순위 라벨("끝내기 한 방 찬스" / "연장 혈투 진행 중" / "9회 1점 승부" / "후반 박빙 승부" / "점수 나는 난타전" / "초반 팽팽한 흐름" / "점수차가 벌어진 경기" / "경기 흐름 체크 중").

**display (앱 전용, `app/utils/liveHeat.ts`)** — 화면 표시값. Worker가 무상태라 직전 상태가 필요한 보정은 앱이 30초 폴링으로 처리:
- **momentum**: 직전 폴 대비 점수차가 좁혀지면 가산(방금 동점 +6 / 큰 추격 +7 / 추격 +5) + 라벨 덮어쓰기("방금 동점, 흐름 요동" / "추격전 불붙는 중", 단 9회·끝내기 최상위 라벨은 유지).
- **smooth**: 상승은 빠르게, 하락은 한 번에 최대 15점까지만(역전 시 숫자 급락 체감 완화). 경기 종료 시 미적용.
- 참고: 1점차 추격팀이 역전하면 raw heat는 떨어질 수 있으나(9회말 끝내기 +12 소멸, 역전=긴장 완화), momentum·smooth가 급락을 완화한다.

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

## recent.json
팀별 최근 경기 결과. 내 팀 탭(MyTeam) 피드의 '최근 결과' 표시용.
```jsonc
{
  "updatedAt": "...",
  "recent": {                      // 팀코드 → 최근 경기 배열(오래된→최신)
    "LG": [{
      "date": "20260530",
      "oppCode": "OB",             // 상대 팀코드
      "isHome": true,
      "sf": 7,                     // 득점(우리 팀)
      "sa": 3,                     // 실점
      "result": "W"                // 'W' | 'L' | 'D'
    }]
  }
}
```

## report.json
월요 리포트(주간 결산 + 이번 주 빅매치). MondayReport 컴포넌트용.
```jsonc
{
  "updatedAt": "...",
  "lastWeek": {
    "range": ["20260623", "20260629"],
    "team": { "LG": { "w": 4, "l": 2, "d": 0, "rank": 1, "note": "..." } }  // 팀코드별 지난주 성적
  },
  "thisWeek": {
    "range": ["20260630", "20260706"],
    "top": [{ "away": "SS", "home": "LG", "pred": 88, "reason": "...", "dateStart": "...", "dateEnd": "..." }],  // 이번주 추천 빅매치
    "team": { "LG": [{ "date": "...", "away": "...", "home": "...", "awayStarter": "...", "homeStarter": "..." }] }  // 팀별 이번주 일정
  }
}
```

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

## 클라이언트 로컬 상태 (AsyncStorage) — 서버·로그인 없음 (ADR-011/022)
파이프라인 JSON과 **별개**로, 앱이 기기에 저장하는 사용자 상태. `context/ScoreSkin.tsx`가 스킨·야구공 단일 소스.
| 키 | 내용 |
|---|---|
| `user.scoreSkinId` | 적용 중 스킨 id (예: `jersey.classic.team`) |
| `user.ownedSkinIds` | 구매한 스킨 id 배열(JSON). free·적용중은 미포함 — 보유는 `free∥구매∥적용중`으로 판정 |
| `user.baseballBalance` | 야구공 잔액(정수) |
| `user.initialBaseballGrant` | 첫 지급 완료 플래그(`'1'`) — 중복 지급 방지. 첫 실행 시 15 지급 |
| `user.baseballTx` | 거래 내역(최근 100건, newest-first) |
| `user.attClaimDate` / `attStreak` / `attCount` | 출석 마지막 수령일(KST `YYYY-MM-DD`) / 연속 / 누적 |
| `user.uniformPreset` | (구버전) → `normalizeScoreSkinId()`가 마이그레이션 |
| `dugout.feedback.{gameId}` | 경기 후 피드백(ADR-020) |

```jsonc
// BaseballTx (user.baseballTx 요소)
{ "id": "...", "type": "earn",              // 'earn' | 'spend'
  "amount": 5,                              // 항상 양수(부호는 type)
  "reason": "attendance",                   // initial_grant | attendance | attendance_bonus | skin_purchase | debug_charge | debug_reset
  "label": "출석 보상", "createdAt": "ISO", "relatedSkinId": "ticket.retro" }  // relatedSkinId 옵셔널
```
스킨 config(`scoreSkinConfig.ts`, JSON 아님): `unlockType` `'free'|'currency'`, `price`(1~99), `currencyType`(`'baseball'`). 가격: 컬러10·화이트15·줄무늬20·전광판/티켓/홈플레이트30·메달60, 기본 유니폼=free.
⚠️ **전부 로컬** — 재설치/기기변경 시 소실. 계정 前 UX 검증 단계(ADR-022). 정식 수익화 전 서버 이관 필수.

## 서버 스키마 (Phase 3 계정/DB, 설계 완료 · 미착수)
계정/DB 착수 시 위 로컬 상태의 **진실은 Postgres(Supabase)로 이동**하고 AsyncStorage는 오프라인 캐시로 격하된다. 서버 테이블 6종(`profiles`·`baseball_ledger`[append-only 원장]·`owned_skins`·`attendance_claims`·`skins`·`feedback`) + 트리거·RPC·RLS·컬럼 레벨 GRANT 전체 DDL은 **[phase3-account-design.md §3](phase3-account-design.md)**. 재화 이동은 서버 RPC(`claim_attendance`·`purchase_skin`) 전용, 잔액 컬럼은 definer 함수만 write(무결성 최소 경계, ADR-023).
