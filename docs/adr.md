# ADR — 기술적 결정사항

각 항목: **결정 / 맥락·의도 / 결과**. AI 에이전트가 우리 철학을 추론하기 위한 문서 — 결정을 뒤집기 전 맥락을 먼저 읽을 것.

전제(모든 ADR의 상위 원칙): **속도 최우선 + 안정성. 서버 없음. 로그인 없음.** 타깃은 코어 야구팬. (계정/DB는 ADR-023에서 **opt-in 로그인 + 관리형 백엔드**로 한정 개정 — 강제 로그인·자체 운영 서버는 여전히 안 함. "우리가 유지하는 서버 0" 정신은 유지.)

---

### ADR-001 — 크로스플랫폼: Expo (React Native)
- **맥락:** iOS/Android 동시, "구현 쉽고 에러 적고 빠른" 스택 요구. 도트 UI를 CSS 스타일로 표현하고 싶음.
- **의도:** JS/CSS 멘탈모델로 도트 UI 자연스럽게 + Expo Go QR로 실폰 즉시 테스트(바이브코딩 속도). 네이티브 빌드 고통 회피.
- **결과:** Flutter 대비 채택. Dart 학습 불필요. 무거운 네이티브 모듈은 지양.

### ADR-002 — 데이터: 서버 없는 정적 JSON 파이프라인
- **맥락:** `서버없음 + 실데이터 + 안정성` 세 제약은 순진하게 동시 만족 불가. 공식 KBO 공개 API 부재(검증됨).
- **결정:** 무료 GitHub Actions가 하루 5회 KBO 스크래핑 → 정적 JSON 커밋 → 앱은 fetch만. **운영 서버 0개.**
- **의도:** "서버 없음"의 정신(유지할 백엔드·비용 없음)은 지키되, 스크래핑을 앱에서 분리해 안정성 확보.
- **결과:** 스크래퍼가 깨져도 앱은 마지막 커밋 JSON/캐시 표시. 공식 튜닝에 앱 재배포 불필요.

### ADR-003 — KBO 비공식 내부 엔드포인트 사용
- **맥락:** 공식 API 없음. 후보: ①공식 동적페이지(Playwright 필요) ②비공식 내부 엔드포인트 ③유료 API.
- **결정:** ②. `Main.asmx/GetKboGameList`(경기·선발·스코어, POST JSON) + 팀순위(`TeamRankDaily.aspx`)·투수ERA(`PitcherBasic`/개별 `PitcherDetail`) 페이지(GET HTML). 이후 일정(`Schedule.asmx/GetScheduleList`)·라인업(`Schedule.asmx/GetLineUpAnalysis`) POST 추가 → 총 5개 소스. 전부 **단순 HTTP, 브라우저 불필요**(스파이크로 검증). 정밀 목록은 code-architecture.md.
- **의도/리스크:** 비공식이라 깨질 수 있음 → ADR-002 파이프라인 구조가 리스크를 격리(앱 영향 없음, 스크립트만 수정). mykbostats는 403 차단으로 제외.

### ADR-004 — 꿀잼지수: 규칙 기반 (AI 아님)
- **맥락:** 핵심 기능. 초기 버전 명세가 "간단한 규칙 기반".
- **결정:** 6요소 가중합(순위근접30·상위권20·폼15·라이벌10·가을야구10·선발15) + 로지스틱 보정. 파이프라인에서 계산.
- **의도:** 투명·결정적·무비용·디버깅 쉬움. 데이터(순위·폼·ERA)만으로 충분히 설득력 있는 점수 산출 가능(검증됨). AI는 비용·환각·지연 리스크라 MVP에 부적합.

### ADR-005 — 한 줄 이유: 규칙 기반 자동 생성
- **맥락:** "점수만 보면 재미없다 → 반드시 한 줄 이유". 
- **결정:** 점수 **기여도 최상위 요소**를 실데이터로 문장 템플릿에 채움. 라이벌전이면 라이벌명 최우선 노출. "상위권 빅매치"는 둘 다 4위 이내일 때만(과장 방지). 관전포인트 3개도 동일 로직.
- **의도:** 점수와 이유가 **항상 논리적으로 일치**(AI 환각 0). 같은 엔진이 카드 한줄 + 상세 관전포인트를 모두 공급.

### ADR-006 — 점수 스케일 보정(로지스틱)
- **맥락:** 원시 가중합은 최고 경기가 ~63점이라 "추천답지 않게" 낮아 보임.
- **결정:** `100/(1+e^-(raw-45)/10)` 로지스틱. 그날 최고 ~83, 시시한 경기 ~12.
- **의도:** 점수 분포를 심리적으로 의미 있게(추천은 높게, 별로는 낮게). center/steep은 튜닝 가능 다이얼. 강도는 현재값으로 충분하다고 확정.

### ADR-007 — 타깃=코어팬 → 가중치 철학
- **결정:** 박빙(순위근접)·라이벌·순위경쟁을 중시. 상위권(강팀) 가중치를 인위적으로 올리지 않음.
- **의도:** 코어팬은 절대적 스타파워보다 **경쟁 긴장감·서사**에 반응. 캐주얼 유입이 가설로 확정되면 상위권 가중 상향이 첫 후보.
- **부속 결정:** 연승·연패 **둘 다** 꿀잼으로 인정(대칭) — 연패 탈출도 서사.

### ADR-008 — 개인화(내 팀 보너스)는 점수에 넣지 않음
- **맥락:** 꿀잼지수에 내 팀 가산 검토했으나 제외.
- **의도:** 꿀잼지수는 **객관 지표로 유지**(팀마다 추천이 달라지면 신뢰·공유성 저하). 개인화는 점수가 아니라 "내 팀 탭"의 필터/강조로 해결.

### ADR-009 — 도트 UI = 레트로 8비트 게임풍
- **결정:** 픽셀 폰트(Galmuri11)+각진 두꺼운 다크 테두리+도트 아이콘. 이미지 금지, CSS 스타일+아이콘(이모지)으로.
- **팔레트(개정 ADR-015):** 당초 '어두운 배경'이었으나, 사용자 제공 참고 목업에 맞춰 **빈티지 라이트**로 전환 — 크림 배경 + 포레스트 그린 크롬 + 골드 꿀잼지수. 8비트 정체성(픽셀폰트·각진 테두리)은 유지.
- **의도:** 개성으로 차별화·기억성. 팀 대표색상을 팀명 텍스트로 활용.

### ADR-015 — 팔레트 라이트 전환 · 목업 정합 · 알림 탭 보류
- **맥락:** 사용자가 참고 화면 목업(크림+그린 빈티지 8비트)을 제공.
- **결정:** ① 팔레트 다크→라이트(크림/그린/골드) 전환(ADR-009 개정). ② 그린 헤더바·섹션 라벨·팀색 팀명·골드 꿀잼 배지로 목업 정합. ③ 선발 비교에 투수 승-패 추가(투수 랭킹표에서 W·L 파싱). ④ **알림 탭은 도입 보류** — 서버 없음(ADR-002)이라 서버발 푸시 불가, 3탭 유지. 로컬 알림(expo-notifications)은 향후 옵션.
- **의도:** 디자인 방향을 사용자 레퍼런스에 일치시키되, 무서버 제약을 깨는 기능(서버 푸시)은 도입하지 않음.

### ADR-010 — 내 팀 탭 = 피드형
- **결정:** 다음경기(꿀잼)+순위+최근결과를 세로 스크롤 피드로.
- **의도:** 단일 화면에서 내 팀 맥락을 한 번에. 구현 단순(목록 합성)하면서 정보 밀도 확보.

### ADR-011 — 영속화 = AsyncStorage (로그인 대체)
- **결정:** 응원팀 선택·데이터 캐시를 기기 로컬에 저장.
- **의도:** 로그인/서버 없이 개인 설정 유지 + 오프라인 생존. 제약(서버·로그인 없음)의 직접 귀결.
- **개정 예고(ADR-023, 미착수):** 계정/DB 착수 시 **계정 상태(야구공·스킨·출석·응원팀)의 진실은 서버(Supabase)로 이동**하고 AsyncStorage는 **오프라인 캐시 + 기기 설정(알림 토글·넛지 dismiss)**으로 역할이 격하된다. 원격 데이터 캐시(load.ts)는 그대로.

### ADR-012 — 앱 언어 = TypeScript
- **맥락:** 구현을 독립 claude 세션(phase)이 자동 실행 → 세션별 **검증 가능성**이 품질을 좌우.
- **결정:** TypeScript. data-schema를 `types.ts`로 명문화. phase AC에 `tsc --noEmit` 포함.
- **의도:** 타입 체크가 독립 세션의 오구현을 컴파일 단계에서 차단. "에러 적고 빠른 완성" 원칙을, 초기 셋업 비용을 감수하고 타입 안전성으로 달성.

### ADR-013 — 픽셀 폰트 = Galmuri11
- **결정:** 무료(OFL) 한글 픽셀폰트 Galmuri11을 `.ttf`로 번들, expo-font로 로드.
- **의도:** 8비트 룩(ADR-009)의 핵심. 한글/숫자/영문 커버리지·가독성 확보. 둥근모 대비 가독성, 시스템 monospace 대비 감성 우위로 채택.

### ADR-014 — Phase 검증 = tsc + expo export (디바이스 실행 검증 안 함)
- **맥락:** Expo 앱은 헤드리스 CI에서 "실행"이 어려움. 그러나 phase AC는 실행 가능 커맨드여야 함.
- **결정:** `tsc --noEmit` + `expo export`(번들 성공)을 합격 기준으로. 실제 디바이스 동작은 사람이 Expo Go로 별도 확인.
- **의도:** 자동화 가능한 최대치(타입·번들 무결성)로 phase를 게이트. 런타임 UI 검증은 범위 밖으로 명시해 phase가 무한정 막히지 않게.
- **예외(ADR-023, 미착수):** OAuth 딥링크(소셜 로그인)는 **Expo Go에서 동작하지 않음** → 계정 기능 검증은 **dev build**(`expo start --dev-client`)로 한다.

### ADR-017 — 누적 적중률 트랙레코드 — frozen 정직성 게이트 + append-only 누적 + 집계 임베드
- **맥락:** 꿀잼지수가 실제로 맞는지 사용자가 객관적으로 확인할 수 없다. `build.mjs`는 FINAL 경기마다 `recap`을 계산하지만 `games.json`은 오늘 경기만 담고 매 빌드 덮어써져 날짜를 넘는 누적이 없다.
- **결정 ①** — 크로스데이트 누적은 별도 **append-only 파일(`recap-history.json`)**. 같은 `gameId`가 이미 있으면 덮어쓰지 않는다(5분 주기 재실행에 중복·드리프트 방지).
- **결정 ②** — **정직성 게이트 = `frozen`**. 경기 전 freeze된 예측(`honjam.frozen===true`)에서만 집계. post-hoc 재계산 pred는 영구 배제. 첫 sighting이 이미 FINAL이어서 경기 전 freeze 없던 경기는 `frozen`이 영원히 false → 누적 영구 제외.
- **결정 ③** — **앱 노출은 별도 fetch 대신 `games.json` 임베드**(`trackRecord` 최상단 필드). 네트워크 표면 0 증가, 앱 코드 변경 최소화.
- **결정 ④** — **표본 < MIN_SAMPLE(10)이면 `ready: false` → 앱은 '집계 중' 표시**. 초기 ~2일(하루 5경기 기준)은 반드시 '집계 중'(과장 방지).
- **결정 ⑤** — `hitRate`(예측 적중 %)와 `bonusRate`(기대 이상 %) **분리, 합산 금지**. 롤링 집계 윈도우 = 최근 WINDOW(50)건.
- **기각안:** ① `recap-history.json` 전체를 앱이 fetch — 시간이 지날수록 무한 증가, 네트워크 낭비. ② `prevStatus`만으로 게이트 — 재시작/재빌드 시 post-hoc 둔갑 버그 발생 가능.
- **의도:** 트랙레코드가 "경기 전 예측" 기준임을 코드 수준에서 강제해 앱이 노출하는 적중률이 과장되지 않도록 보장.

### ADR-018 — 라이브 점수: Cloudflare Worker 엣지 오버레이 (ADR-002 보강)
- **맥락:** 파이프라인은 5분 주기 정적 JSON이라 경기중 점수·이닝을 실시간으로 못 따라간다. "서버 없음"(ADR-002)을 지키면서 라이브 점수를 주려면 상시 운영 백엔드 없이 요청 시점에 KBO 실시간 데이터를 합쳐야 한다.
- **결정:** Cloudflare Worker(`cf-worker/src/index.ts`)를 라이브 오버레이 엣지 함수로 둔다. 앱의 `REMOTE_BASE_URL`이 Worker를 가리킨다. `games.json` 요청 시 GitHub raw 정적 데이터 + KBO 실시간 경기목록을 `Promise.all`로 fetch → `gameId(G_ID)` 기준 병합. 덮어쓰는 것: `status`(LIVE 판정 포함), `score`(LIVE/FINAL), `cancelReason`, `live` 객체(이닝·주자·투수·타자·heat·label). **`honjam`은 손대지 않음**(frozen 정직성 유지). standings/recent/report는 패스스루.
- **상태 판정 버그 수정:** KBO `GAME_SC_ID`는 신뢰 불가(점수 0 표시 버그 원인). `GAME_STATE_SC`가 정확한 상태 필드 — `resolveStatus()`가 취소(`CANCEL_SC_ID`)→종료(`GAME_RESULT_CK`/`GAME_STATE_SC===3`)→라이브(`===2`) 순으로 판정.
- **의도/결과:** Worker는 무상태·무유지보수(상시 서버 아님, 무료 티어 엣지). KBO API가 죽으면 정적 games.json으로 폴백 → 앱은 절대 안 죽음. "서버 없음"의 정신(유지할 백엔드·비용 없음)은 지키되 실시간성을 확보. `liveHeat`/`liveLabel`은 Worker와 build.mjs 양쪽에 동일 구현(수정 시 두 곳 동기 필수).
- **트리거:** 스케줄 cron 신뢰성 우회를 위해 외부 cron(cron-job.org)이 경기시간대 2분(월요·경기없는날 제외) GitHub `workflow_dispatch`를 호출(concurrency 가드). Worker 자체는 요청 기반이라 cron 무관.
- **live fetch 캐시 + stale fallback(2026-07):** Worker가 유저 요청마다 KBO live를 직접 fetch하던 것을 Cloudflare **Cache API**(엣지 colo별)로 감쌈. fresh=LIVE 있으면 15초/없으면 60초 → 신선하면 KBO 미호출(HIT). 만료 시 재fetch(MISS), 실패 시 **stale 캐시(최대 5분) 반환(STALE)**, stale도 없으면 정적 폴백(FALLBACK_STATIC). 캐시 body에 `fetchedAt` 포함, 디버그 헤더 `X-Live-Cache`. 효과: 동시 유저 무관 KBO 호출 급감 + KBO 순간 장애에도 라이브가 뚝 끊기지 않음(앱 우선순위=안 죽는 것). 앱 폴링도 보완 — 전 경기 종료(+끝내기 highlight 없음)·경기 없는 날엔 폴링 중단, foreground/pull-to-refresh로 재개.

### ADR-019 — 꿀잼지수 배지 스킨 시스템 (ScoreSkin)
- **맥락:** 꿀잼지수 배지에 개성을 주되, 유니폼 SVG와 전혀 다른 표현(레트로 전광판)도 한 선택지로 묶고 싶다. 기존엔 유니폼 프리셋(classic/pinstripe/cream)만 있었다.
- **결정:** 스킨을 `kind`로 추상화 — `jersey`(유니폼 SVG, `JerseyScoreBadge`) / `scoreboard`(전광판 View, `ScoreboardScoreBadge`). `ScoreSkinRenderer`가 선택 스킨의 kind로 분기. ID 네임스페이스 `jersey.*`/`scoreboard.*`를 `utils/scoreSkinConfig.ts`에 단일 정의. 전역 상태는 `context/ScoreSkin.tsx`(`useScoreSkin`).
- **마이그레이션:** AsyncStorage 신규 키 `user.scoreSkinId`. 구키 `user.uniformPreset`(classic/pinstripe/cream)은 `normalizeScoreSkinId()`가 `jersey.*`로 변환 후 신규 키에 저장. 구 `context/UniformPreset.tsx`는 죽은 코드(ScoreSkin이 `useUniformPreset` 별칭으로 하위호환 제공).
- **제약:** 전광판은 `uniformPreset`에 넣지 않는다(별도 kind). scoreboard kind는 외부 `GguljamScoreLabel`을 표시하지 않고 내부 헤더에 "꿀잼지수"를 포함(라벨 중복 금지). 유니폼 V6 SVG는 수정하지 않는다.
- **의도:** 표현이 근본적으로 다른 스킨도 단일 선택 UI(SkinSelect)에서 동등하게 다룰 수 있게. 숫자 가독성 최우선.

### ADR-020 — 경기 후 피드백: Discord 웹훅(상시 서버 아님)
- **맥락:** 꿀잼지수 가중치가 검증 안 된 추측이라 실사용 피드백 없이는 튜닝 불가. 수기 수집은 마찰이 높아 실제로 안 됨(시뮬에서 확인). 그러나 "서버 없음"(ADR-002)은 지켜야 함.
- **결정:** FINAL 경기에서만(`status==='FINAL' && honjam!=null`) 👍/👎 + 이유 태그(꿀잼지수 6요소 대응 slug)를 받아 AsyncStorage 저장 + **Discord 웹훅**으로 전송. 웹훅 URL은 `app.config.js`의 `extra.discordWebhookUrl`(`.env.local`→`DISCORD_WEBHOOK_URL`, `.gitignore`). 전송 실패는 무음 처리(앱 크래시·UX 방해 없음).
- **의도:** Discord 웹훅은 우리가 유지하는 백엔드가 아니라 외부 SaaS 수신점이라 "서버 없음" 위배 아님. FINAL 게이팅으로 미완료 경기 노이즈 차단. 수집 표본은 가중치 튜닝 기준 표본 수 충족 시 활용(roadmap.md).
- **보강 예고(ADR-023, 미착수):** 계정/DB 착수 시 피드백을 **서버 `feedback` 테이블(`UNIQUE(user_id, game_id)`)에도 저장**(Discord 웹훅은 유지). "이미 평가함" 상태가 계정을 따라다니고, 튜닝 표본이 유저 단위로 누적된다.

### ADR-021 — live.heat v1.1: raw(무상태)/display(앱) 2층 분리 (ADR-018 보강)
- **맥락:** 초기 liveHeat는 선형 closeF + `85×closeF×(0.45+0.55×inning/9)` 코어라 ① 점수차 변화가 딱딱하고 ② 9회말 끝내기 보너스가 빠지는 순간 숫자가 급락("역전했는데 왜 떨어져?")했다. 또 "방금 동점/추격" 같은 momentum은 **직전 상태**가 있어야 계산 가능한데 Worker는 무상태(ADR-018)라 불가능.
- **결정 ① raw/display 분리:** raw(closeF lookup·비선형 lateF·끝내기/연장/난타전 보너스)는 무상태라 Worker·build.mjs가 계산해 `live.heat`/`live.label`에 담는다. momentum·smooth는 직전 상태가 필요하므로 **앱 클라이언트**가 30초 폴링으로 직전 점수·직전 표시값을 들고 처리(`app/utils/liveHeat.ts`, `useLiveHeatDisplay`).
- **결정 ② 공식 개선:** closeF를 점수차별 lookup으로(0~2점차 확실히 뜨겁게, 6점차+도 0으로 죽이지 않음). lateF에 half-inning 반영(cap 9.5 → 9회초<9회말). 코어 78 + 보너스 헤드룸. label은 우선순위 기반 고정 문구로 교체.
- **결정 ③ smooth:** 30초 폴링 기준 상승은 즉시, 하락은 폴당 최대 15점. 역전 직후 급락 체감 완화. 경기 종료 시 미적용.
- **결정 ③b 역전/동점 이벤트 보너스(2026-07):** momentum이 절대 점수차 변화만 봐서 "역전=드라마"인데 오히려 heat가 떨어지던 문제. **부호 있는 점수차**(홈-원정)의 뒤집힘으로 역전(leadChange)·동점(tieMade)을 감지해 이벤트 보너스 부여 — 역전 기본 10(후반14·9회18·9회말/연장말22)×점수차 multiplier(1점차1.0→4점차+0.25), 동점 +6. **~2분 시간 decay**(30초 단위 1.0→0.7→0.45→0.25→0). 추격(점수차 좁힘)은 이벤트 없을 때만 적용. 이벤트 상태는 앱 display 층(`useLiveHeatDisplay` ref)이 보유(Worker 무상태 유지).
  - **라벨 우선(결정 1):** leadChange 이벤트 라벨(방금 역전!/후반 역전 드라마/9회 역전극/연장 역전극/끝내기 역전극)은 정적 상황 라벨보다 강한 이벤트라 **최상위 raw 라벨도 override**(force). 동점("방금 동점!")은 override 안 함.
  - **끝내기 이벤트(결정 2·보완):** ① **역전 끝내기**(9회말/연장말 지다가 리드, leadChange) = "끝내기 역전극". ② **동점 끝내기(sayonara)**(9회말/연장말 동점→홈 리드, `prevSigned===0 && currSigned>0`) = "끝내기!" **+14, force** — raw 공식은 동점(closeF 1.0)이 1점차(0.94)보다 높아 끝내기 순간 heat가 오히려 떨어지는 사각지대를 momentum 층이 보정(clamp 100). 둘 다 FINAL 후 **2분 highlight 유지**(`walkoffHighlights`, Today가 '지금 볼 각'에 계속 노출).
  - **FINAL 전환 추론:** 역전/끝내기와 동시에 곧장 FINAL이라 LIVE 스냅샷을 못 잡은 경우도, `lastLiveState`(마지막 LIVE 이닝/점수, 모듈 레벨) 기준으로 "직전 9말/연장말 동점 or 홈 열세 + 최종 홈 승"이면 `inferWalkoffOnFinal()`이 highlight를 게임당 1회 추론 등록(Today가 매 로드 시 호출). "종료 시 momentum/smooth 미적용" 원칙의 예외 = 종료 직전 major moment 하이라이트.
- **결정 ④ 중복:** raw core는 Worker(TS)와 build.mjs(ESM)에 **복제 유지**(빌드 구조 차이). 대신 `data-pipeline/liveHeatCore.mjs` 순수 모듈 + `test/liveheat.test.mjs` 골든 테이블로 양쪽 결과가 어긋나지 않게 가드. 추후 `shared/liveHeatCore`로 단일화.
- **의도:** 야구팬 체감(박빙·추격·끝내기)에 맞추되 Worker 무상태 단순함을 유지. 경기 전 꿀잼지수(frozen)와는 끝까지 분리.

### ADR-016 — 꿀잼지수: form 대칭화 + 멸망전(doom) 팩터 (ADR-004/007 개정)
- **맥락:** 코어팬 사용자가 "이번주 진짜 꿀잼은 멸망전(SSG 12연패 vs 키움 8연패)인데 상위권 매치(LG·KT)만 최상단"이라 지적. 요소 분해 결과: ① `form`이 `0.6×최근10승수`라 **지는 팀을 구조적으로 과소평가**(ADR-007의 "연승·연패 대칭" 선언과 모순) ② 멸망전 화제성을 보는 요소 부재.
- **결정:** ① **form 대칭화** — `최근10승수` → `.500에서의 이탈도(|승수-5|)`로 교체해 연패도 연승만큼 기세로 인정. ② **doom 팩터 신설(가중 18)** — 양 팀 모두 5연패↑일 때 더 얕은 쪽 연패 깊이로 강도 산정("누가 먼저 끊나" 서사). 평소 경기는 doom=0이라 **기존 점수 불변**, 멸망전만 상승(SSG·키움 38→81, 상위권은 form 대칭화로 ~3점만 하락).
- **의도/대안:** 상위권을 **깎지 않고**(1·2위 0.5게임차 막상막하는 90점이 정당) 바닥의 서사를 **올리는** 방향. 대안 C(quality→stakes U자 재정의)는 바닥 경기를 일괄 상승시켜 부작용 → 타깃이 명확한 doom 가산(B) 채택. doom은 reason/points에 '연패 탈출 멸망전'으로 노출하되, 상세화면 근거 막대(FACTOR_META)에는 미표시(평소 빈 막대 방지).
- **튜닝 다이얼:** `W.doom`(현 18), doom 발동 임계(현 5연패), form의 0.6/0.4 비중. 매주 결과 보며 조정.

### ADR-022 — 야구공 재화·스킨 구매·출석: 로컬 MVP (계정 前 UX 검증) + 라커룸 IA
- **맥락:** 스킨에 수집 동기를 주려면 재화·구매가 필요하나, 정식 재화는 계정+서버가 선행돼야 함(재설치 소실·치팅·스토어 정책). 그러나 "수집/출석 루프가 실제로 재밌나"는 그 큰 투자(계정·서버·IAP·광고·정책) **전에** 검증하고 싶다. 또 설정 탭이 스킨·야구공 등으로 비대해져 성격이 섞였다.
- **결정 ① 로컬 재화 MVP:** 야구공 재화·스킨 구매·일일 출석을 **AsyncStorage 로컬**로 구현(계정·서버·현금 전부 없음). 스킨 `unlockType` `free`/`currency` + `price`(1~99). 첫 실행 15 지급(1회 플래그), 출석 하루 1회 +5·7일 연속 +20(KST), 놓치면 streak 리셋. 보유 판정 = `free ∥ ownedSkinIds ∥ 적용중`. 구매/출석/충전은 `baseballTx`에 기록. 단일 소스 = `context/ScoreSkin.tsx`.
- **결정 ② 라커룸 IA:** 하단 탭 "설정" → **"라커룸"**(활동·꾸미기·보상 허브: 응원팀·스킨·야구공 센터). 실제 앱 설정(데이터·적중률·앱 정보)은 라커룸 **우상단 톱니 → `Settings` 스택 화면**으로 분리.
- **한계/게이트:** 로컬이라 재설치·기기변경 시 잔액·보유 소실. **정식 수익화(현금 IAP·서버 재화) 전 계정 시스템(roadmap E Phase 3)으로 상태 이관 필수.** 디버그(충전/초기화)는 `EXPO_PUBLIC_DEBUG_TOOLS`로 dev·preview 빌드에서만 노출(production 미노출) — 공개 전 제거(roadmap C).
- **의도:** "서버 없음"(ADR-002) 정신을 지키며(로컬·무현금) 수집 루프의 재미를 **저비용·되돌리기 쉽게** 검증. 반응이 좋아야 계정+서버로 승격. 광고 보상은 구조 슬롯만 열어둠(미구현).
- **승계(ADR-023, 미착수):** 이 로컬 MVP의 상태(야구공·스킨·출석·거래내역)를 서버로 이관하는 설계가 **ADR-023**에서 확정됨. 착수 시 로컬 데이터는 마이그레이션하지 않고 리셋(내부 테스트 2명 수용), 이후 서버가 진실.

### ADR-023 — 계정/DB Layer 1: 익명 UID 우선 인증 + 관리형 백엔드 + 재화 서버 스키마 (설계 확정 · 착수 게이트)
> 전체 상세 설계(사용 흐름 F1~F6·전체 DDL·RPC/RLS·코드 모듈·화면)는 **[phase3-account-design.md](phase3-account-design.md)**. 이 ADR은 결정과 그 맥락만 기록한다.
- **맥락:** 로컬 재화 MVP(ADR-022)는 재설치·기기변경 시 잔액·보유가 소실되고, 서버 푸시 알림·꿀잼 예측 리그(roadmap E Phase 4)·피드백 누적 공식 튜닝(ADR-020)·정식 수익화가 **전부 계정/DB라는 하나의 병목에 걸려** 있다. 서버리스→서버는 되돌리기 큰 전환이라, 구현 전에 **인증 모델·데이터 스키마·백엔드 방향을 ADR로 먼저 확정**하고 착수는 별도 게이트로 둔다. (이 ADR은 "이 방향으로 설계를 확정한다"이지 "지금 구현한다"가 아님.)
- **상위 전제와의 관계(개정):** 파일 상단 "서버 없음·로그인 없음"을 **한정 개정**. ① 로그인은 **opt-in**(첫 진입 강제 없음), ② 백엔드는 **관리형**(Supabase/Firebase)이라 우리가 유지·과금하는 상시 서버는 0 — ADR-002(정적 JSON)·ADR-018(CF Worker)·ADR-020(Discord 웹훅)이 공유하는 "**외부 SaaS는 우리가 유지하는 서버가 아니다**" 계보를 그대로 잇는다. 강제 로그인과 자체 운영 백엔드는 여전히 채택하지 않는다.
- **결정 ① 범위 = Layer 1(기반)만 확정:** 계정·UID·DB·상태 저장·서버 푸시 토대까지가 Layer 1. **예측 리그(Layer 2)와 분리 설계** — 기반은 예측 리그가 안 나와도 자체로 값어치(재설치 소실 해결·서버 푸시·피드백 누적)가 있고, 예측 리그는 "로컬 루프가 재밌나"라는 별도 신호에 걸린 도박이라 한 덩어리로 묶지 않는다. 이 ADR은 Layer 1만 확정, Layer 2는 게이트 조건만 명시.
- **결정 ② 인증 = 익명 UID 우선 + 소셜 opt-in 연결:** 첫 실행 시 로그인 강제 없이 **익명 UID 자동 생성**, 야구공·스킨·출석을 그 UID에 저장 → 즉시 사용. 라커룸/설정의 **"계정 보호하기"**로 소셜 로그인을 **연결(link)**하면 재설치·기기변경 시 복구 가능. 초기 Android = **Google + Kakao**, Naver는 후순위. **iOS 출시 시 Apple 로그인 강제**(App Store 심사 4.8: 제3자 소셜 로그인 제공 시 Apple 로그인 필수). **복원 코드는 후행** 보조 수단(초기 미포함).
- **결정 ③ 충돌 = 서버 우선 전면 교체(자동 병합 안 함):** 새 기기에서 익명 진행분이 있는 채로 **기존 데이터가 있는 소셜 계정**에 로그인하면(케이스 B) 서버 데이터가 진실 — 야구공·출석·보유 스킨·적용 스킨 모두 서버 기준으로 **교체**, 로컬 익명분은 병합하지 않고 버린다. **경고 모달은 케이스 B에서만**(연결 대상 계정에 기존 서버 상태가 있을 때) 하드 컨펌 + 손실량 수치 명시(`"이 기기 진행분(야구공 N·스킨 M개)이 [계정] 데이터로 교체됩니다"` [계속]/[취소]). **케이스 A(기존 데이터 없는 신규 계정 최초 보호)는 무경고 in-place 연결** — 정작 보호로 전환시킬 유저를 겁주지 않기 위함. 내부 테스트 중 예외 복구는 관리자 수동 조정.
- **결정 ④ 백엔드 = Supabase 확정 (첫 구현 태스크 = 스파이크로 리스크 검증):** 이 인증 모델(익명→소셜 link 후 같은 uid 유지)은 Firebase·Supabase 둘 다 네이티브 지원이나, **Kakao가 저울을 기울인다** — Supabase는 **Kakao 네이티브 프로바이더**(`signInWithOAuth('kakao')` + 익명 `linkIdentity('kakao')` in-place)인 반면 Firebase는 **Kakao 커스텀 토큰 발급 서버(Cloud Function)를 직접 운영**해야 해 "운영 서버 0"이 깨지고 익명↔커스텀토큰 link가 지저분하다. Naver는 양쪽 다 커스텀이라 후순위 판단은 백엔드 무관. → **Supabase 확정.** 단 착수 시 **첫 태스크는 스파이크**(dev build에서 익명→`linkIdentity`→Kakao 왕복 + Supabase 익명 유저 자동삭제 정책 실측)로 리스크를 먼저 검증한 뒤 본구현. 인증 링킹은 반드시 `linkIdentity()` 리다이렉트 경로 — 네이티브 `signInWithIdToken()`은 익명 유저를 잃어버리므로 금지.
- **결정 ⑤ 데이터 모델 = 서버 source of truth, 로컬은 오프라인 캐시:** 로컬 데이터는 **날려도 되는 자산**(내부 테스트 2명 리셋 수용) → 레거시 마이그레이션 로직 없음, 2-way merge 없음. 스키마(Postgres/Supabase 기준):
  - `profiles(id PK→auth.users, balance[캐시], applied_skin_id, att_streak[캐시], att_count[캐시], att_last_date[KST], starter_granted, ...)`
  - `baseball_ledger(id, user_id, type earn|spend, amount>0, reason, label, related_skin_id, created_at)` — **append-only, 잔액의 진실 원천**. `profiles.balance`는 트랜잭션 갱신 캐시(드리프트 시 `SUM(ledger)`로 대사).
  - `owned_skins(user_id, skin_id, acquired_via purchase|event|reward|starter, acquired_at, PK(user_id,skin_id))` — 배열 대신 **조인 테이블**(획득 경로·시점 보존, Phase 4/6에서 필요).
  - `attendance_claims(user_id, claim_date[KST], base, bonus, streak_at, PK(user_id,claim_date))` — **PK가 "하루 1회"를 DB 레벨에서 강제**.
  - 이력은 **cap 없이 전체 보관**(로컬 100개 cap 폐지). 앱은 최근 N개만 페이징 조회. 근거: 예측 보상 이력·치팅 조사·감사가 전체 원장을 요구.
- **결정 ⑥ 치팅/RLS = 재화 무결성의 "최소 경계"만 Layer 1:** ⚠️ 이것은 "Phase 6를 앞당김"이 **아니다**. Layer 1이 긋는 건 딱 하나 — **재화 이동(earn/spend)은 클라가 직접 insert 못 하고 서버 RPC(SECURITY DEFINER)로만 처리**한다는 최소 신뢰 경계. 원장 감사 대시보드·이상탐지·레이트리밋·서버 사이드 재화 정책 전체는 **여전히 Phase 6**에 남는다. 즉 Layer 1 = "클라가 잔액을 위조하지 못한다"는 경계, Phase 6 = "서버가 재화를 능동 감시·통제한다". 구체 메커니즘:
  - 재화 뮤테이션 = `claim_attendance()`·`purchase_skin(skin_id)` RPC 2종(+내부 전용 `grant_baseballs`). 원장 기록·잔액 갱신을 서버가 원자적으로.
  - **잔액 보호 = 컬럼 레벨 GRANT** — `profiles`에서 `authenticated` 역할은 `favorite_team`·`applied_skin_id` 컬럼만 UPDATE 허용, `balance`·`att_*`·`starter_granted`는 definer 함수만. (RLS "자기 행 update"만으론 클라가 `balance`를 직접 위조 가능 → 컬럼 권한으로 차단.)
  - `ledger`·`owned_skins`·`attendance_claims`·`skins` = 클라 직접 write 불가(읽기는 자기 행 SELECT), `skins`는 클라 비노출.
- **결정 ⑦ 비민감 쓰기·오프라인·화면·코드구조(설계 논의 확정):**
  - **비민감 쓰기는 RPC 없이 RLS 직접:** `applied_skin_id`(free/owned를 `validate_applied_skin` 트리거로 검증)·`favorite_team` UPDATE, `feedback` INSERT(`UNIQUE(user_id,game_id)`, 재투표=upsert 최신 우선, Discord 웹훅 병행 유지).
  - **오프라인:** 첫 실행 1회 온라인 필수(익명 sign-in+스타터 지급). 이후 **읽기=로컬 캐시 오프라인 지원**, 민감 쓰기(구매·출석·피드백)=온라인 필요(버튼 비활성+"오프라인" 배지+토스트). 적용 스킨 변경은 오프라인 낙관적 허용(로컬 즉시+백그라운드 sync, 충돌 시 last-write-wins).
  - **화면:** 라커룸에 "계정 보호/복구" 진입 카드 상시 + 상태 뱃지. 별도 스택 화면에서 2분기(보호하기=`linkIdentity` / 복구하기=`signInWithOAuth`, already-linked 에러 시 경고 모달 후 sign-in fallback). 미보호 넛지 배너는 첫 구매/7일출석 직후 1회(닫으면 재노출 X). 읽기 화면은 무변경.
  - **코드구조:** 기존 context 인터페이스(ScoreSkin·CheerTeam) **불변**, 구현만 `AsyncStorage → services 레포(Supabase+캐시)`로 스왑(화면 무변경). 신규 `context/Auth.tsx`·`services/supabase.ts`·`services/{currency,skins,attendance,profile}.ts`·`hooks/useOnline.ts`(신규 의존성 `@react-native-community/netinfo`). Provider 트리 `Auth > ScoreSkin`.
  - **스킨 가격 검증 SSOT:** 서버 `skins` 테이블(`scoreSkinConfig.ts`에서 배포 시 upsert 동기화), `purchase_skin`은 클라 price 불신.
  - **내부 테스트 재화 리셋/충전:** 클라 디버그 툴 대신 **Supabase 대시보드 수동 조정**(공개 전 클라 디버그 제거는 roadmap C와 일치).
  - **고아 익명 계정 정리:** 복구/케이스B로 버려진 익명 계정 orphan 누적은 **Layer 1 범위 밖**(소규모라 수동/방치) — known housekeeping.
- **스타터 어뷰징:** 재설치→새 익명 UID→스타터 15개 반복 획득은 기기 지문 없이는 막을 수 없어 **known limitation**으로 명시. 단 기존 소셜 계정 연결 시 서버 우선(결정 ③)이라 "익명으로 벌어서 연결로 세탁"은 차단.
- **개인정보:** 익명 UID는 PII 없음 → **개인정보처리방침은 소셜 연결 시점부터 필수**(Google/Kakao 이메일·프로필 수집). 즉 **익명+서버 저장까지는 방침 없이 선출시 가능** → 소셜 연결 기능과 함께 방침 도입(출시 2단계 분리 가능). 초기 수집은 최소화.
- **착수 결정(2026-07-04): Go — 출시 전 기반 다지기.** 당초 게이트("로컬 재화 루프 재미 신호 후")는 폐기 — 사용자가 실제 출시를 지향하며 계정/서버/DB를 출시 전에 다지기로 함(로컬 출시 후 유저 마이그레이션 회피가 정석). Stage 0 스파이크 완료, Stage 1(DB)부터 착수.
- **호환성(지금 안 만듦):** 예측 리그는 얹히기만 하면 되게 설계 — `baseball_ledger.reason`에 `prediction_reward` 추가, Phase 4에서 `user_predictions`·`daily_honey_result` 테이블만 신설(기존 불변).
- **기각안:** ① **가산 병합**(야구공 합산·streak max) — 재설치 세탁 어뷰징 벡터라 기각(→ 서버 우선). ② **보유 스킨 배열 컬럼** — 획득 경로·시점 유실로 기각(→ 조인 테이블). ③ **Firebase 우선** — Kakao 커스텀 토큰 서버가 "운영 서버 0"을 깨서 후순위(→ Supabase 우세). ④ **강제 로그인** — 진입 장벽으로 기각(→ 익명 우선 opt-in). ⑤ **자체 운영 백엔드** — 유지 비용·상시 서버로 전제 위배라 기각(→ 관리형).
- **의도:** 큰 전환을 되돌리기 쉬운 순서(설계·게이트 먼저, 빌드는 신호 후)로 밟고, "우리가 유지하는 서버 0" 정신을 관리형으로 보존하며, 기반과 예측 리그 도박을 분리해 리스크를 격리한다.
