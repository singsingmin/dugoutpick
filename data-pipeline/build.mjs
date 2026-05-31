// DugoutPick 데이터 파이프라인
// KBO 실데이터 fetch → 파싱 → 꿀잼지수 계산 → games/standings/teams JSON 생성
// 실행: node data-pipeline/build.mjs [YYYYMMDD]  (날짜 생략 시 KST 오늘)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEAMS, byName } from './teams.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'output');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DugoutPick/1.0';
const strip = (h) => (h || '').replace(/<[^>]+>/g, '').trim();

// KST 오늘 (YYYYMMDD)
function kstToday() {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
  return f.format(new Date()).replace(/-/g, '');
}

// ---------------- Fetchers ----------------
async function fetchGames(date) {
  const res = await fetch('https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'Referer': 'https://www.koreabaseball.com/', 'User-Agent': UA },
    body: `leId=1&srId=0&date=${date}`,
  });
  if (!res.ok) throw new Error(`GetKboGameList HTTP ${res.status}`);
  return (await res.json()).game || [];
}

async function fetchStandings() {
  const res = await fetch('https://www.koreabaseball.com/Record/TeamRank/TeamRankDaily.aspx', { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`TeamRankDaily HTTP ${res.status}`);
  const html = await res.text();
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
    .map(m => [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(c => strip(c[1])));
  // 컬럼: 순위|팀명|경기|승|패|무|승률|게임차|최근10경기|연속|홈|방문
  const data = rows.filter(r => r.length >= 12 && /^\d+$/.test(r[0]));
  return data.map(r => {
    const team = byName[r[1]];
    return {
      rank: +r[0], code: team?.code ?? null, name: r[1],
      games: +r[2], win: +r[3], loss: +r[4], draw: +r[5],
      winRate: parseFloat(r[6]) || 0,
      gamesBehind: r[7] === '0' || r[7] === '-' ? 0 : parseFloat(r[7]) || 0,
      last10: r[8], streak: r[9], home: r[10], away: r[11],
    };
  });
}

async function fetchEraMap() {
  const res = await fetch('https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic1.aspx', { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`PitcherBasic HTTP ${res.status}`);
  const html = await res.text();
  const map = {};
  for (const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const c = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x => strip(x[1]));
    if (c.length > 5 && /^\d+$/.test(c[0]) && /^\d\.\d\d$/.test(c[3])) map[c[1]] = parseFloat(c[3]);
  }
  return map;
}

// ---------------- 꿀잼지수 ----------------
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const strength = (r) => (10 - r) / 9;
const playoffRel = (r) => (r >= 4 && r <= 7 ? 1 : (r === 3 || r === 8 ? 0.5 : 0));
const aceness = (era) => clamp01((5.0 - era) / 3.0);
const LEAGUE_ERA = 4.20;
const W = { close: 30, quality: 20, form: 15, rivalry: 10, playoff: 10, pitcher: 15 };
const calibrate = (raw) => Math.round(100 / (1 + Math.exp(-(raw - 45) / 10)));

const rivKey = (a, b) => [a, b].sort().join('|');
const RIVALRY = { 'LG|두산': 1.0, 'NC|롯데': 0.7, '롯데|삼성': 0.7, 'KIA|삼성': 0.6 };
const RIVALRY_NAME = { 'LG|두산': '잠실 라이벌 더비', 'NC|롯데': '낙동강 더비', '롯데|삼성': '영남 더비', 'KIA|삼성': '전통의 명문 자존심 대결' };

const last10Wins = (s) => parseInt((s || '').match(/^(\d+)승/)?.[1] ?? '5', 10);
const streakSigned = (s) => {
  const m = (s || '').match(/(\d+)(승|패)/);
  if (!m) return 0;
  return (+m[1]) * (m[2] === '승' ? 1 : -1);
};

function computeHonjam(aw, hm, sa, sh, aPit, hPit, aERA, hERA) {
  const a = { rank: sa.rank, wr: sa.winRate, gb: sa.gamesBehind, l10: last10Wins(sa.last10), streak: streakSigned(sa.streak) };
  const h = { rank: sh.rank, wr: sh.winRate, gb: sh.gamesBehind, l10: last10Wins(sh.last10), streak: streakSigned(sh.streak) };
  const parts = {
    close: clamp01(1 - Math.abs(a.wr - h.wr) / 0.15),
    quality: (strength(a.rank) + strength(h.rank)) / 2,
    form: 0.6 * ((a.l10 + h.l10) / 20) + 0.4 * Math.min(1, Math.max(Math.abs(a.streak), Math.abs(h.streak)) / 7),
    rivalry: RIVALRY[rivKey(aw, hm)] || 0,
    playoff: (playoffRel(a.rank) + playoffRel(h.rank)) / 2,
    pitcher: (aceness(aERA) + aceness(hERA)) / 2,
  };
  if (Math.abs(a.rank - h.rank) <= 1 && a.rank >= 3 && a.rank <= 8 && h.rank >= 3 && h.rank <= 8) parts.playoff = 1;

  // 한 줄 이유 / 관전 포인트 프래그먼트. (점수는 승률 기반, 표시는 게임차 기반 — 게임차가 직관적)
  const gbDiff = Math.abs(a.gb - h.gb);
  const gbStr = gbDiff.toFixed(1).replace(/\.0$/, '');
  const frag = {};
  frag.close =
    gbDiff === 0 ? `게임차 없는 동률 초접전`
    : gbDiff <= 2 ? `게임차 ${gbStr}, 막상막하 승부`
    : `게임차 ${gbStr}의 순위 다툼`;
  frag.quality = Math.max(a.rank, h.rank) <= 4 ? `리그 ${Math.min(a.rank, h.rank)}위·${Math.max(a.rank, h.rank)}위 상위권 빅매치` : '';
  const sp = Math.abs(a.streak) >= Math.abs(h.streak) ? [aw, a.streak] : [hm, h.streak];
  frag.form = sp[1] <= -5 ? `${sp[0]} ${-sp[1]}연패 탈출 도전` : sp[1] >= 3 ? `${sp[0]} ${sp[1]}연승 질주` : `양 팀 최근 10경기 합 ${a.l10 + h.l10}승의 화력`;
  frag.rivalry = RIVALRY_NAME[rivKey(aw, hm)] || '';
  frag.playoff = (a.rank >= 7 || h.rank >= 7) ? `${Math.max(a.rank, h.rank)}위권 PO 생존 경쟁` : '가을야구 직행 순위 다툼';
  const bestNM = aERA <= hERA ? aPit : hPit, bestERA = Math.min(aERA, hERA);
  frag.pitcher = (aERA < 3.6 && hERA < 3.6) ? `양 팀 에이스 투수전(ERA ${aERA}·${hERA})` : (bestERA < 3.6 ? `${bestNM}(ERA ${bestERA}) 호투 기대` : '');

  const raw = Object.entries(W).reduce((s, [k, w]) => s + w * parts[k], 0);
  const contrib = Object.entries(W).map(([k, w]) => [k, w * parts[k]]).filter(([k, v]) => k !== 'rivalry' && v > 0.5 && frag[k]).sort((x, y) => y[1] - x[1]);
  const main = contrib.length ? frag[contrib[0][0]] : frag.close;
  let reason;
  if (frag.rivalry) reason = `${frag.rivalry} · ${main}`;
  else if (contrib[1] && contrib[1][1] >= contrib[0][1] * 0.65 && frag[contrib[1][0]] !== main) reason = `${main} · ${frag[contrib[1][0]]}`;
  else reason = main;

  // 관전 포인트: 라이벌(있으면) + 기여도순 프래그먼트 상위 3
  const points = [];
  if (frag.rivalry) points.push(frag.rivalry);
  for (const [k] of contrib) if (frag[k] && !points.includes(frag[k])) points.push(frag[k]);

  return {
    score: calibrate(raw),
    reason,
    points: points.slice(0, 3),
    factors: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, +v.toFixed(2)])),
  };
}

// ---------------- 상태 매핑 ----------------
function gameStatus(g) {
  if (g.CANCEL_SC_ID && g.CANCEL_SC_ID !== '0') return 'CANCELED';
  if (g.GAME_RESULT_CK === 1) return 'FINAL';
  return 'SCHEDULED';
}

// ---------------- Build ----------------
async function main() {
  const date = process.argv[2] || kstToday();
  console.log(`[build] date=${date}`);

  const [rawGames, standings, eraMap] = await Promise.all([fetchGames(date), fetchStandings(), fetchEraMap()]);
  const stByName = Object.fromEntries(standings.map(s => [s.name, s]));
  console.log(`[build] games=${rawGames.length} standings=${standings.length} eraPitchers=${Object.keys(eraMap).length}`);

  const games = rawGames.map(g => {
    const awName = g.AWAY_NM.trim(), hmName = g.HOME_NM.trim();
    const sa = stByName[awName], sh = stByName[hmName];
    const aPit = (g.T_PIT_P_NM || '').trim(), hPit = (g.B_PIT_P_NM || '').trim();
    const aERAraw = eraMap[aPit], hERAraw = eraMap[hPit];
    const status = gameStatus(g);
    const played = status === 'FINAL';
    let honjam = null;
    if (sa && sh) honjam = computeHonjam(awName, hmName, sa, sh, aPit, hPit, aERAraw ?? LEAGUE_ERA, hERAraw ?? LEAGUE_ERA);
    return {
      gameId: g.G_ID,
      time: g.G_TM,
      stadium: g.S_NM,
      status,
      broadcast: g.TV_IF || '',
      away: { code: g.AWAY_ID, name: awName, rank: g.T_RANK_NO ?? sa?.rank ?? null, score: played ? +g.T_SCORE_CN : null, starter: aPit ? { name: aPit, era: aERAraw ?? null } : null },
      home: { code: g.HOME_ID, name: hmName, rank: g.B_RANK_NO ?? sh?.rank ?? null, score: played ? +g.B_SCORE_CN : null, starter: hPit ? { name: hPit, era: hERAraw ?? null } : null },
      honjam,
    };
  });

  // 추천 경기 = 최고 꿀잼지수
  const ranked = games.filter(g => g.honjam).sort((a, b) => b.honjam.score - a.honjam.score);
  const recommendedGameId = ranked[0]?.gameId ?? null;

  const dt = `${date.slice(0, 4)}년 ${+date.slice(4, 6)}월 ${+date.slice(6, 8)}일`;
  const updatedAt = new Date().toISOString();

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'games.json'), JSON.stringify({ date, dateText: dt, updatedAt, recommendedGameId, games }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'standings.json'), JSON.stringify({ updatedAt, standings }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'teams.json'), JSON.stringify({ teams: TEAMS }, null, 2));

  console.log(`[build] wrote games.json (${games.length}), standings.json (${standings.length}), teams.json (${TEAMS.length})`);
  console.log(`[build] 추천경기: ${recommendedGameId}`);
}

main().catch(e => { console.error('[build] FAILED:', e.message); process.exit(1); });
