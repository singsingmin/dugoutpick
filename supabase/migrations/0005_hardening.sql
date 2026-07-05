-- 0005_hardening.sql — 보안 리뷰 하드닝(fable, 2026-07-05)
-- M1: purchase_skin이 unlock_type 미검증(미래 event/premium/시즌한정 스킨이 야구공으로 구매되는 구멍)
-- M3: 무제한 삽입 스팸(feedback/favorite_team 길이, push_tokens 유저당 개수)
-- L2: claim_attendance·purchase_skin·push RPC의 anon 실행권 명시 회수(위생 — uid null 체크가 이미 막지만 명시적으로)

-- ─────────────────────────────────────────────────────────────
-- M1) purchase_skin: unlock_type='currency'만 야구공 구매 허용.
--     (event/premium을 나중에 추가해도 이 RPC로는 못 삼 — 예측 리그 시즌 한정 스킨 전제)
-- ─────────────────────────────────────────────────────────────
create or replace function public.purchase_skin(p_skin_id text)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); sk_price int; sk_unlock text; bal int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select price, unlock_type into sk_price, sk_unlock from public.skins where id = p_skin_id;
  if not found then return json_build_object('success', false, 'reason', 'unknown_skin'); end if;
  select balance into bal from public.profiles where id = uid for update;
  if not found then raise exception 'profile not found'; end if;
  if sk_unlock = 'free'
     or exists (select 1 from public.owned_skins where user_id = uid and skin_id = p_skin_id) then
    return json_build_object('success', true, 'reason', 'already', 'balance', bal);
  end if;
  if sk_unlock <> 'currency' then
    return json_build_object('success', false, 'reason', 'not_purchasable', 'balance', bal);
  end if;
  if bal < sk_price then
    return json_build_object('success', false, 'reason', 'insufficient', 'balance', bal);
  end if;
  update public.profiles set balance = balance - sk_price, updated_at = now() where id = uid;
  insert into public.owned_skins (user_id, skin_id, acquired_via) values (uid, p_skin_id, 'purchase');
  insert into public.baseball_ledger (user_id, type, amount, reason, label, related_skin_id)
  values (uid, 'spend', sk_price, 'skin_purchase', p_skin_id || ' 구매', p_skin_id);
  return json_build_object('success', true, 'balance', bal - sk_price);
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- M3) 스팸/비대화 방지 — 길이 제약(팀코드·게임ID는 짧아 기존 데이터 위반 없음)
-- ─────────────────────────────────────────────────────────────
alter table public.profiles
  add constraint profiles_favorite_team_len check (favorite_team is null or length(favorite_team) <= 10);

alter table public.feedback
  add constraint feedback_game_id_len   check (length(game_id) <= 20),
  add constraint feedback_factors_size  check (factors is null or length(factors::text) <= 2000);

-- push_tokens: 유저당 최대 5개. 신규 등록으로 초과하면 그 유저의 가장 오래된 토큰부터 정리.
create or replace function public.upsert_push_token(p_token text, p_platform text, p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cnt int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_token is null or length(p_token) < 10 then raise exception 'bad token'; end if;
  select count(*) into cnt from public.push_tokens where user_id = uid and token <> p_token;
  if cnt >= 5 then
    delete from public.push_tokens where token in (
      select token from public.push_tokens
      where user_id = uid and token <> p_token
      order by updated_at asc limit (cnt - 4)
    );
  end if;
  insert into public.push_tokens (token, user_id, platform, enabled, updated_at)
  values (p_token, uid, p_platform, coalesce(p_enabled, true), now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform,
        enabled = excluded.enabled, updated_at = now();
end; $$;

-- ─────────────────────────────────────────────────────────────
-- L2) RPC anon 실행권 명시 회수(위생) — uid null 체크가 이미 차단하지만 방어 계층 추가.
-- ─────────────────────────────────────────────────────────────
revoke execute on function public.claim_attendance()                    from anon;
revoke execute on function public.purchase_skin(text)                   from anon;
revoke execute on function public.upsert_push_token(text, text, boolean) from anon;
revoke execute on function public.set_push_enabled(boolean)             from anon;
