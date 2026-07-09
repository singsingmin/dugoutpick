-- ============================================================================
-- 0020 · 라커룸 배경 한정 판매 윈도우 (P4-운영 인프라)
-- 목적: 시즌/이벤트 구매형 배경을 "기간 한정"으로 열고 닫는 걸 코드 배포 없이 데이터로 제어.
--   - backgrounds.available_from / available_until (둘 다 null이면 상시 판매).
--   - purchase_background가 기간 밖이면 'not_available'로 거절.
-- 완전 additive(컬럼 추가 + 동일 시그니처 함수 교체) — 배포 순서 무관.
-- 순서: 0006 → … → 0019 → 0020.
-- ============================================================================

alter table public.backgrounds add column available_from  timestamptz;   -- null=제한 없음
alter table public.backgrounds add column available_until timestamptz;    -- null=제한 없음

-- purchase_background 재작성(0014 기준) — 한정 판매 윈도우 게이트만 추가.
create or replace function public.purchase_background(p_background_id text)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); bg_price int; bg_unlock text; bal int; owned_id bigint;
  avail_from timestamptz; avail_until timestamptz;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select price, unlock_type, available_from, available_until
    into bg_price, bg_unlock, avail_from, avail_until
    from public.backgrounds where id = p_background_id;
  if not found then return json_build_object('success', false, 'reason', 'unknown_background'); end if;
  select balance into bal from public.profiles where id = uid for update;
  if not found then raise exception 'profile not found'; end if;
  select id into owned_id from public.owned_backgrounds
    where user_id = uid and background_id = p_background_id and period_type is null limit 1;
  if owned_id is not null then
    return json_build_object('success', true, 'reason', 'already', 'balance', bal, 'ownedBackgroundId', owned_id);
  end if;
  if bg_unlock <> 'currency' then
    return json_build_object('success', false, 'reason', 'not_purchasable', 'balance', bal);
  end if;
  -- 한정 판매 윈도우(둘 다 null이면 상시). 기간 밖이면 구매 불가.
  if (avail_from is not null and now() < avail_from) or (avail_until is not null and now() >= avail_until) then
    return json_build_object('success', false, 'reason', 'not_available', 'balance', bal);
  end if;
  if bal < bg_price then
    return json_build_object('success', false, 'reason', 'insufficient', 'balance', bal);
  end if;
  update public.profiles set balance = balance - bg_price, updated_at = now() where id = uid;
  insert into public.owned_backgrounds (user_id, background_id, acquired_via)
    values (uid, p_background_id, 'purchase') returning id into owned_id;
  insert into public.baseball_ledger (user_id, type, amount, reason, label, related_background_id)
  values (uid, 'spend', bg_price, 'background_purchase', p_background_id || ' 구매', p_background_id);
  return json_build_object('success', true, 'balance', bal - bg_price, 'ownedBackgroundId', owned_id);
end;
$$;
revoke execute on function public.purchase_background(text) from anon;

-- 운영 메모: 한정 배경 오픈 예시(코드 배포 없이 SQL로)
--   update public.backgrounds set available_from = '2026-07-15 00:00+09', available_until = '2026-08-15 00:00+09'
--     where id = 'lockerbg.allstar_2026';
