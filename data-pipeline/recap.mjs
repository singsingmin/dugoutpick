// 순수 로직 모듈 — top-level 부작용(네트워크/파일IO) 없음. build.mjs와 테스트가 import.
export const MIN_SAMPLE = 10;
export const WINDOW = 50;

// freeze branch에서 honjam에 찍을 frozen 값 계산.
// (a) 이미 frozen이었거나 (b) 직전 상태가 SCHEDULED → 경기전→경기중/후 전이 → true.
// prevHonjam 없으면 false(첫 sighting이 FINAL인 post-hoc 경기 → 영구 배제).
export function resolveFrozen({ prevHonjam, prevStatus }) {
  if (prevHonjam == null) return false;
  return prevHonjam.frozen === true || prevStatus === 'SCHEDULED';
}

// FINAL 게임 → 누적 레코드. 정직성 게이트 조건 미충족이면 null.
export function toRecord(game, date) {
  if (
    game.status !== 'FINAL' ||
    game.recap == null ||
    game.honjam == null ||
    game.honjam.frozen !== true ||
    game.recap.verdict == null ||
    typeof game.honjam.score !== 'number'
  ) return null;

  return {
    date,
    gameId: game.gameId,
    pred: game.honjam.score,
    actual: game.recap.actual,
    verdict: game.recap.verdict,
  };
}

// append-only 멱등 병합. 기존 gameId는 절대 덮어쓰지 않음(첫 기록 고수).
export function mergeHistory(existing, incoming) {
  const base = Array.isArray(existing) ? existing : [];
  const seen = new Set(base.map(r => r.gameId));
  const seenNew = new Set();
  const toAdd = [];
  for (const r of incoming) {
    if (!seen.has(r.gameId) && !seenNew.has(r.gameId)) {
      toAdd.push(r);
      seenNew.add(r.gameId);
    }
  }
  return [...base, ...toAdd];
}

// 롤링 집계. records 끝 window개 슬라이스, 정렬 금지.
export function aggregate(records, { window = WINDOW, minSample = MIN_SAMPLE } = {}) {
  const slice = records.slice(-window);
  const sampleSize = slice.length;
  const hitCount = slice.filter(r => r.verdict === '예측 적중').length;
  const bonusCount = slice.filter(r => r.verdict === '기대 이상').length;
  const hitRate = sampleSize > 0 ? Math.round(100 * hitCount / sampleSize) : 0;
  const bonusRate = sampleSize > 0 ? Math.round(100 * bonusCount / sampleSize) : 0;
  return {
    window,
    sampleSize,
    hitRate,
    bonusRate,
    ready: sampleSize >= minSample,
  };
}
