import assert from 'node:assert';

// feedback.ts의 TAGS_* 와 동일한 값 — 변경 시 함께 업데이트
const TAGS_DOWN = [
  { slug: 'score_gap' },
  { slug: 'starter_change' },
  { slug: 'low_tension' },
  { slug: 'other_down' },
];
const TAGS_UP = [
  { slug: 'dramatic_end' },
  { slug: 'ace_dominant' },
  { slug: 'close_game' },
  { slug: 'other_up' },
];

// 유니크성 검증
const downSlugs = TAGS_DOWN.map(t => t.slug);
assert.equal(new Set(downSlugs).size, downSlugs.length, 'TAGS_DOWN slug 중복');

const upSlugs = TAGS_UP.map(t => t.slug);
assert.equal(new Set(upSlugs).size, upSlugs.length, 'TAGS_UP slug 중복');

// 교집합 없음
const intersection = upSlugs.filter(s => downSlugs.includes(s));
assert.equal(intersection.length, 0, `TAGS_UP/DOWN slug 교집합 존재: ${intersection}`);

console.log('✓ 태그 slug 유니크성 검증 통과');
