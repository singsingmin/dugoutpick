-- 0009_locker_backgrounds_pack2.sql — 구매형 라커룸 배경 6종 추가
-- 클라 카탈로그: app/utils/lockerBackgroundConfig.ts (수동 동기화)
insert into public.backgrounds (id, price, unlock_type) values
  ('lockerbg.rainy_dugout',         45, 'currency'),
  ('lockerbg.sunset_bullpen',       50, 'currency'),
  ('lockerbg.retro_scoreboard',     55, 'currency'),
  ('lockerbg.baseball_cafe',        45, 'currency'),
  ('lockerbg.training_room',        50, 'currency'),
  ('lockerbg.stove_league_office',  60, 'currency')
on conflict (id) do update set price = excluded.price, unlock_type = excluded.unlock_type;
