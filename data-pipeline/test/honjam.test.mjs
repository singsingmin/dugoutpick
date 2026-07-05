// computeHonjam(꿀잼지수 본체) 골든 회귀 테스트.
// 실행: node data-pipeline/test/honjam.test.mjs
//
// 목적: build.mjs 의 핵심 알고리즘 computeHonjam 의 출력(score·factors)을 "지금 이 값"으로
//       고정한다. 아래 골든값이 '정답'이라는 뜻이 아니라 — 현재 공식이 내는 값을 스냅샷으로
//       박제해, 앞으로 가중치/팩터 로직을 실수로 건드리면 여기서 diff 로 잡히게 하는 회귀 안전망이다.
//       공식을 의도적으로 바꿀 때는 이 골든값을 함께 갱신할 것(변경이 눈에 보이는 게 핵심).
//
// 스타일은 recap-history/liveheat/dailyhoney 테스트와 동일(node:assert + check 헬퍼).
import assert from 'node:assert';
import { computeHonjam } from '../build.mjs';

let pass = 0;
function check(name, actual, expected) {
  assert.strictEqual(actual, expected, `${name}: expected ${expected}, got ${actual}`);
  pass++;
}
function checkDeep(name, actual, expected) {
  assert.deepStrictEqual(actual, expected, `${name}: mismatch\n  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(actual)}`);
  pass++;
}

// standings 픽스처 빌더 — build.mjs fetchStandings 가 만드는 객체 shape 와 동일 필드.
// (rank, winRate, gamesBehind, last10 '5승5패', streak '3승'/'2패', rs 득점, games 경기수)
const st = (o = {}) => ({ rank: 5, winRate: 0.500, gamesBehind: 3.0, last10: '5승5패', streak: '1승', rs: 500, games: 100, ...o });
// 인자 순서: (aw, hm, sa, sh, aPit, hPit, aERA, hERA, h2hRec, stadium, phase)
const hj = (...args) => computeHonjam(...args);

// ── 1. close 팩터: 접전(승률차 거의 0) vs 승률 격차 큰 경기
const closeTight = hj('LG', 'KT', st({ rank: 3, winRate: 0.552, gamesBehind: 1.0 }), st({ rank: 4, winRate: 0.548, gamesBehind: 1.5 }), 'A', 'B', 4.2, 4.2, null, '인천', 0);
const closeWide  = hj('LG', 'KT', st({ rank: 1, winRate: 0.640, gamesBehind: 0 }),   st({ rank: 9, winRate: 0.400, gamesBehind: 18 }), 'A', 'B', 4.2, 4.2, null, '인천', 0);
check('close 접전 factor', closeTight.factors.close, 0.97);
check('close 격차 factor', closeWide.factors.close, 0);
check('close 접전 > 격차 (score)', closeTight.score > closeWide.score, true);

// ── 2. quality 팩터: 리그 상위권(1·2위) vs 하위권(9·10위)
const qTop = hj('LG', 'KT', st({ rank: 1 }), st({ rank: 2 }), 'A', 'B', 4.2, 4.2, null, '인천', 0);
const qBot = hj('LG', 'KT', st({ rank: 9 }), st({ rank: 10 }), 'A', 'B', 4.2, 4.2, null, '인천', 0);
check('quality 상위권 factor', qTop.factors.quality, 0.94);
check('quality 하위권 factor', qBot.factors.quality, 0.06);
check('quality 상위 > 하위', qTop.factors.quality > qBot.factors.quality, true);

// ── 3. rivalry 팩터: 라이벌전(LG-두산) vs 비라이벌전(LG-KT)
const rivYes = hj('LG', '두산', st({ rank: 3 }), st({ rank: 4 }), 'A', 'B', 4.2, 4.2, null, '잠실', 0);
const rivNo  = hj('LG', 'KT',  st({ rank: 3 }), st({ rank: 4 }), 'A', 'B', 4.2, 4.2, null, '수원', 0);
check('rivalry 라이벌 factor', rivYes.factors.rivalry, 1);
check('rivalry 비라이벌 factor', rivNo.factors.rivalry, 0);

// ── 4. pitcher 팩터: 에이스 매치업(ERA 낮음) vs 평범한 매치업
const pAce   = hj('LG', 'KT', st(), st(), '류현진', '안우진', 1.50, 1.80, null, '인천', 0);
const pPlain = hj('LG', 'KT', st(), st(), 'A', 'B', 4.20, 4.30, null, '인천', 0);
check('pitcher 에이스 factor', pAce.factors.pitcher, 1);
check('pitcher 평범 factor', pPlain.factors.pitcher, 0.25);
check('pitcher 에이스 > 평범', pAce.factors.pitcher > pPlain.factors.pitcher, true);

// ── 5. doom(멸망전) 팩터: 양팀 5연패+ vs 평시 — doom 이 0인지 아닌지
const doomYes = hj('LG', 'KT', st({ streak: '6패' }), st({ streak: '5패' }), 'A', 'B', 4.2, 4.2, null, '인천', 0);
const doomNo  = hj('LG', 'KT', st({ streak: '2승' }), st({ streak: '1패' }), 'A', 'B', 4.2, 4.2, null, '인천', 0);
check('doom 양팀연패 factor', doomYes.factors.doom, 0.44);
check('doom 평시 factor = 0', doomNo.factors.doom, 0);

// ── 6. park 팩터: 라팍(대구, 타자친화) vs 잠실(투수친화)
const parkHit = hj('SS', 'HT', st(), st(), 'A', 'B', 4.2, 4.2, null, '대구', 0);
const parkPit = hj('LG', 'OB', st(), st(), 'A', 'B', 4.2, 4.2, null, '잠실', 0);
check('park 대구(타자) factor', parkHit.factors.park, 1);
check('park 잠실(투수) factor', parkPit.factors.park, 0.09);
check('park 대구 > 잠실', parkHit.factors.park > parkPit.factors.park, true);

// ── 7. score 는 극단 입력에도 항상 0~100
const extremeHi = hj('LG', '두산', st({ rank: 1, winRate: 0.700, streak: '9승', rs: 900 }), st({ rank: 2, winRate: 0.699, streak: '8승', rs: 880 }), '류현진', '안우진', 1.0, 1.1, '8-4-1', '대구', 1);
const extremeLo = hj('LG', 'KT', st({ rank: 10, winRate: 0.200, gamesBehind: 30, streak: '12패', rs: 200 }), st({ rank: 1, winRate: 0.700, gamesBehind: 0, streak: '10승', rs: 900 }), 'A', 'B', 6.5, 6.5, null, '고척', 0);
check('score 상한 <= 100', extremeHi.score <= 100, true);
check('score 하한 >= 0', extremeLo.score >= 0, true);
check('score 정수', Number.isInteger(extremeHi.score) && Number.isInteger(extremeLo.score), true);

// ── 8. 모든 factor 값은 항상 0~1 로 정규화
for (const [label, res] of [['extremeHi', extremeHi], ['extremeLo', extremeLo], ['closeTight', closeTight], ['doomYes', doomYes]]) {
  for (const [k, v] of Object.entries(res.factors)) {
    check(`factor 정규화 ${label}.${k} in [0,1]`, v >= 0 && v <= 1, true);
  }
}

// ── 9. 골든 스냅샷: score + factors 전체를 박제(공식 회귀 감지의 핵심).
//     이 블록이 깨지면 = computeHonjam 출력이 바뀐 것. 의도한 변경이면 아래 값을 갱신할 것.
const GOLDEN = {
  closeTight: { score: 83, factors: { close: 0.97, quality: 0.72, form: 0.06, rivalry: 0, playoff: 1, pitcher: 0.27, doom: 0, park: 0.55, offense: 0.5 } },
  closeWide:  { score: 5,  factors: { close: 0, quality: 0.56, form: 0.06, rivalry: 0, playoff: 0, pitcher: 0.27, doom: 0, park: 0.55, offense: 0.5 } },
  qTop:       { score: 82, factors: { close: 1, quality: 0.94, form: 0.06, rivalry: 0, playoff: 0, pitcher: 0.27, doom: 0, park: 0.55, offense: 0.5 } },
  qBot:       { score: 43, factors: { close: 1, quality: 0.06, form: 0.06, rivalry: 0, playoff: 0, pitcher: 0.27, doom: 0, park: 0.55, offense: 0.5 } },
  rivYes:     { score: 88, factors: { close: 1, quality: 0.72, form: 0.06, rivalry: 1, playoff: 1, pitcher: 0.27, doom: 0, park: 0.09, offense: 0.5 } },
  pAce:       { score: 93, factors: { close: 1, quality: 0.56, form: 0.06, rivalry: 0, playoff: 1, pitcher: 1, doom: 0, park: 0.55, offense: 0.5 } },
  doomYes:    { score: 93, factors: { close: 1, quality: 0.56, form: 0.34, rivalry: 0, playoff: 1, pitcher: 0.27, doom: 0.44, park: 0.55, offense: 0.5 } },
  parkHit:    { score: 82, factors: { close: 1, quality: 0.56, form: 0.06, rivalry: 0, playoff: 1, pitcher: 0.27, doom: 0, park: 1, offense: 0.5 } },
  extremeHi:  { score: 99, factors: { close: 0.99, quality: 0.94, form: 0.4, rivalry: 1, playoff: 0, pitcher: 1, doom: 0, park: 1, offense: 1 } },
  extremeLo:  { score: 4,  factors: { close: 0, quality: 0.5, form: 0.4, rivalry: 0, playoff: 0, pitcher: 0, doom: 0, park: 0, offense: 0.67 } },
};
const snap = (r) => ({ score: r.score, factors: r.factors });
checkDeep('golden closeTight', snap(closeTight), GOLDEN.closeTight);
checkDeep('golden closeWide',  snap(closeWide),  GOLDEN.closeWide);
checkDeep('golden qTop',       snap(qTop),       GOLDEN.qTop);
checkDeep('golden qBot',       snap(qBot),       GOLDEN.qBot);
checkDeep('golden rivYes',     snap(rivYes),     GOLDEN.rivYes);
checkDeep('golden pAce',       snap(pAce),       GOLDEN.pAce);
checkDeep('golden doomYes',    snap(doomYes),    GOLDEN.doomYes);
checkDeep('golden parkHit',    snap(parkHit),    GOLDEN.parkHit);
checkDeep('golden extremeHi',  snap(extremeHi),  GOLDEN.extremeHi);
checkDeep('golden extremeLo',  snap(extremeLo),  GOLDEN.extremeLo);

console.log(`✓ computeHonjam golden: ${pass} assertions passed`);
