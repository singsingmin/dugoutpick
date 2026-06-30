// liveHeat v1.1 — '지금 볼 각' 실시간 흥미도 raw core (순수 함수, 부작용 0).
//
// ⚠️ 이 로직은 cf-worker/src/index.ts 에 동일하게 복제되어 있다(Worker는 TS, 여기는 ESM).
//    수정 시 반드시 양쪽을 함께 고치고, test/liveheat.test.mjs 골든 테이블도 갱신할 것.
//    (추후 shared/liveHeatCore 로 단일화 예정 — ADR-021)
//
// raw 계산만 담당한다(무상태). momentumBonus·smoothLiveHeat 는 직전 상태가 필요하므로
// 앱 클라이언트(app/utils/liveHeat.ts)에서만 처리한다. ADR-021 / data-schema.md 참조.
//
// half 는 KBO 'T'(초)/'B'(말) 또는 'top'/'bottom' 모두 허용.

function isBottom(half) {
  return half === 'B' || half === 'bottom';
}

// 점수차별 박빙도 lookup. 선형보다 0~2점차를 확실히 뜨겁게, 6점차+도 완전히 0으로 죽이지 않음.
export function getCloseFactor(diff) {
  if (diff <= 0) return 1.0;
  if (diff === 1) return 0.94;
  if (diff === 2) return 0.78;
  if (diff === 3) return 0.58;
  if (diff === 4) return 0.38;
  if (diff === 5) return 0.20;
  return 0.06;
}

// 무상태 raw 흥미도(0~100). 박빙(closeF) × 후반진행도(lateF) 코어 + 끝내기/연장/난타전 가산.
export function rawLiveHeat(inning, half, scoreDiff, totalRuns) {
  const inn = inning || 1;
  const bottom = isBottom(half);
  const diff = Math.abs(scoreDiff);

  const closeF = getCloseFactor(diff);
  // half-inning 진행도: 9회초(9.0)와 9회말(9.5)을 lateF에도 일부 구분(cap 9.5).
  const halfProgress = inn + (bottom ? 0.5 : 0);
  const cappedProgress = Math.min(halfProgress, 9.5);
  const lateF = 0.35 + 0.65 * Math.pow(cappedProgress / 9.5, 1.2);

  let heat = 78 * closeF * lateF;

  // 끝내기/9회 보너스: 9회말·연장말 1점차 이하는 한 방이면 끝(+12). 9회초 등은 +5로 완화.
  if (inn >= 9 && bottom && diff <= 1) heat += 12;
  else if (inn >= 9 && diff <= 1) heat += 5;

  // 연장: 돌입 자체가 긴장 상승, 길어질수록 가산(2점차 이하 한정, 최대 +12).
  const isExtra = inn > 9;
  if (isExtra && diff <= 2) heat += Math.min(12, 6 + Math.max(0, inn - 10) * 3);

  // 난타전: 총득점 많으면 소폭 가산(박빙 3점차 이하 한정, 최대 +8).
  const runs = totalRuns || 0;
  if (diff <= 3) heat += Math.min(8, Math.max(0, runs - 7) * 1.5);

  return Math.max(0, Math.min(100, Math.round(heat)));
}

// 무상태 raw 라벨. momentum 라벨(방금 동점/추격)은 앱이 우선순위에 맞춰 덮어쓴다.
export function liveLabel(inning, half, scoreDiff, totalRuns) {
  const inn = inning || 1;
  const bottom = isBottom(half);
  const diff = Math.abs(scoreDiff);
  const runs = totalRuns || 0;
  const isExtra = inn > 9;

  if (inn >= 9 && bottom && diff <= 1) return '끝내기 한 방 찬스';
  if (isExtra && diff <= 2) return '연장 혈투 진행 중';
  if (inn >= 9 && diff <= 1) return '9회 1점 승부';
  if (inn >= 7 && diff <= 2) return '후반 박빙 승부';
  if (runs >= 10 && diff <= 3) return '점수 나는 난타전';
  if (inn <= 5 && diff <= 2) return '초반 팽팽한 흐름';
  if (diff >= 6) return '점수차가 벌어진 경기';
  return '경기 흐름 체크 중';
}
