-- ============================================================================
-- 0021 · 스킨 한정 판매 윈도우 + 판매 제어 필드 (A-1 하이브리드)
-- 설계: docs/limited-cosmetics-plan.md, 대화 2026-07-09 확정.
--   - 배경(0020)과 동일한 판매 윈도우 구조를 skins에 적용.
--   - A-1: 서버는 검증·판매제어 필드만(price·is_purchasable·release_type·available_from/until·is_active).
--          이름/설명/이미지/rarity/sort_order는 클라 config(scoreSkinConfig)가 SoT — 여기서 관리 안 함.
--   - 기존 unlock_type은 validate_applied_skin(무료 스킨 장착 검증) 등이 의존 → 제거하지 않음.
-- 순서: 0006 → … → 0020 → 0021.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. skins 판매 제어 필드 추가 (기존 unlock_type 유지)
-- ─────────────────────────────────────────────────────────────
alter table public.skins add column is_purchasable boolean     not null default false;  -- 야구공 교환 가능 여부
alter table public.skins add column is_active      boolean     not null default true;   -- 판매 활성(비활성이면 노출·교환 불가)
alter table public.skins add column release_type   text        not null default 'permanent';  -- permanent|monthly|event|honor|admin
alter table public.skins add column available_from  timestamptz;   -- null=제한 없음
alter table public.skins add column available_until timestamptz;   -- null=제한 없음

-- 기존 unlock_type에서 제어 필드 시드
--   currency → 교환 가능·상시 / free → 비교환(무료 장착) / event·premium → 이벤트(현재는 비교환, 윈도우 열면 교환)
update public.skins set
  is_purchasable = (unlock_type = 'currency'),
  release_type = case unlock_type
    when 'event'   then 'event'
    when 'premium' then 'event'
    else 'permanent'
  end;

-- ─────────────────────────────────────────────────────────────
-- 2. purchase_skin 재작성 — 새 판매 제어 필드 기준 서버 검증(0005 대체)
--    검증: 존재 → 중복보유 → 활성 → 교환가능 → honor/admin 차단 → 판매기간 → 잔액 → 지급/원장.
--    클라가 보낸 가격은 신뢰하지 않음(서버 skins.price 사용).
-- ─────────────────────────────────────────────────────────────
create or replace function public.purchase_skin(p_skin_id text)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  sk_price int; sk_purchasable boolean; sk_active boolean; sk_release text;
  sk_from timestamptz; sk_until timestamptz; bal int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select price, is_purchasable, is_active, release_type, available_from, available_until
    into sk_price, sk_purchasable, sk_active, sk_release, sk_from, sk_until
    from public.skins where id = p_skin_id;
  if not found then return json_build_object('success', false, 'reason', 'unknown_skin'); end if;
  select balance into bal from public.profiles where id = uid for update;
  if not found then raise exception 'profile not found'; end if;
  -- 이미 보유 → 중복 차단(멱등 성공)
  if exists (select 1 from public.owned_skins where user_id = uid and skin_id = p_skin_id) then
    return json_build_object('success', true, 'reason', 'already', 'balance', bal);
  end if;
  -- 비활성 / 비교환 / honor·admin → 교환 불가
  if not sk_active or not sk_purchasable or sk_release in ('honor','admin') then
    return json_build_object('success', false, 'reason', 'not_purchasable', 'balance', bal);
  end if;
  -- 판매 윈도우(둘 다 null이면 상시). 기간 밖이면 교환 불가
  if (sk_from is not null and now() < sk_from) or (sk_until is not null and now() >= sk_until) then
    return json_build_object('success', false, 'reason', 'not_available', 'balance', bal);
  end if;
  if bal < sk_price then
    return json_build_object('success', false, 'reason', 'insufficient', 'balance', bal);
  end if;
  update public.profiles set balance = balance - sk_price, updated_at = now() where id = uid;
  insert into public.owned_skins (user_id, skin_id, acquired_via) values (uid, p_skin_id, 'purchase');
  insert into public.baseball_ledger (user_id, type, amount, reason, label, related_skin_id)
  values (uid, 'spend', sk_price, 'skin_purchase', p_skin_id || ' 교환', p_skin_id);
  return json_build_object('success', true, 'balance', bal - sk_price);
end;
$$;
revoke execute on function public.purchase_skin(text) from anon;

-- 운영 메모: 한정 스킨 오픈 예시(코드 배포 없이 SQL로)
--   update public.skins set is_purchasable = true, release_type = 'event',
--     available_from = '2026-11-16 00:00+09', available_until = '2026-12-20 23:59+09'
--     where id = 'skin.stove_winter_2026';
