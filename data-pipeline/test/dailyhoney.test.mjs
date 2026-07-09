// Phase 3-Pre 판정(dailyHoney) 골든 테스트.
// 실행: node data-pipeline/test/dailyhoney.test.mjs
import assert from 'node:assert';
import { judgeDailyHoney, mergeDailyHoney, reasonTags } from '../dailyHoney.mjs';

let pass = 0;
function check(name, actual, expected) {
  assert.deepStrictEqual(actual, expected, `${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  pass++;
}

// 게임 헬퍼. FINAL이면 recap 드라마 지표 포함. away/home은 스냅샷 필드 검증용 고정값.
const AWAY = { code: 'LT', name: '롯데', score: 3 };
const HOME = { code: 'KT', name: 'KT', score: 5 };
function g(gameId, status, recap) {
  return { gameId, status, recap: recap ? { verdict: '예측 적중', ...recap } : null, away: AWAY, home: HOME };
}
const DATE = '20260705';
const AT = '2026-07-05T13:00:00Z';

// 1) 단독 1위 = recapScore 최고
check('단독 1위',
  judgeDailyHoney([
    g('A', 'FINAL', { actual: 70, diff: 3, total: 8, extra: 0, walkoff: 0 }),
    g('B', 'FINAL', { actual: 88, diff: 1, total: 9, extra: 0, walkoff: 1 }),
    g('C', 'FINAL', { actual: 55, diff: 5, total: 10, extra: 0, walkoff: 0 }),
  ], DATE, AT),
  { date: DATE, actualTopGameId: 'B', recapScore: 88, decidingReasonTags: ['끝내기', '1점차 접전'], displayMode: 'highlight', displayTitle: '어제의 명경기', away: AWAY, home: HOME, calculatedAt: AT });

// 2) 미확정(LIVE 경기 있음) → null
check('미확정 null',
  judgeDailyHoney([
    g('A', 'FINAL', { actual: 70, diff: 3, total: 8, extra: 0, walkoff: 0 }),
    g('B', 'LIVE', null),
  ], DATE, AT),
  null);

// 3) 전 경기 취소/노게임 → null
check('노게임 null',
  judgeDailyHoney([g('A', 'CANCELED', null), g('B', 'CANCELED', null)], DATE, AT),
  null);

// 4) 취소 경기는 후보·확정 판단에서 제외(나머지 FINAL이면 확정)
check('취소 제외 확정',
  judgeDailyHoney([
    g('A', 'FINAL', { actual: 60, diff: 2, total: 7, extra: 0, walkoff: 0 }),
    g('B', 'CANCELED', null),
  ], DATE, AT),
  { date: DATE, actualTopGameId: 'A', recapScore: 60, decidingReasonTags: ['2점차 접전'], displayMode: 'highlight', displayTitle: '어제의 명경기', away: AWAY, home: HOME, calculatedAt: AT });

// 5) recapScore 동률 → 미세 tiebreak(끝내기 우선)
check('동률 tiebreak 끝내기',
  judgeDailyHoney([
    g('A', 'FINAL', { actual: 80, diff: 2, total: 8, extra: 0, walkoff: 0 }),
    g('B', 'FINAL', { actual: 80, diff: 2, total: 8, extra: 0, walkoff: 1 }),
  ], DATE, AT).actualTopGameId,
  'B');

// 6) 완전 동일 → 공동 1위(tiedGameIds)
check('완전 동률 공동1위',
  judgeDailyHoney([
    g('A', 'FINAL', { actual: 75, diff: 3, total: 9, extra: 0, walkoff: 0 }),
    g('B', 'FINAL', { actual: 75, diff: 3, total: 9, extra: 0, walkoff: 0 }),
  ], DATE, AT),
  { date: DATE, actualTopGameId: null, tiedGameIds: ['A', 'B'], recapScore: 75, decidingReasonTags: ['실제 꿀잼 75'], displayMode: 'highlight', displayTitle: '어제의 명경기', away: AWAY, home: HOME, calculatedAt: AT });

// 6b) 특별 태그 없고 recapScore < 60 → 표시 요약 모드로 톤다운
check('요약 모드(잔잔한 날)',
  judgeDailyHoney([
    g('A', 'FINAL', { actual: 50, diff: 3, total: 8, extra: 0, walkoff: 0 }),
  ], DATE, AT),
  { date: DATE, actualTopGameId: 'A', recapScore: 50, decidingReasonTags: ['실제 꿀잼 50'], displayMode: 'summary', displayTitle: '어제 경기 요약', away: AWAY, home: HOME, calculatedAt: AT });

// 7) mergeDailyHoney: append + freeze + null no-op
const base = [{ date: '20260704', actualTopGameId: 'X', recapScore: 90 }];
const r = { date: DATE, actualTopGameId: 'A', recapScore: 60 };
check('merge append', mergeDailyHoney(base, r).length, 2);
check('merge freeze(중복 date 안 덮음)', mergeDailyHoney([r], { date: DATE, actualTopGameId: 'ZZZ', recapScore: 1 }), [r]);
check('merge null no-op', mergeDailyHoney(base, null), base);

// 8) reasonTags
check('reasonTags 연장+난타', reasonTags(g('A', 'FINAL', { actual: 90, diff: 3, total: 16, extra: 1, walkoff: 0 })), ['연장 접전', '난타전']);

console.log(`\n✓ dailyHoney 테스트 ${pass}개 통과`);
