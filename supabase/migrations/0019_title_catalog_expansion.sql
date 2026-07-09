-- ============================================================================
-- 0019 · 보상 시스템 P4 — 업적 칭호 카탈로그 확장(~20종)
-- 설계: docs/roadmap.md §G-P4.
--   - title_achievement_rules에 참여형/적중형/연속형/경기성향형 룰을 추가(순수 데이터).
--   - settle_prediction 엔진은 이미 condition_type을 일반 평가하므로 함수 변경 불필요(완전 additive).
--   - 표시명·등급은 titleConfig(SoT)에서 관리.
-- 순서: 0006 → … → 0018 → 0019.
-- ============================================================================

insert into public.title_achievement_rules (title_id, condition_type, threshold, tag) values
  -- 참여형(누적 유효 예측)
  ('title.regular10',          'valid_predictions_count', 10,  null),
  ('title.veteran50',          'valid_predictions_count', 50,  null),
  ('title.predict100',         'valid_predictions_count', 100, null),
  -- 적중형(누적 적중)
  ('title.hits25',             'hits_count',              25,  null),
  ('title.hits50',             'hits_count',              50,  null),
  ('title.hits100',            'hits_count',              100, null),
  -- 연속형(현재 연속 적중)
  ('title.streak7',            'current_streak',          7,   null),
  ('title.streak10',           'current_streak',          10,  null),
  -- 경기성향형(picked 경기 result_tags 기반)
  ('title.extra_lover',        'special_tag_hit_count',   3,   'extra'),
  ('title.classic_collector',  'special_tag_hit_count',   5,   'classic_game')
on conflict (title_id) do update
  set condition_type = excluded.condition_type, threshold = excluded.threshold, tag = excluded.tag, active = true;
