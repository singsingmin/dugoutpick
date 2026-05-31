// 꿀잼지수 1안 — 오늘(2026-05-31) 실데이터에 적용
// 스파이크에서 확인된 순위표 데이터 (rank,team,winRate,last10win,streak(+승/-패))
const standings = {
  'LG':  { rank: 1,  wr: 0.615, l10: 7, streak: +2 },
  'KT':  { rank: 2,  wr: 0.608, l10: 6, streak: +3 },
  '삼성': { rank: 3,  wr: 0.600, l10: 6, streak: -2 },
  'KIA': { rank: 4,  wr: 0.538, l10: 7, streak: -2 },
  '한화': { rank: 5,  wr: 0.510, l10: 6, streak: +3 },
  '두산': { rank: 6,  wr: 0.481, l10: 5, streak: +2 },
  'SSG': { rank: 7,  wr: 0.431, l10: 0, streak: -11 },
  'NC':  { rank: 8,  wr: 0.420, l10: 3, streak: +1 },
  '롯데': { rank: 8,  wr: 0.420, l10: 5, streak: -1 },
  '키움': { rank: 10, wr: 0.377, l10: 3, streak: -7 },
};

// 오늘 경기 (원정 vs 홈)
const todayGames = [
  ['KIA', 'LG'], ['두산', '삼성'], ['롯데', 'NC'], ['SSG', '한화'], ['KT', '키움'],
];

const rivKey = (a, b) => [a, b].sort().join('|');
// 라이벌 테이블 (rivKey로 키 생성해 정렬 순서 불일치 방지)
const rivalryPairs = [
  [['LG', '두산'], 1.0], [['롯데', 'NC'], 0.7], [['롯데', '삼성'], 0.7], [['KIA', '삼성'], 0.6],
];
const rivalry = Object.fromEntries(rivalryPairs.map(([[a, b], v]) => [rivKey(a, b), v]));
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const strength = (rank) => (10 - rank) / 9;
const playoffRel = (rank) => (rank >= 4 && rank <= 7 ? 1.0 : (rank === 3 || rank === 8 ? 0.5 : 0));

const W = { close: 35, quality: 25, form: 20, rivalry: 10, playoff: 10 };

function honjam(awayName, homeName) {
  const a = standings[awayName], h = standings[homeName];
  // 1. 순위 근접도
  const close = clamp01(1 - Math.abs(a.wr - h.wr) / 0.15);
  // 2. 상위권 매치
  const quality = (strength(a.rank) + strength(h.rank)) / 2;
  // 3. 최근 폼/스토리
  const formWins = (a.l10 + h.l10) / 20;
  const drama = Math.min(1, Math.max(Math.abs(a.streak), Math.abs(h.streak)) / 7);
  const form = 0.6 * formWins + 0.4 * drama;
  // 4. 라이벌전
  const riv = rivalry[rivKey(awayName, homeName)] || 0;
  // 5. 가을야구 경쟁
  let playoff = (playoffRel(a.rank) + playoffRel(h.rank)) / 2;
  if (Math.abs(a.rank - h.rank) <= 1 && a.rank >= 3 && a.rank <= 8 && h.rank >= 3 && h.rank <= 8) playoff = 1.0;

  const score = W.close * close + W.quality * quality + W.form * form + W.rivalry * riv + W.playoff * playoff;
  return { score, parts: { close, quality, form, riv, playoff } };
}

const results = todayGames.map(([aw, hm]) => {
  const { score, parts } = honjam(aw, hm);
  return { game: `${aw} vs ${hm}`, score: Math.round(score), ...Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, +v.toFixed(2)])) };
}).sort((x, y) => y.score - x.score);

console.log('=== 꿀잼지수 1안 — 오늘 경기 순위 ===\n');
console.table(results);
console.log(`\n⭐ 오늘의 추천: ${results[0].game} (${results[0].score}점)`);
