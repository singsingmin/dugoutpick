# Stage 6 — 예측 리그 칭호 · 라커룸 배경 설계 (Prediction League Cosmetics)

> **성격:** 구현 전 확정 설계 문서. "간단히 MVP로 만들고 나중에 개선"이 아니라, 정책·DB·API·권한·UI·운영·정산·엣지케이스·테스트 기준을 먼저 전부 정하고 **구현만 단계별로 진행**한다.
> **상태:** 정책 결정 1차 완료(2026-07-07) → 감사에서 발견한 5개 공백에 대한 결정 2차 완료(2026-07-07, 이 리비전에서 반영). **DB 스키마는 1차 결정분(`0007_prediction_cosmetics.sql`)까지만 구현됨 — 이번 리비전의 신규 결정(동점자 처리·award_history·admin 도구·닉네임 정책)은 아직 SQL 미작성.** UI 전체 미구현.
> **관련 문서:** [prediction-league-design.md](prediction-league-design.md)(예측 리그 본체) · [phase3-account-design.md](phase3-account-design.md)(재화/스킨 기반) · [roadmap.md](roadmap.md) E Phase 3-Pre/4.
> **범위 제외(이번 Stage 6에서 다루지 않음):** 프로필 프레임, 예측 카드 꾸미기, 공유 카드, 친구 프로필 방문.

---

## 0. 목표

예측 리그 참여·성과(적중·연속·랭킹)를 라커룸의 꾸미기 자산(칭호·배경)으로 되돌려주는 보상 루프를 완성한다. 야구공(재화)의 소비처를 스킨에서 라커룸 배경까지 확장하고, 칭호는 재화로 살 수 없는 "명예" 축으로 분리해 재화 무결성 원칙([[dugoutpick-tech-decisions]] 전 Phase 공통: "야구공으로 판정·랭킹을 유리하게 만들 수 없다")을 지킨다.

---

## 1. 현재 상태 감사 (2026-07-07 기준, 최초 감사 결과 — 변경 없음)

### 1-1. 정책 전제 검증

| 전제 | 상태 | 근거 |
|---|---|---|
| 칭호 구매 안 함 | ✅ 이미 구현됨 | `owned_titles`에 구매 RPC 자체가 없음 |
| 칭호는 야구공으로 못 삼 | ✅ 이미 구현됨 | 위와 동일 |
| 칭호 획득 경로 = achievement/monthly_rank/season_rank/event/admin(+default) | ⚠️ 일부 구현됨 | achievement·default·monthly_rank·season_rank는 지급 로직 있음. **event·admin은 §7-3에서 이번 리비전에 도구 사양 확정(§4-2b, §7-3)** |
| 라커룸 배경 = 야구공 소비처 | ⚠️ 일부 구현됨 | DB/RPC는 있음. **시각 적용 방식은 이번 리비전 §6-1에서 확정** |
| 일반 배경 = 야구공 구매 가능 | ✅ DB/RPC 구현됨 | |
| 명예 배경 = 월간/시즌 보상 전용, 구매 불가 | ✅ 구현됨 | |
| 프로필 프레임 등 4종 제외 | ✅ 맞음 | |

### 1-2. 최초 감사에서 발견한 공백 10개 — 이번 리비전에서의 해소 현황

| # | 공백 | 이번 리비전 결과 |
|---|---|---|
| 1 | 배경 시각 적용 미정의 | ✅ §6-1에서 확정(LockerRoom 전체 배경 A안) |
| 2 | 클라 카탈로그 없음 | 변경 없음 — §3-3에 그대로 유지(구현 체크리스트 항목) |
| 3 | 실제 에셋 0개 | 변경 없음 — 후속 제작 필요 |
| 4 | event/admin 지급 도구 없음 | ✅ §4-2b·§7-3에서 확정(전용 RPC 4종 + 감사로그) |
| 5 | 칭호 표시 UI 전무 | 변경 없음 — §6-2 구현 체크리스트 유지 |
| 6 | 정산 결과 가시성 없음 | 변경 없음 — 이번 리비전 스코프 밖(후속 검토) |
| 7 | event 칭호 트리거 미정의 | 부분 해소 — 지급 **도구**는 확정(§4-2b), 어떤 이벤트가 트리거인지는 여전히 운영자 재량(사전 카탈로그 없음, 의도된 설계 — 이벤트는 원래 비정형) |
| 8 | 닉네임 변경 정책 불완전 | ✅ §8-4에서 확정(월 1회, KST 기준) |
| 9 | 랭킹 동점자 처리 없음 | ✅ §8-2·§8-3에서 확정(4단계 타이브레이크 + 그래도 동률이면 공동수상) |
| 10 | 탈퇴 시 명예 기록 처리 | ✅ §3-4·§9에서 확정(`award_history` 익명화 보존) |

---

## 2. 정책 결정 요약 (확정, 이번 리비전 반영)

| 항목 | 결정 |
|---|---|
| 칭호 구매 | 불가 |
| 칭호 획득 경로 | `default`(리그 참여) · `achievement` · `monthly_rank` · `season_rank` · `event` · `admin` |
| 배경 구매 | 일반 배경 4종만 야구공 구매 가능 |
| 배경 명예 보상 | 월간/시즌 챔피언 전용, 구매 불가 |
| 일반 배경 4종 | 클래식 더그아웃(40) · 그린 필드 라커(40) · 야간 구장(50) · 라인업 보드룸(50) |
| 명예 배경 2종 | 월간 챔피언 룸 · 시즌 트로피룸 |
| 업적 칭호(7종) | 신입 관전러 · 첫 예측 완료 · 첫 적중 완료 · 3연속 적중러 · 5연속 적중러 · 꿀잼 탐정(누적 적중 10) · 야구각 감별사(누적 유효 참여 30) |
| 월간 보상 | 매월 1일 03:00 KST. 예측왕/TOP10(참여자 20↑)/감별왕(최소 5회)/챔피언 룸 — **동점자는 4단계 타이브레이크, 그래도 같으면 공동 수상**(§8-2) |
| 시즌 보상 | 시즌 종료 다음날 03:00 KST 수동 실행. 예측왕/TOP10(참여자 50↑)/감별왕(최소 30회)/꿀잼 레전드(=예측왕과 동일 인물)/트로피룸 — 동점자 규칙 동일 |
| **라커룸 배경 시각 적용** | **LockerRoom 화면 전체 배경**으로 적용 + dim/cream 오버레이. PredictionLeague/랭킹 화면엔 미적용(§6-1) |
| **공개 랭킹 표시** | 닉네임 + 칭호만(배경은 랭킹 화면에 안 보임) |
| **닉네임 정책** | 최초 설정 자유, 이후 월 1회 변경(KST), `set_nickname` RPC 전용, **중복 허용**, 길이 2~10자 |
| **랭킹 동점자** | 포인트 → 적중 수 → 적중률 → 최고 연속 순 타이브레이크, 끝까지 같으면 공동 수상(TOP10 경계도 동일 규칙 적용) |
| **탈퇴 시 기록** | 개인 데이터 삭제, **월간/시즌 수상 이력만 `award_history`에 익명 스냅샷 보존**. 탈퇴 유저는 "탈퇴한 사용자"로 표시 |
| **event/admin 지급** | 관리자 UI 없음. **service_role 전용 RPC 4종**(`admin_grant_title`/`admin_grant_background`/`admin_revoke_title`/`admin_revoke_background`) + 모든 호출을 `cosmetic_admin_events`에 감사 로그 |
| 지급 시점 | achievement=정산 시점(신입 관전러만 예외=닉네임 설정 시점) / monthly_rank·season_rank=배치 정산 |
| 중복 방지 | `owned_titles`/`owned_backgrounds` PK — 재지급 시 자동 no-op |

---

## 3. 데이터 모델

### 3-1. 이미 존재 (0006 + 0007, 변경 없음)

```
owned_titles(user_id, title_id, acquired_via, acquired_at)          PK(user_id, title_id)
owned_backgrounds(user_id, background_id, acquired_via, acquired_at) PK(user_id, background_id)
backgrounds(id, price, unlock_type)                                  -- 카탈로그, 클라 비노출
baseball_ledger.related_background_id
```

### 3-2. `prediction_stats` 변경 필요 (닉네임 정책 반영, 미구현)

```
prediction_stats(
  user_id, nickname, total_predictions, total_hits, current_streak, best_streak,
  equipped_title, equipped_background,
  nickname_changed_month text,   -- ★신규: 마지막 닉네임 변경월 "YYYYMM"(KST). 최초 설정 시 NULL 유지(자유 변경 소진 안 함).
  updated_at
)
```

**변경 사항:**
- `nickname unique` 제약 **제거**(닉네임 중복 허용 결정 반영). 0006에서 `unique`로 만들었던 것을 0008에서 drop.
- `nickname` 길이 체크 2~16 → **2~10**로 축소.
- `nickname_changed_month` 컬럼 추가 — `set_nickname`이 "이번 달에 이미 변경했는가"를 판단하는 근거.
- **컬럼 GRANT 수정:** 기존 `grant update (nickname, equipped_title, equipped_background) to authenticated`에서 **`nickname` 제거** — 닉네임은 반드시 `set_nickname` RPC로만 변경(결정 5 "클라이언트 직접 update 금지"). `equipped_title`/`equipped_background`만 컬럼 GRANT 유지.

### 3-3. 클라 정적 카탈로그 (신규 필요, 미구현 — 변경 없음)

- `app/utils/lockerBackgroundConfig.ts`, `app/utils/titleConfig.ts` — §1-2 공백 #2·#5 그대로, 이번 리비전에서 추가 결정 없음(구현 단계에서 작성).

### 3-4. `award_history` — 명예 기록 영구 보존 (신규, 미구현)

```sql
create table public.award_history (
  id               uuid primary key default gen_random_uuid(),
  period_type      text not null check (period_type in ('monthly','season')),
  period_label     text not null,        -- "202608" 또는 시즌 라벨 "2026"
  category         text not null,        -- champion|top10|detective|legend
  user_id          uuid references auth.users(id) on delete set null,  -- 안전망(§9 참고, 실제 null화는 트리거가 명시적으로 함)
  nickname_snapshot text not null,       -- 수상 당시 닉네임(현재 닉네임이 바뀌어도 불변)
  is_user_deleted  boolean not null default false,
  granted_at       timestamptz not null default now()
);
alter table public.award_history enable row level security;
```

**권한:** 전체 공개 read 허용(명예의 전당 화면용, §6-2b) — 단, **select 컬럼은 `period_label`, `category`, `nickname_snapshot`, `is_user_deleted`, `granted_at`만 노출**. `user_id`는 select 정책에서도 제외하거나(뷰로 감싸서) 애초에 클라가 볼 필요 없는 내부용으로만 취급(§5 참고).

**탈퇴 처리 — 명시적 BEFORE DELETE 트리거로 처리(FK의 암묵적 `on delete set null` 타이밍에 의존하지 않음):**

```sql
create or replace function public.anonymize_award_history_on_user_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.award_history
    set user_id = null, is_user_deleted = true
    where user_id = old.id;
  return old;
end;
$$;
create trigger on_auth_user_deleted
  before delete on auth.users
  for each row execute function public.anonymize_award_history_on_user_delete();
```

`award_history.user_id`에 `on delete set null` FK를 걸어두는 것은 **안전망**(위 트리거가 실패해도 참조 무결성은 깨지지 않도록)이고, 실제 `is_user_deleted=true` 플래그는 위 트리거가 명시적으로 세팅한다.

**⚠️ 확인 필요:** `award_history` 조회 화면(명예의 전당)이 이번 문서 처음에 언급되진 않았으나, "탈퇴한 사용자로 표시"가 의미를 가지려면 이 기록을 **보여주는 화면이 있어야** 한다. §6-2b에서 신규 화면으로 제안 — 스코프에 포함할지 확인 요청.

### 3-5. `cosmetic_admin_events` — 관리자 지급/회수 감사 로그 (신규, 미구현)

```sql
create table public.cosmetic_admin_events (
  id           uuid primary key default gen_random_uuid(),
  action       text not null check (action in ('grant_title','grant_background','revoke_title','revoke_background')),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  item_id      text not null,          -- title_id 또는 background_id
  reason       text not null,          -- 필수 — 사유 없는 관리자 조작 금지
  performed_by text,                   -- 사람이 자기 이름/식별자를 남기는 자유 텍스트(선택, 없으면 NULL)
  created_at   timestamptz not null default now()
);
alter table public.cosmetic_admin_events enable row level security;
revoke all on public.cosmetic_admin_events from anon, authenticated;  -- service_role만 접근(감사로그는 클라 비노출)
```

### 3-6. title_id / background_id 명명 규칙 (변경 없음)

- 업적: `title.first_prediction`, `title.first_hit`, `title.streak3`, `title.streak5`, `title.honey_detective`, `title.veteran30`, `title.rookie_watcher`
- 월간: `title.monthly_champion.<YYYYMM>`, `title.monthly_top10.<YYYYMM>`, `title.monthly_detective.<YYYYMM>`
- 시즌: `title.season_champion.<라벨>`, `title.season_top10.<라벨>`, `title.season_detective.<라벨>`, `title.season_legend.<라벨>`
- 배경: `lockerbg.<slug>`

---

## 4. API / RPC 명세

### 4-1. 이미 구현(0006+0007, 이번 리비전에서 로직 변경 필요분 표시)

| RPC | 상태 |
|---|---|
| `grant_title` / `grant_background` | 변경 없음 |
| `purchase_background` | 변경 없음 |
| `settle_prediction` | 변경 없음(업적 6종 로직 그대로) |
| `set_nickname` | **변경 필요** — §4-2a |
| `grant_monthly_rewards` / `grant_season_rewards` | **변경 필요** — 동점자 처리(§8-2·§8-3), `award_history` 기록 추가 |

### 4-2a. `set_nickname` 재설계 (닉네임 정책 반영)

```sql
create or replace function public.set_nickname(p_nickname text)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cur_nickname text; cur_month text;
  this_month text := to_char((now() at time zone 'Asia/Seoul')::date, 'YYYYMM');
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_nickname is null or length(p_nickname) < 2 or length(p_nickname) > 10 then
    return json_build_object('success', false, 'reason', 'bad_length');
  end if;

  insert into public.prediction_stats (user_id) values (uid) on conflict (user_id) do nothing;
  select nickname, nickname_changed_month into cur_nickname, cur_month
    from public.prediction_stats where user_id = uid for update;

  -- 최초 설정(cur_nickname is null)은 자유. 이후 변경은 이번 달에 이미 바꿨으면 거부.
  if cur_nickname is not null and cur_month = this_month then
    return json_build_object('success', false, 'reason', 'rate_limited');
  end if;

  update public.prediction_stats
    set nickname = p_nickname,
        nickname_changed_month = case when cur_nickname is null then nickname_changed_month else this_month end,
        updated_at = now()
    where user_id = uid;

  if cur_nickname is null then
    perform public.grant_title(uid, 'title.rookie_watcher', 'default');
  end if;

  return json_build_object('success', true, 'nickname', p_nickname);
end;
$$;
revoke execute on function public.set_nickname(text) from anon;
```

**참고:** 닉네임 중복을 허용하므로 `unique_violation` 예외 처리는 제거됨(더 이상 발생 안 함).

### 4-2b. 관리자 RPC 4종 (신규)

```sql
create or replace function public.admin_grant_title(p_user_id uuid, p_title_id text, p_reason text, p_performed_by text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'reason required'; end if;
  perform public.grant_title(p_user_id, p_title_id, 'admin');
  insert into public.cosmetic_admin_events (action, target_user_id, item_id, reason, performed_by)
    values ('grant_title', p_user_id, p_title_id, p_reason, p_performed_by);
end;
$$;

create or replace function public.admin_grant_background(p_user_id uuid, p_background_id text, p_reason text, p_performed_by text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'reason required'; end if;
  perform public.grant_background(p_user_id, p_background_id, 'admin');
  insert into public.cosmetic_admin_events (action, target_user_id, item_id, reason, performed_by)
    values ('grant_background', p_user_id, p_background_id, p_reason, p_performed_by);
end;
$$;

-- 회수: 보유 삭제 + 장착 중이었다면 해제(트리거가 막지 않도록 equipped_*도 함께 정리)
create or replace function public.admin_revoke_title(p_user_id uuid, p_title_id text, p_reason text, p_performed_by text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'reason required'; end if;
  delete from public.owned_titles where user_id = p_user_id and title_id = p_title_id;
  update public.prediction_stats set equipped_title = null
    where user_id = p_user_id and equipped_title = p_title_id;
  insert into public.cosmetic_admin_events (action, target_user_id, item_id, reason, performed_by)
    values ('revoke_title', p_user_id, p_title_id, p_reason, p_performed_by);
end;
$$;

create or replace function public.admin_revoke_background(p_user_id uuid, p_background_id text, p_reason text, p_performed_by text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'reason required'; end if;
  delete from public.owned_backgrounds where user_id = p_user_id and background_id = p_background_id;
  update public.prediction_stats set equipped_background = null
    where user_id = p_user_id and equipped_background = p_background_id;
  insert into public.cosmetic_admin_events (action, target_user_id, item_id, reason, performed_by)
    values ('revoke_background', p_user_id, p_background_id, p_reason, p_performed_by);
end;
$$;

revoke execute on function public.admin_grant_title(uuid,text,text,text) from public, anon, authenticated;
revoke execute on function public.admin_grant_background(uuid,text,text,text) from public, anon, authenticated;
revoke execute on function public.admin_revoke_title(uuid,text,text,text) from public, anon, authenticated;
revoke execute on function public.admin_revoke_background(uuid,text,text,text) from public, anon, authenticated;
```

**호출 방법(관리자 UI 없음):** Supabase 대시보드 SQL 에디터에서 `select admin_grant_title('<uuid>', 'title.xxx', '<사유>', '<내이름>');` 직접 실행. service_role 컨텍스트가 아니라 대시보드 SQL 에디터는 기본적으로 `postgres`(슈퍼유저) 세션으로 실행되므로 REVOKE 대상(anon/authenticated)에 안 걸림 — 정상 호출 가능.

### 4-3. 리더보드 RPC 변경 (닉네임 중복 허용의 파급 — §8-5 참고)

`get_monthly_leaderboard`/`get_monthly_hitrate_leaderboard`는 현재 `nickname`으로 그룹핑·표시하는데, **닉네임이 이제 유일하지 않으므로 반환 행에 `user_id`를 추가**해야 클라이언트가 "내 순위 행"을 정확히 식별할 수 있다(§8-5의 프라이버시 판단 참고).

---

## 5. 권한 모델 (RLS/GRANT)

| 테이블/RPC | select | insert/update/delete |
|---|---|---|
| `owned_titles` / `owned_backgrounds` | 자기 행만 | 전체 차단 — RPC만 |
| `backgrounds` | 전체 차단(클라 비노출) | 전체 차단 |
| `prediction_stats.equipped_title/equipped_background` | 자기 행만 | 컬럼 GRANT로 authenticated 직접 update |
| **`prediction_stats.nickname`** | 자기 행만 | **컬럼 GRANT 없음 — `set_nickname` RPC 전용**(★변경) |
| `award_history` | **전체 공개**(명예의 전당용, `user_id` 컬럼은 뷰/select 컬럼 제한으로 숨김) | 전체 차단 — 트리거·`grant_monthly_rewards`/`grant_season_rewards`만 |
| `cosmetic_admin_events` | 전체 차단(anon/authenticated 모두) | 전체 차단(admin RPC 내부에서만 insert) |
| `admin_grant_*`/`admin_revoke_*` | — | anon·authenticated 실행 불가. **대시보드 SQL 에디터(postgres 세션)로만 호출** |
| `set_nickname` | authenticated 실행 | anon 회수 |

---

## 6. UI 요구사항

### 6-1. 라커룸 배경 시각 적용 (확정)

- **LockerRoom 화면 전체 배경**을 `equipped_background`에 따라 교체(기본값은 현재의 `stadium-bg.webp` 유지).
- 유저 정보/메뉴 카드는 배경 위에 `Panel` 카드로 얹는다(기존 스타일 그대로).
- 가독성을 위해 dim 또는 cream 톤 오버레이(기존 `bgOverlay: rgba(243,233,206,0.35)` 패턴 재사용 가능, 배경별로 톤 조정 여지).
- **PredictionLeague/랭킹 화면엔 배경 미적용** — 리스트 위주 화면이라 가독성 우선.
- **공개 랭킹엔 닉네임 + 칭호만** 표시(장착 배경은 랭킹에 안 보임 — `prediction-league-design.md` §9의 "장착 배경/프레임 공개 가능" 문구를 이번 결정으로 **축소**함, 문서 상호 참조 업데이트 필요).

### 6-2. 화면별 요구사항 (변경 없음 + 신규 6-2b 추가)

| 화면 | 요구사항 |
|---|---|
| `PredictionLeague.tsx` | "내 기록"에 장착 칭호 표시 + 칭호 목록 진입점. 리더보드 각 행은 **닉네임 + 칭호만**(유저 식별은 내부적으로 user_id 사용, 화면엔 노출 안 함) |
| 신규: 칭호 목록 화면 | 보유 칭호 전체(고정 업적 + 월간/시즌 이력) + 장착/해제. 최신순 정렬 + 접기 |
| 신규: 라커룸 배경 구매/보유 화면 | 구매형 4종 + 명예 2종(보유 시만 노출) |
| `LockerRoom.tsx` | 배경 섹션 추가 + **화면 전체 배경 렌더링 로직**(§6-1) |

### 6-2b. 신규: 명예의 전당 화면 (⚠️ 스코프 확인 요청)

`award_history`가 존재하고 "탈퇴한 사용자로 표시"라는 요구사항이 있으려면, 이 기록을 **누군가 보는 화면**이 있어야 의미가 있다. 이번 Stage 6에 포함할지, 아니면 `award_history`는 지금은 데이터만 쌓아두고 화면은 후속(Phase 5 팬덤/시즌패스 확장)으로 미룰지 확인 필요. **비용 관점 추천: 이번엔 데이터만 쌓고, 화면은 과거 수상자가 몇 명 쌓인 뒤(예: 월간 정산 2~3회 후) 만들어도 늦지 않음.**

---

## 7. 운영 절차

### 7-1. 월간 정산 — 자동(변경 없음)

### 7-2. 시즌 정산 — 수동(변경 없음, 트리거 인지 방법은 여전히 미정 — 낮은 우선순위)

### 7-3. event/admin 지급 — 확정

- 관리자 UI는 만들지 않는다.
- Supabase 대시보드 SQL 에디터에서 `admin_grant_title`/`admin_grant_background`/`admin_revoke_title`/`admin_revoke_background` 직접 호출(§4-2b).
- 모든 호출은 `cosmetic_admin_events`에 사유 필수 기록.
- `event` 칭호가 트리거하는 구체 이벤트(예: "오픈 기념", "올스타 브레이크 이벤트")는 사전 카탈로그를 만들지 않는다 — 이벤트 자체가 비정형이라 발생 시 title_id를 그때 정해서 `admin_grant_title`로 지급(예: `title.event.allstar2026`).

### 7-4. 모니터링 — 변경 없음(후속 검토)

---

## 8. 정산 규칙 확정표

### 8-1. 업적 칭호 — 변경 없음(이전 리비전과 동일, §8-1 표 유지)

| title_id | 조건 | 지급 시점 |
|---|---|---|
| `title.rookie_watcher` | 닉네임 최초 설정 | `set_nickname` |
| `title.first_prediction` | 유효 참여 1회 도달 | 정산 |
| `title.first_hit` | 누적 적중 1회 도달 | 정산 |
| `title.streak3` / `title.streak5` | 연속 적중 3 / 5 도달 | 정산 |
| `title.honey_detective` | 누적 적중 10 도달 | 정산 |
| `title.veteran30` | 누적 유효 참여 30 도달 | 정산 |

### 8-2. 월간/시즌 포인트 랭킹 — 동점자 처리 확정

**타이브레이크 순서:** ① 포인트 합 desc → ② 적중 수 desc → ③ 적중률 desc → ④ 최고 연속(`best_streak`) desc → ⑤ 그래도 같으면 **공동 수상**.

**SQL 스케치(`grant_monthly_rewards` 내부, `RANK()` 윈도우 함수로 동점 자동 처리):**

```sql
with ranked as (
  select
    p.user_id,
    sum(p.ranking_points) as pts,
    count(*) filter (where p.status = 'hit') as hits,
    (count(*) filter (where p.status = 'hit'))::numeric
      / nullif(count(*) filter (where p.status <> 'void'), 0) as hit_rate,
    s.best_streak,
    rank() over (
      order by sum(p.ranking_points) desc,
               count(*) filter (where p.status = 'hit') desc,
               (count(*) filter (where p.status = 'hit'))::numeric
                 / nullif(count(*) filter (where p.status <> 'void'), 0) desc,
               s.best_streak desc
    ) as rnk
  from public.predictions p
  join public.prediction_stats s on s.user_id = p.user_id
  where to_char(p.date, 'YYYYMM') = month and s.nickname is not null
  group by p.user_id, s.best_streak
)
-- 챔피언(rnk=1) — 동점이면 전원 챔피언
select user_id, nickname_snapshot... from ranked where rnk = 1;
-- TOP10(rnk<=10) — RANK()라 경계 동점자는 자동으로 10명 초과 포함됨(결정사항 그대로)
select user_id from ranked where rnk <= 10;
```

`RANK()`(not `ROW_NUMBER()`)를 쓰면 동점자는 같은 순위를 받고, 그다음 순위가 동점자 수만큼 건너뛴다 — "TOP10 경계에서 타이브레이크까지 같으면 공동 수상" 요구사항을 정확히 만족한다(예: 9~11위가 완전 동점이면 셋 다 `rnk=9`가 되어 `rnk<=10` 조건에 다 포함됨).

**⚠️ 확인 필요 — 적중률 랭킹(감별왕)의 타이브레이크는 미지정.** 포인트 랭킹과 동일한 원칙을 적용한다면: ① 적중률 desc → ② 적중 수 desc(같은 비율이면 표본이 큰 쪽 우선) → ③ 최고 연속 desc → ④ 공동 수상. **이 순서로 확정해도 되는지 확인 요청** (별도 지시 없으면 이 순서로 진행).

**공동 수상 시 지급:** 동점자 전원에게 title_id·background 동일하게 지급(`perform grant_title(...) from (select user_id from ranked where rnk<=N) x` 패턴, 이미 predictions-sync 계열에서 쓰던 1-대-다 PERFORM 패턴 재사용).

### 8-3. 시즌 보상 — 동점자 규칙 동일 적용(§8-2 참고), 그 외 변경 없음

| 대상 | 조건 | 지급물 |
|---|---|---|
| 포인트 랭킹 1위(공동 가능) | 시즌 전체 포인트 최댓값, §8-2 타이브레이크 | `title.season_champion.<라벨>` + `title.season_legend.<라벨>` + `lockerbg.season_trophy` |
| 포인트 랭킹 TOP10(경계 동점 포함) | 참여자 50명↑ | `title.season_top10.<라벨>` |
| 적중률 랭킹 1위(공동 가능) | 최소 참여 30회, §8-2 타이브레이크 준용 | `title.season_detective.<라벨>` |

### 8-4. 닉네임 정책 확정표

| 규칙 | 값 |
|---|---|
| 최초 설정 | 자유(횟수 제한 없음) |
| 이후 변경 주기 | KST 기준 월 1회 |
| 변경 경로 | `set_nickname` RPC 전용, 클라 직접 update 불가 |
| 중복 | 허용 |
| 길이 | 2~10자 |
| 부적절 닉네임 | 운영자가 `admin` 경로로 직접 변경/숨김(전용 RPC 없음 — 대시보드에서 `update prediction_stats set nickname=... where user_id=...` 직접 실행으로 충분, 사유 로그는 남기지 않음. 필요시 후속으로 `cosmetic_admin_events`에 닉네임 변경도 포함할지 검토) |

### 8-5. 닉네임 중복 허용의 파급 효과 (신규 결정, 확인 요청)

닉네임이 유일하지 않으므로:
- 리더보드 RPC가 **user_id도 함께 반환**해야 클라가 "내 행" 하이라이트·React 리스트 key를 정확히 처리할 수 있다.
- `prediction-league-design.md` §9는 "공개 금지(절대): ... 내부 user_id"라고 명시했는데, 리더보드 응답에 user_id를 담는 건 이 원칙과 **표면적으로 충돌**한다.
- **해석/제안:** user_id를 리더보드 API 응답에는 포함하되, **클라이언트 UI에는 절대 표시하지 않고**(내 행 비교·key 용도로만 내부 사용) 오직 화면에 보이는 텍스트는 닉네임/칭호/기록뿐이도록 구현한다. RLS로 다른 유저의 `owned_titles`/`predictions` 등 실 데이터는 이미 차단돼 있어 user_id 자체가 노출돼도 추가로 악용할 경로가 없다(로그인 제공자·잔액·거래내역 등 진짜 민감정보는 여전히 비공개).
- **확인 요청:** 이 해석(=API 응답엔 포함, 화면엔 비표시)으로 진행해도 되는지, 아니면 user_id 대신 별도의 "표시용 참가자 번호"(예: 리더보드 계산 시점에 매기는 순번, 실제 UUID와 무관)를 만들어 더 엄격히 분리할지.

---

## 9. 엣지케이스 (업데이트)

| 케이스 | 확정 동작 |
|---|---|
| 월간/시즌 챔피언 동점 | §8-2 타이브레이크, 끝까지 같으면 공동 수상(전원 지급) |
| TOP10 경계 동점 | `RANK()`로 자동 포함(10명 초과 가능) |
| 시즌 중 탈퇴 | 개인 데이터(`owned_titles`/`owned_backgrounds`/`predictions`/`prediction_stats`) cascade 삭제. **`award_history`는 `BEFORE DELETE ON auth.users` 트리거가 `user_id=null, is_user_deleted=true`로 명시적 처리 후 보존** |
| 탈퇴 유저의 명예 기록 노출 | `is_user_deleted=true`면 화면에서 닉네임 대신 "탈퇴한 사용자" 표시(`nickname_snapshot`은 DB엔 남아있지만 화면 렌더링 시 무시) |
| event/admin 칭호 실수 지급 | `admin_revoke_title`/`admin_revoke_background`로 회수(장착 중이었다면 자동 해제) + 감사 로그 |
| 이번달 참여자 20명/50명 미만 | TOP10만 스킵, 챔피언·감별왕은 지급(변경 없음) |
| 닉네임 이번달 이미 변경함 | `set_nickname`이 `rate_limited` 반환, 클라는 "이번 달엔 닉네임을 이미 바꿨어요" 안내 |
| 닉네임 중복 | 허용 — 리더보드 정확한 식별은 §8-5 참고 |

---

## 10. 테스트 기준 (업데이트)

### 10-1. 이미 커버됨

- `monthly-rewards.test.mjs`: KST "1일 여부"·"지난달" 계산(연도 경계) — 5개 통과.

### 10-2. 신규 시나리오(수동, Supabase 적용 후)

- [ ] 포인트가 완전히 같은 두 유저로 월간 정산 → 둘 다 `title.monthly_champion.<월>` + `lockerbg.monthly_champion` 받는지
- [ ] TOP10 경계(10·11위 동점)에서 정산 → 11명 이상에게 top10 칭호가 가는지
- [ ] 닉네임 최초 설정 → 자유롭게 성공
- [ ] 같은 달에 닉네임 재변경 시도 → `rate_limited` 반환
- [ ] 다음 달 닉네임 재변경 시도 → 성공
- [ ] 닉네임 중복 설정(두 유저가 같은 닉네임) → 둘 다 성공(에러 없음)
- [ ] `admin_grant_title` 호출 → `owned_titles` 반영 + `cosmetic_admin_events`에 로그 남는지
- [ ] `admin_revoke_title`로 장착 중인 칭호 회수 → `equipped_title`도 함께 null 처리되는지
- [ ] 유저 탈퇴(auth.users delete) → 그 유저의 `award_history` 행이 `user_id=null, is_user_deleted=true`로 남는지(삭제되지 않고 보존되는지)
- [ ] `reason` 없이 admin RPC 호출 → 예외 발생 확인

---

## 11. 구현 체크리스트 (단계별)

1. **§8-2·§8-5 확인 요청 2건 회신 대기**(적중률 타이브레이크 순서, user_id 노출 해석) — 이것만 정해지면 SQL 착수 가능
2. **§6-2b 명예의 전당 화면 스코프 확인**(이번 Stage 6 포함 여부)
3. 신규 마이그레이션(`0008_prediction_cosmetics_v2.sql`): `award_history`, `cosmetic_admin_events` 테이블 + 트리거 + admin RPC 4종 + `set_nickname` 재작성 + `prediction_stats.nickname` unique 제거·길이 2~10·`nickname_changed_month` 추가 + 컬럼 GRANT에서 nickname 제외 + `grant_monthly_rewards`/`grant_season_rewards` RANK() 기반 재작성
4. 클라 정적 카탈로그: `lockerBackgroundConfig.ts`, `titleConfig.ts`
5. 화면 구현: 칭호 목록/장착, 배경 구매/장착, `LockerRoom` 배경 렌더링, `PredictionLeague` 장착 칭호 노출·리더보드 user_id 내부처리
6. (스코프 확정 시) 명예의 전당 화면
7. 실제 이미지 에셋 제작(6종)
8. §10-2 수동 테스트 시나리오 전부 실행

---

참고 문서: [prediction-league-design.md](prediction-league-design.md) · [phase3-account-design.md](phase3-account-design.md) · [roadmap.md](roadmap.md) · [adr.md](adr.md)
