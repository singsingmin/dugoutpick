-- ============================================================================
-- Phase 4 · Stage 1: 꿀잼 예측 리그 스키마
-- 설계: docs/prediction-league-design.md · 선행: Phase 3-Pre 판정 파이프라인(dailyHoney) 완료.
-- 원칙: 판정(hit/miss/void)·보상 지급은 service_role(파이프라인)만 쓸 수 있는 settle_prediction()
--       단일 트랜잭션으로 처리 — 클라는 submit_prediction()으로 제출만, 결과는 못 바꿈.
-- 월간/적중률 랭킹은 캐시 카운터를 따로 두지 않고 predictions 테이블을 매번 집계한다
--   (월 롤오버 리셋 버그 클래스를 원천 차단 — 이 규모에서 라이브 집계 비용은 무시할 만함).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. 테이블 5종
-- ─────────────────────────────────────────────────────────────

-- prediction_windows — 그날 예측 마감 시각(=그날 첫 경기 시작). 파이프라인이 매 빌드 upsert.
-- 서버 진실 원천: 클라가 마감 시각을 주장할 수 없게 하기 위함(games.json은 DB 밖 데이터라 대조 불가).
create table public.prediction_windows (
  date       date primary key,          -- KST
  lock_at    timestamptz not null,      -- 그날 첫 경기 시작 시각
  updated_at timestamptz not null default now()
);
alter table public.prediction_windows enable row level security;
revoke all on public.prediction_windows from anon, authenticated;  -- 정책 없음 = service_role만

-- predictions — 유저 1일 1행(PK가 "하루 1회" 강제). 제출은 RPC, 정산은 service_role RPC만.
create table public.predictions (
  user_id           uuid not null references auth.users(id) on delete cascade,
  date              date not null,                                    -- KST
  selected_game_id  text not null,
  selected_at       timestamptz not null default now(),
  status            text not null default 'pending'
                      check (status in ('pending','hit','miss','void')),
  reward_baseballs  int  not null default 0,
  ranking_points    int  not null default 0,
  settled_at        timestamptz,
  primary key (user_id, date)
);
create index predictions_date_idx on public.predictions (date);
alter table public.predictions enable row level security;
revoke insert, update, delete on public.predictions from anon, authenticated;  -- 쓰기=RPC만
create policy "predictions_select_own" on public.predictions
  for select to authenticated using (user_id = auth.uid());

-- prediction_stats — 유저당 1행. 랭킹 집계용이 아니라 "내 기록"(연속·통산·닉네임·장착) 캐시.
create table public.prediction_stats (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  nickname            text unique,
  total_predictions   int  not null default 0,
  total_hits          int  not null default 0,
  current_streak      int  not null default 0,
  best_streak         int  not null default 0,
  equipped_title      text,
  equipped_background text,
  updated_at          timestamptz not null default now()
);
alter table public.prediction_stats add constraint prediction_stats_nickname_len
  check (nickname is null or (length(nickname) between 2 and 16));
alter table public.prediction_stats enable row level security;
revoke insert, delete on public.prediction_stats from anon, authenticated;
create policy "prediction_stats_select_own" on public.prediction_stats
  for select to authenticated using (user_id = auth.uid());
create policy "prediction_stats_update_own" on public.prediction_stats
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- 클라 직접 write는 닉네임·장착 칭호/배경만 (통산·연속 등은 settle_prediction만 갱신)
revoke update on public.prediction_stats from anon, authenticated;
grant update (nickname, equipped_title, equipped_background) on public.prediction_stats to authenticated;

-- owned_titles / owned_backgrounds — 조인 테이블(획득 경로·시점 보존). owned_skins과 동일 패턴.
-- 야구공으로 구매 불가(시즌 보상=프레스티지) → acquired_via는 'season_reward' 등 부여 사유만 기록.
create table public.owned_titles (
  user_id      uuid not null references auth.users(id) on delete cascade,
  title_id     text not null,
  acquired_via text not null,
  acquired_at  timestamptz not null default now(),
  primary key (user_id, title_id)
);
alter table public.owned_titles enable row level security;
revoke insert, update, delete on public.owned_titles from anon, authenticated;
create policy "owned_titles_select_own" on public.owned_titles
  for select to authenticated using (user_id = auth.uid());

create table public.owned_backgrounds (
  user_id      uuid not null references auth.users(id) on delete cascade,
  background_id text not null,
  acquired_via  text not null,
  acquired_at   timestamptz not null default now(),
  primary key (user_id, background_id)
);
alter table public.owned_backgrounds enable row level security;
revoke insert, update, delete on public.owned_backgrounds from anon, authenticated;
create policy "owned_backgrounds_select_own" on public.owned_backgrounds
  for select to authenticated using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 2. 트리거 — equipped_title/equipped_background는 보유(또는 null)만 허용
-- ─────────────────────────────────────────────────────────────
create or replace function public.validate_equipped_cosmetics()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.equipped_title is not null and new.equipped_title is distinct from old.equipped_title then
    if not exists (select 1 from public.owned_titles where user_id = new.user_id and title_id = new.equipped_title) then
      raise exception 'equipped_title "%" is not owned', new.equipped_title;
    end if;
  end if;
  if new.equipped_background is not null and new.equipped_background is distinct from old.equipped_background then
    if not exists (select 1 from public.owned_backgrounds where user_id = new.user_id and background_id = new.equipped_background) then
      raise exception 'equipped_background "%" is not owned', new.equipped_background;
    end if;
  end if;
  return new;
end;
$$;
create trigger validate_equipped_cosmetics_trigger
  before update on public.prediction_stats for each row execute function public.validate_equipped_cosmetics();

-- ─────────────────────────────────────────────────────────────
-- 3. RPC — 클라 제출용
-- ─────────────────────────────────────────────────────────────

-- 오늘 경기 중 하나를 예측. 마감(prediction_windows.lock_at) 전까지 재선택 허용(upsert).
-- 마감 전 재선택을 허용하는 이유: "하루 1회 참여"는 그날의 최종 선택이 1개라는 뜻이지
-- 잘못 고른 걸 못 고치게 막는 게 목적이 아님(설계 §1 "마감 전까지" 문구 근거).
create or replace function public.submit_prediction(p_game_id text)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Asia/Seoul')::date;
  lock_at timestamptz;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_game_id is null or length(p_game_id) = 0 or length(p_game_id) > 20 then
    raise exception 'bad game id';
  end if;

  select w.lock_at into lock_at from public.prediction_windows w where w.date = today;
  if not found then
    return json_build_object('success', false, 'reason', 'window_not_ready');
  end if;
  if now() >= lock_at then
    return json_build_object('success', false, 'reason', 'locked');
  end if;

  insert into public.prediction_stats (user_id) values (uid) on conflict (user_id) do nothing;

  insert into public.predictions (user_id, date, selected_game_id, selected_at)
  values (uid, today, p_game_id, now())
  on conflict (user_id, date) do update
    set selected_game_id = excluded.selected_game_id, selected_at = now()
    where public.predictions.status = 'pending';  -- 이미 정산됐으면(레이스) 변경 안 됨

  return json_build_object('success', true, 'gameId', p_game_id);
end;
$$;
revoke execute on function public.submit_prediction(text) from anon;

-- 닉네임 설정(리그 첫 참여 시). 유니크 위반은 클라에서 잡아 재입력 유도.
create or replace function public.set_nickname(p_nickname text)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_nickname is null or length(p_nickname) < 2 or length(p_nickname) > 16 then
    return json_build_object('success', false, 'reason', 'bad_length');
  end if;
  insert into public.prediction_stats (user_id) values (uid) on conflict (user_id) do nothing;
  update public.prediction_stats set nickname = p_nickname, updated_at = now() where user_id = uid;
  return json_build_object('success', true, 'nickname', p_nickname);
exception
  when unique_violation then
    return json_build_object('success', false, 'reason', 'taken');
end;
$$;
revoke execute on function public.set_nickname(text) from anon;

-- ─────────────────────────────────────────────────────────────
-- 4. RPC — 정산 (service_role 전용, 파이프라인이 호출)
-- ─────────────────────────────────────────────────────────────

-- 하루치 한 유저 예측을 확정(hit/miss/void) + 보상 지급까지 단일 트랜잭션.
-- 멱등: status='pending'인 행만 갱신 → 같은 정산을 두 번 호출해도 두 번째는 no-op.
create or replace function public.settle_prediction(
  p_user_id uuid, p_date date, p_status text, p_reward int, p_points int
) returns void language plpgsql security definer set search_path = public as $$
declare cur_streak int; best int; new_streak int;
begin
  if p_status not in ('hit','miss','void') then raise exception 'bad status %', p_status; end if;

  update public.predictions
    set status = p_status, reward_baseballs = coalesce(p_reward,0), ranking_points = coalesce(p_points,0), settled_at = now()
    where user_id = p_user_id and date = p_date and status = 'pending';
  if not found then return; end if;  -- 이미 정산됐거나 예측 자체가 없음(멱등)

  insert into public.prediction_stats (user_id) values (p_user_id) on conflict (user_id) do nothing;
  select current_streak, best_streak into cur_streak, best
    from public.prediction_stats where user_id = p_user_id for update;

  if p_status = 'hit' then new_streak := coalesce(cur_streak,0) + 1;
  elsif p_status = 'miss' then new_streak := 0;
  else new_streak := coalesce(cur_streak,0); end if;  -- void: 연속 유지(설계 §8)

  update public.prediction_stats set
    total_predictions = total_predictions + (case when p_status = 'void' then 0 else 1 end),
    total_hits        = total_hits + (case when p_status = 'hit' then 1 else 0 end),
    current_streak     = new_streak,
    best_streak        = greatest(coalesce(best,0), new_streak),
    updated_at          = now()
  where user_id = p_user_id;

  if coalesce(p_reward,0) > 0 then
    insert into public.baseball_ledger (user_id, type, amount, reason, label)
    values (p_user_id, 'earn', p_reward, 'prediction_reward', '예측 적중 보상');
    update public.profiles set balance = balance + p_reward, updated_at = now() where id = p_user_id;
  end if;
end;
$$;
revoke execute on function public.settle_prediction(uuid,date,text,int,int) from public, anon, authenticated;

-- 예측 창(마감 시각) upsert — service_role 전용, 파이프라인이 매 빌드 오늘자 갱신.
create or replace function public.upsert_prediction_window(p_date date, p_lock_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.prediction_windows (date, lock_at, updated_at)
  values (p_date, p_lock_at, now())
  on conflict (date) do update set lock_at = excluded.lock_at, updated_at = now();
end;
$$;
revoke execute on function public.upsert_prediction_window(date,timestamptz) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5. RPC — 랭킹 조회 (읽기 전용, 라이브 집계라 캐시 리셋 버그 없음)
-- ─────────────────────────────────────────────────────────────

-- 월간 포인트 랭킹(메인). p_month 없으면 이번 달(KST). 상위 N.
create or replace function public.get_monthly_leaderboard(p_month text default null, p_limit int default 50)
returns table(nickname text, monthly_points int, hits int, participations int)
language sql security definer set search_path = public as $$
  select s.nickname,
         sum(p.ranking_points)::int as monthly_points,
         count(*) filter (where p.status = 'hit')::int as hits,
         count(*) filter (where p.status <> 'void')::int as participations
  from public.predictions p
  join public.prediction_stats s on s.user_id = p.user_id
  where to_char(p.date, 'YYYYMM') = coalesce(p_month, to_char((now() at time zone 'Asia/Seoul')::date, 'YYYYMM'))
    and s.nickname is not null
  group by s.nickname
  order by monthly_points desc
  limit greatest(1, least(p_limit, 200));
$$;
revoke execute on function public.get_monthly_leaderboard(text,int) from anon;

-- 월간 적중률 랭킹(보조). 최소 참여(p_min_participation, 기본 5회) 미달 유저는 제외(설계 §7).
create or replace function public.get_monthly_hitrate_leaderboard(p_month text default null, p_min_participation int default 5, p_limit int default 50)
returns table(nickname text, hit_rate numeric, hits int, participations int)
language sql security definer set search_path = public as $$
  select s.nickname,
         round(100.0 * count(*) filter (where p.status = 'hit') / nullif(count(*) filter (where p.status <> 'void'), 0), 1) as hit_rate,
         count(*) filter (where p.status = 'hit')::int as hits,
         count(*) filter (where p.status <> 'void')::int as participations
  from public.predictions p
  join public.prediction_stats s on s.user_id = p.user_id
  where to_char(p.date, 'YYYYMM') = coalesce(p_month, to_char((now() at time zone 'Asia/Seoul')::date, 'YYYYMM'))
    and s.nickname is not null
  group by s.nickname
  having count(*) filter (where p.status <> 'void') >= greatest(1, p_min_participation)
  order by hit_rate desc
  limit greatest(1, least(p_limit, 200));
$$;
revoke execute on function public.get_monthly_hitrate_leaderboard(text,int,int) from anon;
