// 예측 리그 월간 정산 게이팅 로직 골든 테스트.
// 실행: node data-pipeline/test/monthly-rewards.test.mjs
import assert from 'node:assert';
import { isFirstOfMonthKst, lastMonthYYYYMM } from '../monthly-rewards.mjs';

let pass = 0;
function check(name, actual, expected) {
  assert.deepStrictEqual(actual, expected, `${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  pass++;
}

// 2026-08-01 00:30 KST = 2026-07-31 15:30 UTC
const AUG1_KST_EARLY = Date.UTC(2026, 6, 31, 15, 30);
check('isFirstOfMonthKst: 8/1 00:30 KST → true', isFirstOfMonthKst(AUG1_KST_EARLY), true);
check('lastMonthYYYYMM: 8/1 KST → 202607', lastMonthYYYYMM(AUG1_KST_EARLY), '202607');

// 2026-07-15 12:00 KST = 2026-07-15 03:00 UTC
const JUL15_KST = Date.UTC(2026, 6, 15, 3, 0);
check('isFirstOfMonthKst: 7/15 KST → false', isFirstOfMonthKst(JUL15_KST), false);

// 연도 경계: 2027-01-01 00:10 KST = 2026-12-31 15:10 UTC
const JAN1_KST = Date.UTC(2026, 11, 31, 15, 10);
check('isFirstOfMonthKst: 1/1 KST → true', isFirstOfMonthKst(JAN1_KST), true);
check('lastMonthYYYYMM: 1/1 KST → 202612(연도 경계)', lastMonthYYYYMM(JAN1_KST), '202612');

console.log(`\n✓ monthly-rewards 테스트 ${pass}개 통과`);
