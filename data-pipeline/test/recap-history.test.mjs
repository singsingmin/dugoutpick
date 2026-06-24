// recap-history.test.mjs — node:assert 전용, 의존성 0, build.mjs import 금지
import assert from 'node:assert/strict';
import {
  MIN_SAMPLE,
  WINDOW,
  resolveFrozen,
  toRecord,
  mergeHistory,
  aggregate,
} from '../recap.mjs';

let passed = 0;

function test(label, fn) {
  fn();
  console.log(`  ✓ ${label}`);
  passed++;
}

// ── A. resolveFrozen — 정직성 게이트 4케이스 ──────────────────────────────────

console.log('\n[A] resolveFrozen');

test('케이스1: SCHEDULED→LIVE 전이 → true (정상 freeze 발화)', () => {
  // prevStatus=SCHEDULED이면 경기 전 → 경기중 전이로 freeze 정당
  const result = resolveFrozen({ status: 'LIVE', prevHonjam: { score: 70 }, prevStatus: 'SCHEDULED' });
  assert.equal(result, true);
});

test('케이스2: SCHEDULED→FINAL 직행 → true (LIVE 누락이어도 prevStatus=SCHEDULED라 정당)', () => {
  // SCHEDULED→FINAL 직행이어도 경기 전 freeze는 정당
  const result = resolveFrozen({ status: 'FINAL', prevHonjam: { score: 70 }, prevStatus: 'SCHEDULED' });
  assert.equal(result, true);
});

test('케이스3: 첫 sighting이 FINAL(prevStatus=FINAL, frozen 없음) → false (post-hoc 영구 배제)', () => {
  // prevStatus=FINAL이고 prevHonjam.frozen이 false → 경기 전 freeze 없음 → 영구 배제
  const result = resolveFrozen({ status: 'FINAL', prevHonjam: { score: 70, frozen: false }, prevStatus: 'FINAL' });
  assert.equal(result, false);
});

test('케이스4: 한 번 freeze된(frozen:true) 경기가 CANCELED 거쳐 재개 → true (frozen 보존)', () => {
  // prevHonjam.frozen===true이면 prevStatus 무관하게 보존
  const result = resolveFrozen({ status: 'LIVE', prevHonjam: { score: 70, frozen: true }, prevStatus: 'CANCELED' });
  assert.equal(result, true);
});

test('추가: prevHonjam=null → false (첫 sighting이 없으면 무조건 배제)', () => {
  // prevHonjam==null: 이전 기록 없음 → post-hoc 경기로 간주 → false
  const result = resolveFrozen({ status: 'FINAL', prevHonjam: null, prevStatus: 'SCHEDULED' });
  assert.equal(result, false);
});

// ── B. toRecord — 적격성 가드 ─────────────────────────────────────────────────

console.log('\n[B] toRecord');

const baseGame = {
  gameId: 'G001',
  status: 'FINAL',
  honjam: { score: 78, frozen: true },
  recap: { actual: 84, verdict: '기대 이상' },
};

test('정상 레코드: frozen=true & FINAL & recap 있음 & verdict 비-null → 레코드 반환', () => {
  const result = toRecord(baseGame, '20260623');
  assert.deepEqual(result, {
    date: '20260623',
    gameId: 'G001',
    pred: 78,
    actual: 84,
    verdict: '기대 이상',
  });
});

test('verdict=null 배제: frozen=true, FINAL이어도 recap.verdict===null → null (분모 오염 방지)', () => {
  // verdict가 null이면 집계에 포함하면 안 됨 → toRecord가 null 반환해야 함
  const game = { ...baseGame, recap: { actual: 84, verdict: null } };
  assert.equal(toRecord(game, '20260623'), null);
});

test('frozen이 아닌 경우(frozen:false) → null', () => {
  const game = { ...baseGame, honjam: { score: 78, frozen: false } };
  assert.equal(toRecord(game, '20260623'), null);
});

test('frozen 필드 미설정 → null', () => {
  const game = { ...baseGame, honjam: { score: 78 } };
  assert.equal(toRecord(game, '20260623'), null);
});

test('status가 FINAL이 아님(LIVE) → null', () => {
  const game = { ...baseGame, status: 'LIVE' };
  assert.equal(toRecord(game, '20260623'), null);
});

test('status가 SCHEDULED → null', () => {
  const game = { ...baseGame, status: 'SCHEDULED' };
  assert.equal(toRecord(game, '20260623'), null);
});

test('recap이 null → null', () => {
  const game = { ...baseGame, recap: null };
  assert.equal(toRecord(game, '20260623'), null);
});

// ── C. mergeHistory — append-only 멱등 + 재기록 시 첫값 고수 ─────────────────

console.log('\n[C] mergeHistory');

test('새 gameId만 append되고 기존 순서 보존', () => {
  const existing = [
    { gameId: 'G1', actual: 80, pred: 70, verdict: '기대 이상', date: '20260601' },
    { gameId: 'G2', actual: 60, pred: 65, verdict: '예측 적중', date: '20260602' },
  ];
  const incoming = [
    { gameId: 'G3', actual: 90, pred: 85, verdict: '기대 이상', date: '20260603' },
  ];
  const result = mergeHistory(existing, incoming);
  assert.equal(result.length, 3);
  assert.equal(result[0].gameId, 'G1');
  assert.equal(result[1].gameId, 'G2');
  assert.equal(result[2].gameId, 'G3');
});

test('멱등: 같은 incoming으로 두 번 merge → 결과 동일(길이·내용)', () => {
  // 5분 주기 재실행에도 중복 append 없음을 검증
  const existing = [{ gameId: 'G1', actual: 80, pred: 70, verdict: '기대 이상', date: '20260601' }];
  const incoming = [{ gameId: 'G2', actual: 60, pred: 65, verdict: '예측 적중', date: '20260602' }];
  const first = mergeHistory(existing, incoming);
  const second = mergeHistory(first, incoming);
  assert.equal(second.length, first.length);
  assert.deepEqual(second, first);
});

test('재기록 시 첫값 고수: incoming의 같은 gameId는 existing 값을 덮어쓰지 않음', () => {
  // append-only 원칙: 이미 있는 gameId는 무시 → actual:80 유지, actual:99로 안 바뀜
  const existing = [{ gameId: 'G1', actual: 80, pred: 70, verdict: '기대 이상', date: '20260601' }];
  const incoming = [{ gameId: 'G1', actual: 99, pred: 70, verdict: '기대 이상', date: '20260601' }];
  const result = mergeHistory(existing, incoming);
  assert.equal(result.length, 1);
  assert.equal(result[0].actual, 80); // 첫값 고수
});

test('existing=undefined → 빈 배열처럼 동작', () => {
  const incoming = [{ gameId: 'G1', actual: 80, pred: 70, verdict: '예측 적중', date: '20260601' }];
  const result = mergeHistory(undefined, incoming);
  assert.equal(result.length, 1);
  assert.equal(result[0].gameId, 'G1');
});

test('existing=null → 빈 배열처럼 동작', () => {
  const incoming = [{ gameId: 'G1', actual: 80, pred: 70, verdict: '예측 적중', date: '20260601' }];
  const result = mergeHistory(null, incoming);
  assert.equal(result.length, 1);
  assert.equal(result[0].gameId, 'G1');
});

test('incoming 내 중복 gameId: 첫 번째만 추가됨', () => {
  const existing = [];
  const incoming = [
    { gameId: 'G1', actual: 80, pred: 70, verdict: '기대 이상', date: '20260601' },
    { gameId: 'G1', actual: 99, pred: 70, verdict: '기대 이상', date: '20260601' },
  ];
  const result = mergeHistory(existing, incoming);
  assert.equal(result.length, 1);
  assert.equal(result[0].actual, 80);
});

// ── D. aggregate — 윈도우/게이트/분리 ────────────────────────────────────────

console.log('\n[D] aggregate');

test('윈도우 절단은 append 순서 끝에서 N개: WINDOW+5개 → sampleSize===WINDOW', () => {
  // 정렬이 아니라 slice(-window) 임을 검증
  const records = Array.from({ length: WINDOW + 5 }, (_, i) => ({
    gameId: `G${i}`, verdict: '예측 적중', date: '20260601', pred: 70, actual: 75,
  }));
  const result = aggregate(records);
  assert.equal(result.sampleSize, WINDOW);
});

test('hitRate: "예측 적중"만 분자, Math.round(100*적중/표본)과 일치', () => {
  // 10개 중 7개 적중 → hitRate = 70
  const records = [
    ...Array.from({ length: 7 }, (_, i) => ({ gameId: `H${i}`, verdict: '예측 적중', date: '20260601', pred: 70, actual: 75 })),
    ...Array.from({ length: 3 }, (_, i) => ({ gameId: `L${i}`, verdict: '기대 이하', date: '20260601', pred: 70, actual: 60 })),
  ];
  const result = aggregate(records);
  assert.equal(result.hitRate, 70);
  assert.equal(result.sampleSize, 10);
});

test('bonusRate 분리: "기대 이상"은 hitRate에 합산되지 않고 별도 bonusRate', () => {
  // 10개: 적중 4, 이상 3, 이하 3
  // hitRate = 40, bonusRate = 30 (합산 아님)
  const records = [
    ...Array.from({ length: 4 }, (_, i) => ({ gameId: `H${i}`, verdict: '예측 적중', date: '20260601', pred: 70, actual: 75 })),
    ...Array.from({ length: 3 }, (_, i) => ({ gameId: `B${i}`, verdict: '기대 이상', date: '20260601', pred: 70, actual: 90 })),
    ...Array.from({ length: 3 }, (_, i) => ({ gameId: `L${i}`, verdict: '기대 이하', date: '20260601', pred: 70, actual: 50 })),
  ];
  const result = aggregate(records);
  assert.equal(result.hitRate, 40);    // 적중만
  assert.equal(result.bonusRate, 30);  // 이상만, hitRate와 별개
});

test('ready 게이트: sampleSize < MIN_SAMPLE → ready:false', () => {
  const records = Array.from({ length: MIN_SAMPLE - 1 }, (_, i) => ({
    gameId: `G${i}`, verdict: '예측 적중', date: '20260601', pred: 70, actual: 75,
  }));
  const result = aggregate(records);
  assert.equal(result.ready, false);
  assert.equal(result.sampleSize, MIN_SAMPLE - 1);
});

test('ready 게이트: sampleSize >= MIN_SAMPLE → ready:true', () => {
  const records = Array.from({ length: MIN_SAMPLE }, (_, i) => ({
    gameId: `G${i}`, verdict: '예측 적중', date: '20260601', pred: 70, actual: 75,
  }));
  const result = aggregate(records);
  assert.equal(result.ready, true);
  assert.equal(result.sampleSize, MIN_SAMPLE);
});

test('빈 배열 → { sampleSize:0, hitRate:0, bonusRate:0, ready:false }', () => {
  const result = aggregate([]);
  assert.equal(result.sampleSize, 0);
  assert.equal(result.hitRate, 0);
  assert.equal(result.bonusRate, 0);
  assert.equal(result.ready, false);
});

test('윈도우 슬라이스: 앞 5개는 집계에서 제외되고 끝 WINDOW개만 반영됨', () => {
  // 앞 5개는 '기대 이하', 뒤 WINDOW개는 '예측 적중' → hitRate=100이면 앞 5개 배제 확인
  const old5 = Array.from({ length: 5 }, (_, i) => ({
    gameId: `OLD${i}`, verdict: '기대 이하', date: '20260601', pred: 70, actual: 50,
  }));
  const recent = Array.from({ length: WINDOW }, (_, i) => ({
    gameId: `NEW${i}`, verdict: '예측 적중', date: '20260602', pred: 70, actual: 75,
  }));
  const result = aggregate([...old5, ...recent]);
  assert.equal(result.sampleSize, WINDOW);
  assert.equal(result.hitRate, 100); // 앞 5개 '기대 이하'가 잘려서 100%
});

// ── 완료 ─────────────────────────────────────────────────────────────────────

console.log(`\n✅ 전체 ${passed}개 테스트 통과\n`);
