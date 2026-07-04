-- 0004_push_notifications.sql — 서버 푸시(경기 전 알림) 토큰·발송로그
-- 흐름: 앱이 Expo 푸시 토큰 등록(upsert_push_token) → GitHub Actions 발송기가 경기 시작 전
--       enabled 토큰 조회(favorite_team 매칭)해 Expo Push 발송, push_log로 중복 방지.
-- 발송기는 service_role로 접근(RLS 우회). 클라는 RPC로만.

-- 1) 푸시 토큰 (기기당 1행)
create table if not exists public.push_tokens (
  token       text primary key,                          -- Expo push token(기기 고유)
  user_id     uuid not null references auth.users(id) on delete cascade,
  platform    text,                                      -- ios | android
  enabled     boolean not null default true,
  updated_at  timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens(user_id);
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;   -- 정책 없음 = RPC/service_role만

-- 2) 발송 로그 (game_id+날짜당 1행 = 중복 발송 방지). service_role만 접근.
create table if not exists public.push_log (
  game_id   text not null,
  send_date date not null,
  sent_at   timestamptz not null default now(),
  primary key (game_id, send_date)
);
alter table public.push_log enable row level security;
revoke all on public.push_log from anon, authenticated;

-- 3) 토큰 등록/갱신 (클라, definer)
create or replace function public.upsert_push_token(p_token text, p_platform text, p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_token is null or length(p_token) < 10 then raise exception 'bad token'; end if;
  insert into public.push_tokens (token, user_id, platform, enabled, updated_at)
  values (p_token, uid, p_platform, coalesce(p_enabled, true), now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform,
        enabled = excluded.enabled, updated_at = now();
end; $$;

-- 4) 유저 알림 on/off (모든 기기 토큰 일괄, 토큰 없이 호출 가능)
create or replace function public.set_push_enabled(p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  update public.push_tokens set enabled = coalesce(p_enabled, false), updated_at = now()
    where user_id = uid;
end; $$;

grant execute on function public.upsert_push_token(text, text, boolean) to authenticated;
grant execute on function public.set_push_enabled(boolean)              to authenticated;
