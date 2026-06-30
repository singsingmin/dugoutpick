// liveHeat v1.1 raw core 골든 테이블 테스트.
// 실행: node data-pipeline/test/liveheat.test.mjs
//
// 목적: rawLiveHeat / liveLabel 의 기대 출력을 고정해, 이 모듈을 import 하는 build.mjs 와
//       동일 로직을 복제한 cf-worker/src/index.ts 의 결과가 서로 어긋나지 않도록 가드한다.
//       Worker 카피를 수정하면 이 테이블도 함께 갱신해야 한다(ADR-021).
import assert from 'node:assert';
import { rawLiveHeat, liveLabel, getCloseFactor } from '../liveHeatCore.mjs';

let pass = 0;
function check(name, actual, expected) {
  assert.strictEqual(actual, expected, `${name}: expected ${expected}, got ${actual}`);
  pass++;
}

// ── getCloseFactor lookup
check('closeF d0', getCloseFactor(0), 1.0);
check('closeF d1', getCloseFactor(1), 0.94);
check('closeF d2', getCloseFactor(2), 0.78);
check('closeF d3', getCloseFactor(3), 0.58);
check('closeF d4', getCloseFactor(4), 0.38);
check('closeF d5', getCloseFactor(5), 0.20);
check('closeF d6', getCloseFactor(6), 0.06);
check('closeF d9', getCloseFactor(9), 0.06);

// ── rawLiveHeat 골든 [inning, half, diff, total] → heat
const HEAT = [
  ['9회말 동점',      9,  'B', 0, 4,  90],
  ['9회초 동점',      9,  'T', 0, 6,  80],
  ['1회초 동점',      1,  'T', 0, 0,  31],
  ['5회말 3점차+난타',5,  'B', 3, 8,  33],
  ['10회말 1점차',    10, 'B', 1, 10, 96],
  ['7회초 5점차',     7,  'T', 5, 11, 12],
  ['3회말 7점차',     3,  'B', 7, 9,  3],
  ['8회말 2점차 난타',8,  'B', 2, 14, 64],
  ['7회초 3점차 난타',7,  'T', 3, 12, 44],
  ['11회초 2점차',    11, 'T', 2, 8,  71],
];
for (const [name, inn, half, diff, total, exp] of HEAT) {
  check(`heat ${name}`, rawLiveHeat(inn, half, diff, total), exp);
}

// 절대 점수차: 지고 있든 이기든 동일(음수 diff 방어)
check('heat 음수 diff = 절대값', rawLiveHeat(9, 'B', -1, 4), rawLiveHeat(9, 'B', 1, 4));
// clamp 0~100
check('heat clamp 상한', rawLiveHeat(9, 'B', 0, 100) <= 100, true);
check('heat clamp 하한', rawLiveHeat(1, 'T', 20, 0) >= 0, true);

// ── liveLabel 골든 (momentum 라벨 제외 — 앱 전용)
const LABEL = [
  ['9회말 1점차',  9,  'B', 1, 4,  '끝내기 한 방 찬스'],
  ['연장말 동점',  10, 'B', 0, 6,  '끝내기 한 방 찬스'],
  ['11회초 2점차', 11, 'T', 2, 8,  '연장 혈투 진행 중'],
  ['9회초 1점차',  9,  'T', 1, 5,  '9회 1점 승부'],
  ['8회말 2점차',  8,  'B', 2, 6,  '후반 박빙 승부'],
  ['7회초 3점차 난타', 7, 'T', 3, 12, '점수 나는 난타전'],
  ['2회말 1점차',  2,  'B', 1, 3,  '초반 팽팽한 흐름'],
  ['4회초 6점차',  4,  'T', 6, 8,  '점수차가 벌어진 경기'],
  ['6회초 4점차',  6,  'T', 4, 7,  '경기 흐름 체크 중'],
];
for (const [name, inn, half, diff, total, exp] of LABEL) {
  check(`label ${name}`, liveLabel(inn, half, diff, total), exp);
}

console.log(`✓ liveHeat raw core: ${pass} assertions passed`);
