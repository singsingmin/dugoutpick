// 순수 로직 — Phase 3-Pre "실제 꿀잼 경기 판정". build.mjs·테스트가 import(부작용 없음).
// 예측 리그의 정답 산출: 경기 종료 후 그날 "진짜 꿀잼 1위 경기"를 실제 데이터로 판정.
// 설계: docs/prediction-league-design.md §5·§8.
//
// 판정: recapScore(recap.actual, 경기 후 실제 꿀잼 점수) 최고 = 그날 1위.
//   동률이면 미세 tiebreak(끝내기>연장>접전>난타) → 그래도 완전 동률이면 공동 1위(tiedGameIds).
//   (live.heat 피크는 MVP 미채택 — recapScore가 이미 끝내기·연장·접전·득점을 종합 반영. 결정 (b))
// 확정: 취소 아닌 경기가 전부 FINAL일 때만 판정(그전엔 잠정 = null). recap-history처럼 append-only freeze.

// FINAL 게임의 드라마 지표 → 미세 tiebreak 키(내림차순 비교). recap에 담긴 값 사용.
function fineKey(g) {
  const r = g.recap || {};
  return [
    r.walkoff ? 1 : 0,       // 끝내기
    r.extra ? 1 : 0,         // 연장
    -(r.diff ?? 99),         // 점수차 작을수록(접전) 우선 → 음수화
    r.total ?? 0,            // 총득점(난타전)
  ];
}
function cmpKey(a, b) {                       // a-b>0이면 a가 앞(내림차순 정렬용)
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}
function keyEqual(a, b) { return a.every((v, i) => v === b[i]); }

// 판정 이유 태그(결과 화면 UX). recap 드라마 지표 기반.
export function reasonTags(g) {
  const r = g?.recap || {};
  const tags = [];
  if (r.walkoff) tags.push('끝내기');
  if (r.extra) tags.push('연장 접전');
  const d = r.diff ?? 99;
  if (d <= 1) tags.push('1점차 접전');
  else if (d <= 2) tags.push('2점차 접전');
  if ((r.total ?? 0) >= 14) tags.push('난타전');
  // 특별 태그가 없으면 경기 후 실제 꿀잼 점수(recap.actual)를 폴백으로.
  if (tags.length === 0) tags.push(`실제 꿀잼 ${r.actual ?? '-'}`);
  return tags;
}

// 화면 표시 분기용 — 끝내기·연장·2점차이내·난타 중 하나라도 있으면 '특별한' 경기.
export function hasSpecialTag(g) {
  const r = g?.recap || {};
  return !!r.walkoff || !!r.extra || (r.diff ?? 99) <= 2 || (r.total ?? 0) >= 14;
}

// 그날 게임 배열 → DailyHoneyResult | null(미확정/노게임).
export function judgeDailyHoney(games, date, calculatedAt) {
  const playable = (games || []).filter((g) => g.status !== 'CANCELED');
  if (playable.length === 0) return null;                          // 전 경기 취소/노게임
  const finals = playable.filter(
    (g) => g.status === 'FINAL' && g.recap && typeof g.recap.actual === 'number',
  );
  if (finals.length !== playable.length) return null;              // 아직 안 끝난 경기 → 미확정

  const maxScore = Math.max(...finals.map((g) => g.recap.actual));
  const top = finals.filter((g) => g.recap.actual === maxScore);

  let actualTopGameId = null;
  let tiedGameIds;
  if (top.length === 1) {
    actualTopGameId = top[0].gameId;
  } else {
    const keyed = top.map((g) => ({ g, k: fineKey(g) })).sort((a, b) => cmpKey(b.k, a.k));
    const best = keyed[0].k;
    const winners = keyed.filter((x) => keyEqual(x.k, best)).map((x) => x.g);
    if (winners.length === 1) actualTopGameId = winners[0].gameId;
    else tiedGameIds = winners.map((g) => g.gameId);
  }

  const topGame = actualTopGameId
    ? finals.find((g) => g.gameId === actualTopGameId)
    : finals.find((g) => g.gameId === tiedGameIds[0]);

  // 화면 표시 분기: 특별 태그가 있거나 실제 꿀잼 >= 60이면 '명경기', 아니면 '요약'으로 톤다운.
  // (예측 리그 정답 판정 자체는 위에서 그대로 산출 — 표시만 분기)
  const displayMode = (hasSpecialTag(topGame) || maxScore >= 60) ? 'highlight' : 'summary';

  return {
    date,
    actualTopGameId,
    ...(tiedGameIds ? { tiedGameIds } : {}),
    recapScore: maxScore,
    decidingReasonTags: reasonTags(topGame),
    displayMode,
    displayTitle: displayMode === 'highlight' ? '어제의 명경기' : '어제 경기 요약',
    // 앱의 '어제의 명경기' 카드용 경량 스냅샷(별도 히스토리 없이 매치업·스코어 표시).
    away: { code: topGame.away.code, name: topGame.away.name, score: topGame.away.score },
    home: { code: topGame.home.code, name: topGame.home.name, score: topGame.home.score },
    calculatedAt,
  };
}

// append-only 멱등 병합. 이미 그 date 결과가 있으면 덮지 않음(freeze). result=null이면 변화 없음.
export function mergeDailyHoney(existing, result) {
  const base = Array.isArray(existing) ? existing : [];
  if (!result) return base;
  if (base.some((r) => r.date === result.date)) return base;      // freeze
  return [...base, result];
}
