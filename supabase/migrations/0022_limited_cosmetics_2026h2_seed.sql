-- ============================================================================
-- 0022 · 2026 하반기 한정 꾸미기 상품 시드 (배경 6 + 스킨 2)
-- 인프라: 0020(배경 판매 윈도우) · 0021(스킨 판매 윈도우). 여기선 상품 행만 시드.
--   - 클라 카탈로그(이름/이미지/rarity): app/utils/lockerBackgroundConfig.ts · scoreSkinConfig.ts (수동 동기화).
--   - 서버는 판매 제어만: price·unlock_type·available_from/until(배경) + is_purchasable·is_active·release_type(스킨).
--   - available_until = 마지막 판매일 다음날 00:00(+09) 경계값(exclusive). 기간 밖이면 purchase_*가 not_available.
-- 날짜는 잠정(특히 한가위=추석 9/25 전후) — 조정은 SQL UPDATE만으로(코드 배포 불필요).
-- 순서: … → 0020 → 0021 → 0022.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. 한정 배경 6종 (unlock_type='currency' + 판매 윈도우)
-- ─────────────────────────────────────────────────────────────
insert into public.backgrounds (id, price, unlock_type, available_from, available_until) values
  ('lockerbg.stars_night_2026',      120, 'currency', '2026-07-15 00:00+09', '2026-08-03 00:00+09'),
  ('lockerbg.midsummer_night_2026',  120, 'currency', '2026-08-01 00:00+09', '2026-09-01 00:00+09'),
  ('lockerbg.chuseok_2026',          120, 'currency', '2026-09-18 00:00+09', '2026-10-05 00:00+09'),
  ('lockerbg.autumn_baseball_2026',  150, 'currency', '2026-10-01 00:00+09', '2026-11-11 00:00+09'),
  ('lockerbg.championship_2026',     200, 'currency', '2026-10-25 00:00+09', '2026-11-16 00:00+09'),
  ('lockerbg.holiday_2026',          150, 'currency', '2026-12-01 00:00+09', '2027-01-01 00:00+09')
on conflict (id) do update set
  price = excluded.price, unlock_type = excluded.unlock_type,
  available_from = excluded.available_from, available_until = excluded.available_until;

-- ─────────────────────────────────────────────────────────────
-- 2. 한정 스킨 2종 (is_purchasable + release_type='event' + 판매 윈도우)
--    unlock_type='currency'는 validate_applied_skin(보유 시 장착 허용) 호환용.
--    구매 게이트(purchase_skin, 0021)는 is_purchasable·is_active·release_type·윈도우로 판정.
-- ─────────────────────────────────────────────────────────────
insert into public.skins (id, price, unlock_type, is_purchasable, is_active, release_type, available_from, available_until) values
  ('skin.stove_winter_2026', 120, 'currency', true, true, 'event', '2026-11-16 00:00+09', '2026-12-21 00:00+09'),
  ('skin.gold_glove_2026',   240, 'currency', true, true, 'event', '2026-12-10 00:00+09', '2027-01-01 00:00+09')
on conflict (id) do update set
  price = excluded.price, unlock_type = excluded.unlock_type,
  is_purchasable = excluded.is_purchasable, is_active = excluded.is_active, release_type = excluded.release_type,
  available_from = excluded.available_from, available_until = excluded.available_until;
