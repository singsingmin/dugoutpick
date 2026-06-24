# docs-diff: track-record

Baseline: `f212536`

## `docs/adr.md`

```diff
diff --git a/docs/adr.md b/docs/adr.md
index 1911686..c37229b 100644
--- a/docs/adr.md
+++ b/docs/adr.md
@@ -78,6 +78,16 @@
 - **결정:** `tsc --noEmit` + `expo export`(번들 성공)을 합격 기준으로. 실제 디바이스 동작은 사람이 Expo Go로 별도 확인.
 - **의도:** 자동화 가능한 최대치(타입·번들 무결성)로 phase를 게이트. 런타임 UI 검증은 범위 밖으로 명시해 phase가 무한정 막히지 않게.
 
+### ADR-017 — 누적 적중률 트랙레코드 — frozen 정직성 게이트 + append-only 누적 + 집계 임베드
+- **맥락:** 꿀잼지수가 실제로 맞는지 사용자가 객관적으로 확인할 수 없다. `build.mjs`는 FINAL 경기마다 `recap`을 계산하지만 `games.json`은 오늘 경기만 담고 매 빌드 덮어써져 날짜를 넘는 누적이 없다.
+- **결정 ①** — 크로스데이트 누적은 별도 **append-only 파일(`recap-history.json`)**. 같은 `gameId`가 이미 있으면 덮어쓰지 않는다(5분 주기 재실행에 중복·드리프트 방지).
+- **결정 ②** — **정직성 게이트 = `frozen`**. 경기 전 freeze된 예측(`honjam.frozen===true`)에서만 집계. post-hoc 재계산 pred는 영구 배제. 첫 sighting이 이미 FINAL이어서 경기 전 freeze 없던 경기는 `frozen`이 영원히 false → 누적 영구 제외.
+- **결정 ③** — **앱 노출은 별도 fetch 대신 `games.json` 임베드**(`trackRecord` 최상단 필드). 네트워크 표면 0 증가, 앱 코드 변경 최소화.
+- **결정 ④** — **표본 < MIN_SAMPLE(10)이면 `ready: false` → 앱은 '집계 중' 표시**. 초기 ~2일(하루 5경기 기준)은 반드시 '집계 중'(과장 방지).
+- **결정 ⑤** — `hitRate`(예측 적중 %)와 `bonusRate`(기대 이상 %) **분리, 합산 금지**. 롤링 집계 윈도우 = 최근 WINDOW(50)건.
+- **기각안:** ① `recap-history.json` 전체를 앱이 fetch — 시간이 지날수록 무한 증가, 네트워크 낭비. ② `prevStatus`만으로 게이트 — 재시작/재빌드 시 post-hoc 둔갑 버그 발생 가능.
+- **의도:** 트랙레코드가 "경기 전 예측" 기준임을 코드 수준에서 강제해 앱이 노출하는 적중률이 과장되지 않도록 보장.
+
 ### ADR-016 — 꿀잼지수: form 대칭화 + 멸망전(doom) 팩터 (ADR-004/007 개정)
 - **맥락:** 코어팬 사용자가 "이번주 진짜 꿀잼은 멸망전(SSG 12연패 vs 키움 8연패)인데 상위권 매치(LG·KT)만 최상단"이라 지적. 요소 분해 결과: ① `form`이 `0.6×최근10승수`라 **지는 팀을 구조적으로 과소평가**(ADR-007의 "연승·연패 대칭" 선언과 모순) ② 멸망전 화제성을 보는 요소 부재.
 - **결정:** ① **form 대칭화** — `최근10승수` → `.500에서의 이탈도(|승수-5|)`로 교체해 연패도 연승만큼 기세로 인정. ② **doom 팩터 신설(가중 18)** — 양 팀 모두 5연패↑일 때 더 얕은 쪽 연패 깊이로 강도 산정("누가 먼저 끊나" 서사). 평소 경기는 doom=0이라 **기존 점수 불변**, 멸망전만 상승(SSG·키움 38→81, 상위권은 form 대칭화로 ~3점만 하락).
```

## `docs/data-schema.md`

```diff
diff --git a/docs/data-schema.md b/docs/data-schema.md
index 6eaa2d9..b28d3e7 100644
--- a/docs/data-schema.md
+++ b/docs/data-schema.md
@@ -9,6 +9,13 @@
   "date": "20260531",              // YYYYMMDD (KST 기준)
   "dateText": "2026년 5월 31일",
   "updatedAt": "2026-05-31T00:06:00.000Z",  // ISO, 파이프라인 실행시각
+  "trackRecord": {                 // 롤링 적중률 집계(recap-history.json 미러). 옵셔널 — 표본 부족·구버전 시드에서 없을 수 있음(→ '집계 중' 표시)
+    "window": 50,                  // 집계 윈도우(최근 N건)
+    "sampleSize": 23,              // 윈도우 내 실제 집계된 레코드 수
+    "hitRate": 71,                 // 0~100 정수. verdict==='예측 적중' 비율(%)
+    "bonusRate": 17,               // 0~100 정수. verdict==='기대 이상' 비율(%). hitRate와 별개(합산 금지)
+    "ready": true                  // sampleSize >= 10(MIN_SAMPLE)일 때만 true
+  },
   "recommendedGameId": "20260531LTNC0",     // 최고 꿀잼지수 경기, null 가능
   "games": [{
     "gameId": "20260531LTNC0",     // = KBO G_ID (YYYYMMDD+원정코드+홈코드+N)
@@ -28,12 +35,13 @@
       "score": 83,                 // 0~100, 보정 후 표시값
       "reason": "낙동강 더비 · 승률 0.420 완전 동률의 초접전",  // 한 줄 예측(카드용)
       "points": ["낙동강 더비", "...", "..."],  // 관전포인트 최대 3개(상세용)
-      "factors": { "close":1.0, "quality":0.22, "form":0.30, "rivalry":0.7, "playoff":1.0, "pitcher":0.27 }  // 0~1 원시 기여값(디버그/튜닝용)
+      "factors": { "close":1.0, "quality":0.22, "form":0.30, "rivalry":0.7, "playoff":1.0, "pitcher":0.27 },  // 0~1 원시 기여값(디버그/튜닝용)
+      "frozen": true               // 경기 전 freeze된 예측임을 표시(정직성 게이트용). 앱은 무시. 옵셔널 — 경기 전 스냅샷 없이 FINAL로 처음 수집된 경기는 없음(영원히 false)
     }
   }]
 }
 ```
-**nullable 규칙:** `score`는 경기 전 null. `starter`/`starter.era`는 선발 미등록·미규정시 null → UI는 '미정'. `honjam`은 순위 매칭 실패시 null.
+**nullable 규칙:** `score`는 경기 전 null. `starter`/`starter.era`는 선발 미등록·미규정시 null → UI는 '미정'. `honjam`은 순위 매칭 실패시 null. `trackRecord`는 표본 부족(sampleSize < 10)·구버전 시드에서 없을 수 있음(옵셔널) — 이 경우 배지는 '집계 중'으로 표시하는 것이 의도된 동작.
 
 ## standings.json
 10팀 순위표. 내 팀 탭 / 순위 표시용.
@@ -57,3 +65,30 @@
 { "teams": [{ "code": "HT", "name": "KIA", "fullName": "KIA 타이거즈", "color": "#EA0029" }] }
 ```
 코드 매핑: HT=KIA, SS=삼성, LG=LG, OB=두산, KT=KT, SK=SSG, LT=롯데, HH=한화, NC=NC, WO=키움.
+
+## recap-history.json
+크로스데이트 누적 적중률 파일. 파이프라인 산출물. **append-only** — 같은 gameId가 이미 있으면 덮어쓰지 않는다(5분 주기 재실행·재빌드에 중복·드리프트 방지).
+```jsonc
+{
+  "updatedAt": "2026-06-24T10:30:00.000Z",  // ISO, 마지막 갱신 시각
+  "window": 50,                              // 롤링 집계 윈도우(최근 N건). 상수: WINDOW=50
+  "sampleSize": 23,                          // 윈도우 내 실제 집계된 레코드 수
+  "hitRate": 71,                             // 0~100 정수. verdict==='예측 적중' 비율(%)
+  "bonusRate": 17,                           // 0~100 정수. verdict==='기대 이상' 비율(%). hitRate와 별개(합산 금지)
+  "ready": true,                             // sampleSize >= 10(MIN_SAMPLE)일 때만 true. false면 앱은 '집계 중' 표시
+  "records": [                               // append 순서 = 발생 순서. 정렬·재배열 금지
+    {
+      "date": "20260623",                    // YYYYMMDD, 경기 날짜
+      "gameId": "20260623SSLG0",             // KBO G_ID
+      "pred": 78,                            // 경기 전 freeze된 꿀잼지수(honjam.score, frozen===true)
+      "actual": 84,                          // 실제 꿀잼지수(경기 후 재계산)
+      "verdict": "기대 이상"                   // '예측 적중' | '기대 이상' | '기대 이하' | null
+    }
+  ]
+}
+```
+**정직성 게이트:** `records`에 들어가는 항목은 반드시 `honjam.frozen===true`(경기 전 freeze된 예측)에서만 나온다. 첫 sighting이 이미 FINAL이라 경기 전 freeze 없던 경기는 영구 제외. `verdict`가 null인 레코드는 집계에 넣지 않는다.
+
+**롤링 집계:** `hitRate`·`bonusRate`·`sampleSize`는 `records` 배열의 끝 `window`(=50)개 기준. `ready`는 `sampleSize >= MIN_SAMPLE(=10)`일 때만 true.
+
+**알려진 한계:** FINAL 후 KBO 사후 스코어 정정(몰수·기록 정정)은 append-only dedup 특성상 반영되지 않는다(빈도 낮음, 수용된 한계).
```

## `docs/roadmap.md`

```diff
diff --git a/docs/roadmap.md b/docs/roadmap.md
index 9232cf0..490c36c 100644
--- a/docs/roadmap.md
+++ b/docs/roadmap.md
@@ -19,6 +19,7 @@
 
 ## C. 📊 데이터·정확도
 - [ ] **꿀잼지수 공식 실경기 검증·튜닝** — recap(예측 vs 실제 적중률) 데이터 누적 → 가중치 보정.
+  - [x] **누적 트랙레코드 구현** (2026-06-24) — `recap-history.json` append-only 누적 + 롤링 적중률 집계 + `games.json trackRecord` 임베드 + 앱 배지(Today 상단·Settings). 가중치 자동 보정은 표본 충분히 쌓인 후 별도 작업.
 - [x] **ERA 커버리지 개선** (2026-06-02 완료) — 규정 미달 선발도 player ID 개별 조회로 ERA·승·패 표시(하이브리드). 시즌 기록 없는 투수만 '-'.
 - [ ] **라이브 UI 실디바이스 검증** — 데이터는 검증됨. 실제 라이브 중 화면 렌더는 미검증.
 
```

## `docs/spec.md`

```diff
diff --git a/docs/spec.md b/docs/spec.md
index ec2ddce..aecb10e 100644
--- a/docs/spec.md
+++ b/docs/spec.md
@@ -27,12 +27,13 @@ native-stack + bottom-tabs 조합. 화면명은 `app/navigation/` 및 `app/scree
 
 분기 규칙: `Splash`에서 AsyncStorage 응원팀 있으면 `Tabs`, 없으면 `Onboarding`. (상세 → [flow.md](flow.md))
 
-## 3. 데이터 모델 (앱이 소비하는 정적 JSON 3종)
+## 3. 데이터 모델 (앱이 소비하는 정적 JSON 3종 + 파이프라인 누적 파일)
 정밀 스키마·nullable 규칙은 [data-schema.md](data-schema.md). 계약 요약:
 
-- **games.json** — 메인 데이터. `recommendedGameId`(최고 꿀잼, null 가능) + `games[]`(각 경기 + `honjam{score,reason,points,factors}`). `score`는 경기 전 null, `starter`/`era`는 미등록 시 null, `honjam`은 순위 매칭 실패 시 null.
+- **games.json** — 메인 데이터. `trackRecord`(롤링 적중률 집계, 옵셔널) + `recommendedGameId`(최고 꿀잼, null 가능) + `games[]`(각 경기 + `honjam{score,reason,points,factors,frozen?}`). `score`는 경기 전 null, `starter`/`era`는 미등록 시 null, `honjam`은 순위 매칭 실패 시 null. `trackRecord`는 표본 부족·구버전 시드에서 없을 수 있음(옵셔널) — 이 경우 배지는 '집계 중'.
 - **standings.json** — 10팀 순위표. MyTeam / 순위 표시용.
 - **teams.json** — 구단 레퍼런스(코드·팀명·색상). 온보딩이 fetch 전에 필요 → **앱에 번들**.
+- **recap-history.json** (파이프라인 산출물, 앱은 직접 fetch 안 함) — 크로스데이트 누적 적중률. append-only. 롤링 집계값은 games.json의 `trackRecord`로 미러링돼 앱에 전달(별도 fetch 0).
 
 타입은 `app/types.ts` 에 명문화(data-schema 미러). 스키마 변경 시 `types.ts` 와 data-schema.md 를 함께 갱신한다.
 
@@ -46,9 +47,11 @@ native-stack + bottom-tabs 조합. 화면명은 `app/navigation/` 및 `app/scree
 - 꿀잼지수 로직은 이 파일에 **응집**(앱과 공유 안 함). 공식 튜닝 시 앱 재배포 불필요.
 - **실패 시 exit 1** → Actions 가 커밋 안 함 → 앱은 직전 JSON 유지.
 - teams 단일 출처 = `data-pipeline/teams.mjs` → `teams.json`.
+- **트랙레코드 누적:** FINAL 경기 중 `honjam.frozen===true`(경기 전 freeze된 예측)인 것만 `recap-history.json`에 append-only 누적. 롤링 집계(최근 window=50건)를 `games.json`의 `trackRecord`에 임베드해 앱에 전달(별도 네트워크 요청 0 증가).
 
 ## 6. 불변 규칙 (구현 시 깨지 말 것)
 1. 꿀잼지수는 파이프라인 단일 출처. 앱·문서 어디서도 재구현 금지.
 2. 앱은 데이터 표시 전용. 네트워크 실패가 크래시로 이어지면 안 됨(캐시 폴백 필수).
 3. 외부 의존 최소화: 파이프라인 0개, 앱도 무거운 라이브러리 지양.
 4. 데이터 산출물(`data-pipeline/output/*.json`, 앱 번들 JSON)은 Actions 가 자동 갱신 — 수동 재생성·커밋 금지(push 충돌 유발).
+5. **트랙레코드 정직성 게이트:** 적중률 집계는 `frozen===true`(경기 전 freeze) 예측만 포함한다. post-hoc 재계산 예측은 영구 제외. `verdict===null`·`sampleSize < MIN_SAMPLE(10)` 상태는 앱에 노출 금지('집계 중' 표시).
```

## `docs/testing.md`

```diff
diff --git a/docs/testing.md b/docs/testing.md
index 1e66875..a1d7b43 100644
--- a/docs/testing.md
+++ b/docs/testing.md
@@ -25,6 +25,11 @@ node data-pipeline/build.mjs    # exit 0 + output/*.json 생성/갱신
 ```
 - 외부 KBO 엔드포인트에 의존하므로 네트워크 실패 시 exit 1 은 "정상 방어"다(앱은 직전 JSON 유지). AC 작성 시 네트워크 불가 환경을 구분할 것.
 
+**순수 로직 테스트 컨벤션 (파이프라인):**
+- 파이프라인 순수 로직 테스트는 `node:assert` + **의존성 0** 으로 작성하고, `node data-pipeline/test/*.test.mjs` 로 실행한다.
+- **`build.mjs` 는 top-level `main().catch()` 구동이라 import 하면 실제 네트워크 빌드가 돌므로 테스트에서 import 금지.** 순수 로직은 `data-pipeline/recap.mjs` 같은 부작용 없는 모듈로 분리해 테스트한다.
+- 헤드리스 환경에서 dev 번들 시드(`app/assets/data/games.json`)에는 `trackRecord` 가 없어 배지가 '집계 중'으로 뜨는 것이 **정상**(번들 시드는 라이브가 아니므로 트랙레코드가 없는 게 정직). QA 가 버그로 오인하지 않도록 주의.
+
 ## 정책
 1. **Mock 보다 실제 데이터.** 단위 테스트를 도입한다면 KBO 응답을 통째로 mocking 하기보다, `data-pipeline/output/*.json` 실산출물이나 고정 fixture 로 `computeHonjam()` 등 순수 로직을 검증한다. UI 데이터 계약은 실제 JSON 으로 확인.
 2. **순수 로직 우선.** 꿀잼지수 계산처럼 외부 의존 없는 순수 함수가 테스트 1순위 대상.
```

## `docs/user-intervention.md`

```diff
diff --git a/docs/user-intervention.md b/docs/user-intervention.md
index 7c9efae..79eedd8 100644
--- a/docs/user-intervention.md
+++ b/docs/user-intervention.md
@@ -23,4 +23,10 @@
 - **데이터 산출물 수동 재생성 금지** — `data-pipeline/output/*.json` 과 앱 번들 JSON 은 Actions 가 자동 갱신한다. 수동 `build.mjs` 재생성·커밋은 push 충돌을 유발하므로 하지 말 것(코드만 커밋).
 
 ## 항목
-(아직 없음 — 하네스가 차단 지점을 만나면 여기에 추가)
+
+### 2026-06-24 누적 적중률 트랙레코드 — APK 재빌드 + 파이프라인 push 필요
+- 상황: 앱 코드(types.ts·배지 컴포넌트·Today/Settings 화면) 변경이라 APK 재빌드 필요. `build.mjs`·`recap.mjs` 등 파이프라인 코드 변경은 `origin/main` push 해야 Actions가 라이브 반영(로컬 커밋만으로는 안 바뀜). 적중률 표본은 운영 며칠(하루 5경기 기준 최소 2일, sampleSize >= 10) 누적돼야 배지가 '집계 중' → 실수치로 전환되며, 이는 운영시간 의존이지 인간 개입 아님.
+- 필요한 수동 조치:
+  1. `git push origin main` — 파이프라인 코드 Actions 라이브 반영.
+  2. EAS APK 재빌드(`eas build --platform android`) 및 배포.
+- 차단 여부: non-blocking — 코드·테스트는 CLI로 완결, 배포만 사용자 몫.
```
