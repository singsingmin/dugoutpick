// 예측 리그 정산 순수 로직 골든 테스트.
// 실행: node data-pipeline/test/predictions-sync.test.mjs
import assert from 'node:assert';
import { kstStart, earliestLockAt, judgeSelection, rewardFor } from '../predictions-sync.mjs';

let pass = 0;
function check(name, actual, expected) {
  assert.deepStrictEqual(actual, expected, `${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  pass++;
}

// kstStart
check('kstStart 14:00 KST → 05:00 UTC', kstStart('20260705', '14:00').toISOString(), '2026-07-05T05:00:00.000Z');
check('kstStart 잘못된 형식 → null', kstStart('20260705', ''), null);
check('kstStart 잘못된 날짜 → null', kstStart('2026075', '14:00'), null);

// earliestLockAt
check('earliestLockAt 여러 경기 중 최소 시각',
  earliestLockAt('20260705', [{ time: '18:00' }, { time: '14:00' }, { time: '18:30' }]).toISOString(),
  '2026-07-05T05:00:00.000Z');
check('earliestLockAt 빈 배열 → null', earliestLockAt('20260705', []), null);
check('earliestLockAt 시간 파싱 불가 항목만 → null', earliestLockAt('20260705', [{ time: '' }]), null);

// judgeSelection
const dh = { actualTopGameId: 'B', tiedGameIds: undefined };
check('judgeSelection 단독 1위 적중', judgeSelection('B', dh, {}), 'hit');
check('judgeSelection 미적중', judgeSelection('A', dh, {}), 'miss');
check('judgeSelection 취소된 경기 선택 → void(적중 여부 무관)',
  judgeSelection('B', dh, { B: 'CANCELED' }), 'void');

const dhTied = { actualTopGameId: null, tiedGameIds: ['A', 'B'] };
check('judgeSelection 공동1위 중 하나 선택 → hit', judgeSelection('A', dhTied, {}), 'hit');
check('judgeSelection 공동1위 아닌 선택 → miss', judgeSelection('C', dhTied, {}), 'miss');

// rewardFor
check('rewardFor hit', rewardFor('hit'), { reward: 10, points: 11 });
check('rewardFor miss', rewardFor('miss'), { reward: 0, points: 1 });
check('rewardFor void', rewardFor('void'), { reward: 0, points: 0 });

console.log(`\n✓ predictions-sync 테스트 ${pass}개 통과`);
