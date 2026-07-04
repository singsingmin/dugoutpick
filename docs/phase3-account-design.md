# Phase 3 — 계정/DB Layer 1 설계 (익명 UID 우선 · 관리형 백엔드)

> **상태: 설계 완료 · 미착수(착수 게이트).** 이 문서는 구현 스펙이지 "지금 만든다"가 아니다.
> **착수 결정: Go (2026-07-04)** — 기존 게이트("로컬 재화 루프 재미 신호 후")는 폐기됨. **실제 앱 출시를 지향하며, 계정/서버/DB 기반을 출시 전에 다진다**(로컬 출시 후 유저 마이그레이션 지옥 회피). Stage 0 스파이크 완료(§9), Stage 1(DB)부터 착수. 결정의 맥락은 **[adr.md ADR-023](adr.md)**, 로드맵 위치는 **[roadmap.md E Phase 3](roadmap.md)**.

## 0. 목표 · 범위

로컬(AsyncStorage) 기반 서비스를 **안정적으로 서버·DB·계정 기반으로 이관**하되, **기존 기능이 새 기반에서 그대로 동작**해야 한다.

- **Layer 1(이 문서) = 기반만:** 계정·UID·DB·상태 저장·서버 푸시 토대 + 재화 무결성 최소 경계.
- **Layer 2(예측 리그) = 분리·후행:** roadmap E Phase 4. 이 문서는 얹힐 자리만 표시.
- **백엔드 = Supabase 확정**(Kakao 네이티브 지원이 결정 인자, ADR-023 결정 ④). 관리형이라 "우리가 유지하는 상시 서버 0" 정신(ADR-002/018/020) 유지.

**북극성:** 야구공은 참여·꾸미기·보상 전용. **꿀잼지수·경기 판정·랭킹을 유리하게 만들 수 없다**(무결성 불변).

## 1. 인증 모델 (익명 우선 + opt-in 소셜 연결)

- **첫 실행:** 로그인 강제 없음 → `signInAnonymously()`로 익명 UID 자동 생성 → 즉시 사용. 세션 토큰은 AsyncStorage 저장(앱 재시작 생존, 재설치 시 소실).
- **계정 보호:** 라커룸/설정의 "계정 보호/복구" → `linkIdentity({provider})`로 소셜 연결 → 같은 uid 유지, 데이터 보존 → 재설치/기기변경 복구 가능.
- **프로바이더:** 초기 Android = **Google + Kakao**, Naver 후순위. **iOS 출시 시 Apple 강제**(App Store 4.8 — 제3자 소셜 로그인 제공 시 Apple 필수). 복원 코드는 후행 보조 수단.
- **하드 제약:** 링킹은 반드시 `linkIdentity()` **리다이렉트 경로**. 네이티브 `signInWithIdToken()`은 익명 유저를 잃어버리므로 **금지**. Kakao는 표준 id_token이 없어 어차피 리다이렉트라 일관됨.
- **검증 환경:** OAuth 딥링크는 Expo Go 불가 → **dev build**(`expo start --dev-client`) + 커스텀 scheme + Supabase 리다이렉트 URL 등록 + `expo-auth-session`/`expo-web-browser`.

## 2. 사용 흐름 (F1~F6)

```
F1. 첫 실행(익명 시작)  [온라인 필수]
  앱 열림 → signInAnonymously() → profiles 자동생성(트리거) → 스타터 15 지급(RPC/트리거)
         → 팀 선택 온보딩 → favorite_team 저장 → Today
  ? 오프라인 → "인터넷 연결 필요" 게이트 화면(재시도)

F2. 사용(익명·온라인)
  읽기(게임·순위·꿀잼) = Worker 정적, 계정 무관
  출석 claim = rpc claim_attendance / 스킨 구매 = rpc purchase_skin
  피드백(FINAL) = feedback insert + Discord 웹훅

F3. 사용(익명·오프라인)
  읽기 = 로컬 캐시로 동작
  민감 쓰기(구매·출석·피드백) = 차단(버튼 비활성 + "오프라인" 배지 + 탭 시 토스트)
  적용 스킨 변경 = 로컬 즉시 반영(온라인 시 백그라운드 sync)

F4. 계정 보호 — 케이스 A(신규 소셜 계정)
  "보호하기" → Google/Kakao → linkIdentity 리다이렉트 → 같은 uid 연결, 데이터 보존
             → "계정 보호됨" 표시. 실패/취소 = 익명 그대로(무변화)

F5. 계정 보호/복구 — 케이스 B(연결 대상에 기존 데이터)
  "복구하기"(또는 보호 중 already-linked 에러) → 경고 모달(손실량 명시) → [계속]
    → 기존 계정 signInWithOAuth → 익명 uid orphan → 서버 데이터 로드(서버 우선 전면 교체)

F6. 재설치/기기변경 복구  = F5 재사용
  재설치 → 새 익명 uid(스타터 15만) → "복구하기" → 기존 계정 로그인 → 서버 우선 복구
  (버려지는 익명이 스타터뿐이라 손실 경고 사소. 별도 복구 로직 불필요)
```

- **충돌 정책:** 서버 우선 전면 교체, 자동 병합 없음. 경고 모달은 **케이스 B에서만**(대상 계정에 기존 서버 상태 존재 시). 케이스 A(신규 보호)는 무경고 in-place.

## 3. 데이터 스키마 (Postgres / Supabase)

`auth.users`(익명 + 연결된 소셜 identity)는 Supabase 관리형 — 우리는 uid를 FK로 참조만 한다. **서버 = source of truth, 로컬 = 오프라인 캐시.** 레거시 로컬 데이터 마이그레이션 없음(리셋 수용).

```sql
-- 유저당 1행, auth.users에 1:1
profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance         int  NOT NULL DEFAULT 0,          -- 캐시(ledger가 진실). 드리프트 시 SUM(ledger)로 대사
  applied_skin_id text NOT NULL DEFAULT 'jersey.classic.team',
  favorite_team   text,                             -- 응원팀 코드(teams.json)
  att_streak      int  NOT NULL DEFAULT 0,          -- 캐시
  att_count       int  NOT NULL DEFAULT 0,          -- 캐시
  att_last_date   date,                             -- 마지막 출석(KST YYYY-MM-DD)
  starter_granted boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
)

-- append-only, 잔액의 진실 원천. cap 없이 전체 보관(앱은 최근 N개만 페이징)
baseball_ledger (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            text NOT NULL CHECK (type IN ('earn','spend')),
  amount          int  NOT NULL CHECK (amount > 0),  -- 항상 양수(부호는 type)
  reason          text NOT NULL,                     -- initial_grant|attendance|attendance_bonus|skin_purchase|admin_adjust|(향후)prediction_reward
  label           text,
  related_skin_id text,
  created_at      timestamptz NOT NULL DEFAULT now()
)
CREATE INDEX ON baseball_ledger (user_id, created_at DESC);

-- 보유 스킨(조인 테이블 — 획득 경로·시점 보존)
owned_skins (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skin_id      text NOT NULL,
  acquired_via text NOT NULL,                        -- purchase|event|reward|starter
  acquired_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skin_id)
)

-- 출석: 출석한 날마다 1행. PK가 "하루 1회"를 DB 레벨에서 강제
attendance_claims (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_date date NOT NULL,                          -- KST
  base       int  NOT NULL,
  bonus      int  NOT NULL DEFAULT 0,
  streak_at  int  NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, claim_date)
)

-- 스킨 카탈로그: 구매 검증 SSOT. scoreSkinConfig.ts에서 배포 시 upsert 동기화. 클라 비노출
skins (
  id          text PRIMARY KEY,
  price       int  NOT NULL,
  unlock_type text NOT NULL                          -- free|currency|event|premium
)

-- 경기 후 피드백(ADR-020 보강): DB 저장 추가 + Discord 웹훅 유지
feedback (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id         text NOT NULL,
  thumbs          text NOT NULL CHECK (thumbs IN ('up','down')),
  reason_tag      text,
  reason_label    text,
  predicted_score int,
  factors         jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_id)                          -- 재투표 = upsert(최신 우선)
)
```

### 트리거 · 함수
- `handle_new_user()` — `auth.users` INSERT 트리거 → `profiles` 생성 + 스타터 15(`ledger(initial_grant)` + `balance=15` + `starter_granted=true`).
- `validate_applied_skin()` — `profiles` BEFORE UPDATE 트리거 → `applied_skin_id`가 바뀌면 **free(skins.unlock_type) 또는 owned_skins에 존재**하는지 검증, 아니면 reject.
- `claim_attendance()` — SECURITY DEFINER RPC. KST 날짜·streak 계산(직전 `att_last_date` 기준, 놓치면 리셋), `attendance_claims` INSERT(UNIQUE로 중복 차단) + `ledger(attendance[, attendance_bonus])` + `profiles`(balance·att_*) 원자적 갱신. 반환 `{claimed, earned, base, bonus, streak}`.
- `purchase_skin(skin_id text)` — SECURITY DEFINER RPC. `skins`에서 **서버 가격** 조회(클라 price 불신) → 잔액 검증·차감 → `owned_skins` + `ledger(skin_purchase)` + `profiles.balance`. 반환 `{success, balance, reason?}`.
- `grant_baseballs(...)` — **public 아님**. admin/service-role/서버 잡 전용(내부 테스트 조정·향후 prediction_reward).

### RLS · 권한 (재화 무결성 최소 경계)
| 대상 | 클라(authenticated) 권한 |
|---|---|
| `profiles` | 자기 행 SELECT. **UPDATE는 `favorite_team`·`applied_skin_id` 컬럼만**(컬럼 레벨 GRANT). `balance`·`att_*`·`starter_granted`는 definer 함수만 |
| `baseball_ledger` | 자기 행 SELECT만. INSERT는 definer RPC만 |
| `owned_skins` | 자기 행 SELECT만. write는 definer RPC만 |
| `attendance_claims` | 자기 행 SELECT만. write는 definer RPC만 |
| `skins` | 클라 비노출(definer 함수만 읽음). 표시는 앱 `scoreSkinConfig.ts` |
| `feedback` | 자기 행 SELECT/INSERT(UNIQUE로 dedup) |

> ⚠️ **핵심:** RLS "자기 행 update"만 열면 클라가 `balance=99999`를 직접 쓸 수 있다. **컬럼 레벨 GRANT**로 재화 컬럼을 definer 함수 전용으로 막는 게 Layer 1 무결성의 요체. 이것이 전부이고, 감사·이상탐지·정식 재화 정책은 **Phase 6**에 남는다(ADR-023 결정 ⑥).

## 4. API 표면

| 종류 | 항목 |
|---|---|
| **Auth SDK**(호출만) | `signInAnonymously()` · `linkIdentity({provider})` · `signInWithOAuth({provider})` · `signOut()` · `onAuthStateChange` |
| **RPC**(재화, definer) | `claim_attendance()` · `purchase_skin(skin_id)` |
| **RLS 직접**(비민감) | `profiles.applied_skin_id`/`favorite_team` UPDATE · `feedback` INSERT · 자기 행 SELECT(profiles/ledger/owned_skins/attendance_claims) |
| **내부 전용** | `grant_baseballs()`(admin/service) · 스타터=`handle_new_user` 트리거 |

## 5. 오프라인 정책
- **첫 실행 1회 = 온라인 필수**(익명 sign-in + 스타터). 이후 오프라인 OK.
- **읽기 = 로컬 캐시 미러(AsyncStorage)** 로 오프라인/즉시. 온라인 시 focus/reconnect에 서버에서 갱신.
- **민감 쓰기(구매·출석·피드백) = 온라인 필요.** 오프라인 감지(`useOnline`) 시 버튼 비활성 + "오프라인" 배지, 탭 시 토스트.
- **적용 스킨 변경 = 오프라인 낙관적 허용**(로컬 즉시 + 온라인 시 백그라운드 sync, 충돌 시 `applied_skin_id` last-write-wins).

## 6. 화면 (변화 최소)
| 구분 | 화면 |
|---|---|
| 🆕 신규 | 첫 실행 온라인 게이트 · **계정 보호/복구**(별도 스택, 2분기) · 충돌 경고 모달 |
| ✏️ 수정 | `LockerRoom`(진입 카드 상시 + 상태 뱃지) · `SkinSelect`(구매=온라인/적용=오프라인) · `BaseballCenter`(출석=온라인) · `Settings`(계정 상태·로그아웃) |
| ↔️ 무변경 | Today · GameDetail · MyTeam · Standings 등 읽기 화면 전부 |
| 넛지 | 미보호 배너 = 첫 스킨 구매/7일 연속 출석 직후 1회(닫으면 재노출 X, 기기 로컬 플래그) |

## 7. 코드 아키텍처

**중심 원칙: 기존 context 인터페이스 불변, 구현만 교체 → 화면 무변경.**

```
UI(화면, 무변경)
  ↕ 기존 인터페이스(useScoreSkin 등) 그대로
Context — ScoreSkin / CheerTeam / [신규] Auth
  ↕
Services(레포) — supabase · currency · skins · attendance · profile · feedback
  ↕
Supabase client  +  로컬 캐시 미러(AsyncStorage)
```

- **신규:** `services/supabase.ts`(클라 싱글턴, AsyncStorage 세션저장·`detectSessionInUrl:false`·autoRefresh), `context/Auth.tsx`(세션·링크·복구·상태 파생·딥링크 복귀), `services/{currency,skins,attendance,profile}.ts`(RPC+캐시), `hooks/useOnline.ts`(신규 의존성 `@react-native-community/netinfo`), 화면 `AccountProtect`.
- **교체(인터페이스 유지):** `ScoreSkin.tsx`(claim→RPC·buy→RPC·setSkin→profiles update 낙관적, 초기화는 캐시 로드 후 서버 fetch), `team.ts`(favorite_team), `feedback.ts`(feedback insert + Discord 유지). `notifications.ts`·`load.ts`는 무변경.
- **Provider 트리:** `AuthProvider > ScoreSkinProvider > …`(ScoreSkin이 세션/uid 필요). AuthProvider가 첫 실행 온라인 게이트 담당(익명 세션 확립 전 진입 차단).
- **시크릿:** `SUPABASE_URL`·anon key는 `app.config` extra에 번들(anon key는 공개 전제 — RLS가 보호, service key와 다름).
- **"보호됨" 상태:** 컬럼 저장 X, 세션의 `user.is_anonymous`/`identities`에서 클라가 파생(드리프트 방지).

## 8. Blast radius (이관 대상 = 4개, 나머지 무영향)
읽기 전용 데이터 파이프라인(games/standings/report via Worker, ADR-002/018)은 **계정과 완전 무관**. `data/load.ts` 캐시·`UniformPreset.tsx`(죽은 코드)는 이관 대상 아님.

| # | 상태 | 위치 | 이관 |
|---|---|---|---|
| 1 | 야구공·스킨·출석·거래 | `context/ScoreSkin.tsx` | context 인터페이스 뒤 구현만 스왑 |
| 2 | 응원팀 | `data/team.ts` | `profiles.favorite_team` + 캐시 |
| 3 | 피드백 | `services/feedback.ts` | `feedback` 테이블 + Discord 유지 |
| 4 | 알림 on/off | `utils/notifications.ts` | **기기 로컬 유지**(계정 아님) |

## 9. 구현 순서 (착수 시)
1. **스파이크(첫 태스크·리스크 게이트):** dev build에서 익명 → `linkIdentity` → Kakao 왕복 + Supabase 익명 유저 자동삭제 정책 실측.
2. Supabase 프로젝트 + 스키마·트리거·RPC·RLS·컬럼 GRANT + `skins` 동기화 스크립트.
3. `services/supabase.ts` + `context/Auth.tsx` + 첫 실행 게이트.
4. `ScoreSkin`/`team`/`feedback` 구현 스왑(인터페이스 유지) + `useOnline` 오프라인 게이팅.
5. 계정 보호/복구 화면 + 라커룸 진입점·상태 뱃지 + 넛지.
6. 개인정보처리방침(소셜 연결 기능과 함께) + 클라 디버그 제거.

### Stage 0 스파이크 결과 (2026-07-03 · ✅ 통과)
dev build(EAS development)로 실기기 검증 완료. **핵심 가설 증명: 익명 `signInAnonymously()` → `linkIdentity(google)` → 같은 uid 유지 + `is_anonymous=false` + provider=google** (JWT `sub` 동일 확인). = "익명 데이터 보존하며 소셜 연결" 작동. 본구현 GO.

**실구현 필수 반영 교훈(스파이크에서 확정):**
1. **OAuth 실행 = `Linking.openURL(data.url)` + 딥링크 리스너** — `WebBrowser.openAuthSessionAsync`는 **KakaoTalk 앱 바운스 시 CustomTab이 포그라운드를 잃어 조기 dismiss** → 리다이렉트 유실. `Linking.openURL` + `Linking.addEventListener('url')`로 완료를 잡아야 견고.
2. **리다이렉트 핸들러는 `#access_token`(implicit)·`?code=`(PKCE) 둘 다 처리** — provider/설정별로 형태가 다름(스파이크에선 Google이 `#access_token`으로 옴). code면 `exchangeCodeForSession`, token이면 `setSession`.
3. **Kakao KOE205(미해결·후속):** Supabase Kakao 프로바이더가 `account_email profile_image profile_nickname`을 항상 요청하고 `options.scopes`는 **replace가 아니라 append**. → Kakao 동의항목에 3개(특히 이메일) 설정하거나 Supabase 측 scope 조정 필요. **메커니즘 자체는 Google로 증명됨** — Kakao는 콘솔 설정 과제.
4. **dev build 설치:** EAS `development` 아티팩트 tarball에 `debug/app-debug.apk`(dev client·`__DEV__`=true) + `release/app-release.apk` 둘 다 들어있음 → **debug apk를 설치**해야 디버그 툴/dev client 동작. `eas build:run`은 다중 apk라 대화형 선택 필요(비대화형이면 tarball 추출 후 `adb install debug/app-debug.apk`).
5. **필수 설정:** Supabase **Manual Linking ON**, `app.config` `scheme:"dugoutpick"`, Supabase Redirect URLs에 `dugoutpick://**`, USB 개발은 `adb reverse tcp:8081 tcp:8081` + Metro.
6. **검증 환경:** Expo Go 불가(ADR-014 예외) — dev build 필수 확정.

> 스파이크 코드 = `app/screens/SpikeAuth.tsx`(디버그 게이트) + `app/services/supabase.ts`. throwaway(참고용). 본구현 시 위 교훈 반영해 정식 `context/Auth.tsx`로 재작성.

## 10. Known limitations (수용됨)
- 재설치 → 새 익명 UID → 스타터 15 반복 획득(기기 지문 없이는 불가). 단 소셜 연결 시 서버 우선이라 "익명으로 벌어서 연결로 세탁"은 차단.
- 복구/케이스B로 버려진 고아 익명 계정 누적 = Layer 1 범위 밖(수동/방치 housekeeping).
- 넛지 dismiss 플래그는 기기 로컬 → 재설치 시 재노출 가능(수용).

## 11. Layer 2(예측 리그) 호환 자리
`baseball_ledger.reason`에 `prediction_reward` 추가 + Phase 4에서 `user_predictions`·`daily_honey_result` 테이블 신설(기존 불변). 상세는 roadmap E Phase 3-Pre/4.
