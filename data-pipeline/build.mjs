// DugoutPick 데이터 파이프라인
// KBO 실데이터 fetch → 파싱 → 꿀잼지수 계산 → games/standings/teams JSON 생성
// 실행: node data-pipeline/build.mjs [YYYYMMDD]  (날짜 생략 시 KST 오늘)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEAMS, byName, byCode } from './teams.mjs';
import { resolveFrozen, toRecord, mergeHistory, aggregate, WINDOW, MIN_SAMPLE } from './recap.mjs';

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
  const rowsOf = (t) => [...t.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
    .map(m => [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(c => strip(c[1])));

  // 1) 순위표 (컬럼: 순위|팀명|경기|승|패|무|승률|게임차|최근10|연속|홈|방문|득점?|실점?…)
  // r[12]=득점(RS) 존재 시 타선 득점력 계산에 활용. 컬럼 수는 KBO 페이지 버전에 따라 가변.
  const data = rowsOf(html).filter(r => r.length >= 12 && /^\d+$/.test(r[0]));
  const standings = data.map(r => {
    const team = byName[r[1]];
    return {
      rank: +r[0], code: team?.code ?? null, name: r[1],
      games: +r[2], win: +r[3], loss: +r[4], draw: +r[5],
      winRate: parseFloat(r[6]) || 0,
      gamesBehind: r[7] === '0' || r[7] === '-' ? 0 : parseFloat(r[7]) || 0,
      last10: r[8], streak: r[9], home: r[10], away: r[11],
      rs: r.length > 12 ? (+r[12] || 0) : 0,  // 득점(Runs Scored). 없으면 0(폴백: 리그평균 가정)
    };
  });

  // 2) 팀간 승패 매트릭스 (두 번째 테이블) → h2h[팀명][상대팀명] = "승-패-무"
  const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/g)].map(m => m[0]);
  const h2h = {};
  if (tables[1]) {
    const mrows = rowsOf(tables[1]);
    const header = (mrows[0] || []).map(c => c.replace(/\(.*\)/, '')); // "LG(승-패-무)" → "LG"
    for (const r of mrows) {
      if (!r[0] || !byName[r[0]]) continue; // 데이터 행(첫 셀=팀명)만
      h2h[r[0]] = {};
      for (let i = 1; i < header.length - 1; i++) {
        const opp = header[i];
        if (byName[opp] && /^\d+-\d+-\d+$/.test(r[i] || '')) h2h[r[0]][opp] = r[i];
      }
    }
  }

  // 각 팀 standing에 상대전적(코드별) 부착: vs[상대코드] = "승-패-무"
  for (const s of standings) {
    s.vs = {};
    const row = h2h[s.name] || {};
    for (const [oppName, rec] of Object.entries(row)) {
      const oc = byName[oppName]?.code;
      if (oc) s.vs[oc] = rec;
    }
  }

  return { standings, h2h };
}

// 월별 스케줄(종료+예정 모두). gameId로 날짜·팀코드, play셀로 점수.
async function fetchMonthSchedule(year, month) {
  const res = await fetch('https://www.koreabaseball.com/ws/Schedule.asmx/GetScheduleList', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'Referer': 'https://www.koreabaseball.com/Schedule/Schedule.aspx', 'User-Agent': UA },
    body: `leId=1&srIdList=0,9,6&teamId=&date=${year}${month}01&seasonId=${year}&gameYear=${year}&gameMonth=${month}`,
  });
  if (!res.ok) return [];
  const j = await res.json();
  const out = [];
  for (const r of j.rows || []) {
    const cells = r.row || [];
    const gid = (cells.map(c => String(c.Text)).join(' ').match(/gameId=([0-9A-Z]+)/) || [])[1];
    if (!gid || gid.length < 12) continue;
    const play = cells.find(c => c.Class === 'play');
    if (!play) continue;
    // 승부 결정: class=win/lose, 무승부: class=same (둘 다 동점). 무승부도 종료 경기로 잡아야 최근폼에 표시됨.
    const nums = [...String(play.Text).matchAll(/class="(?:win|lose|same)"[^>]*>(\d+)</g)];
    const finished = nums.length >= 2;
    out.push({ date: gid.slice(0, 8), away: gid.slice(8, 10), home: gid.slice(10, 12), aS: finished ? +nums[0][1] : null, hS: finished ? +nums[1][1] : null, finished });
  }
  return out;
}

// 지난달+이번달 스케줄(주간 리포트·최근경기 공용 소스)
async function fetchSchedule2mo(date) {
  const y = date.slice(0, 4), m = date.slice(4, 6);
  const prevM = +m - 1;
  const months = prevM >= 1 ? [[y, String(prevM).padStart(2, '0')], [y, m]] : [[String(+y - 1), '12'], [y, m]];
  let all = [];
  for (const [yy, mm] of months) all = all.concat(await fetchMonthSchedule(yy, mm));
  return all.sort((a, b) => a.date.localeCompare(b.date));
}

// 선발 타순 조회: SCHEDULED/LIVE 경기만. j[3]=홈팀, j[4]=원정팀.
// LINEUP_CK=false 시 최근 기준 추정 타순 반환(confirmed=false).
async function fetchLineup(gameId, seasonId) {
  try {
    const res = await fetch('https://www.koreabaseball.com/ws/Schedule.asmx/GetLineUpAnalysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'Referer': 'https://www.koreabaseball.com/', 'User-Agent': UA },
      body: `leId=1&srId=0&seasonId=${seasonId}&gameId=${gameId}`,
    });
    if (!res.ok) return null;
    const j = await res.json();
    if (!Array.isArray(j) || j.length < 5) return null;
    const confirmed = j[0]?.[0]?.LINEUP_CK === true;
    const parseTable = (charObj) => {
      try {
        const str = Object.values(charObj || {}).join('');
        const table = JSON.parse(str);
        return (table.rows || []).map(r => {
          const cells = (r.row || []).map(c => c.Text || '');
          return { order: +cells[0] || 0, pos: cells[1] || '', name: cells[2] || '' };
        }).filter(p => p.order > 0 && p.name);
      } catch { return []; }
    };
    const home = parseTable(j[3]?.[0]);
    const away = parseTable(j[4]?.[0]);
    if (!home.length && !away.length) return null;
    return { home, away, confirmed };
  } catch { return null; }
}

// 팀별 최근 N경기 W/L·득실 (폼 타임라인용) — 종료 경기만
function buildRecent(schedule) {
  const byTeam = {};
  const add = (code, oppCode, isHome, sf, sa, date) => {
    const result = sf > sa ? 'W' : sf < sa ? 'L' : 'D';
    (byTeam[code] ||= []).push({ date, oppCode, isHome, sf, sa, result });
  };
  for (const g of schedule) {
    if (!g.finished) continue;
    add(g.away, g.home, false, g.aS, g.hS, g.date);
    add(g.home, g.away, true, g.hS, g.aS, g.date);
  }
  for (const k of Object.keys(byTeam)) byTeam[k] = byTeam[k].slice(-10);
  return byTeam;
}

async function fetchPitcherStats() {
  const res = await fetch('https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic1.aspx', { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`PitcherBasic HTTP ${res.status}`);
  const html = await res.text();
  // 컬럼: 순위|이름|팀|ERA|G|승|패|... (ERA 다음 G(경기수)가 있어 W=c[5], L=c[6])
  const map = {};
  for (const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const c = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x => strip(x[1]));
    if (c.length > 6 && /^\d+$/.test(c[0]) && /^\d\.\d\d$/.test(c[3])) {
      map[c[1]] = { era: parseFloat(c[3]), w: parseInt(c[5], 10) || 0, l: parseInt(c[6], 10) || 0 };
    }
  }
  return map;
}

// 선수 ID로 개별 투수 시즌 기록 조회(규정 미달 등 랭킹표에 없는 선발 보강).
// 상세 페이지 첫 테이블 = 시즌 요약: [팀명, ERA, G, CG, SHO, W, L, ...]. 트레이드 시 '합계' 행 우선.
async function fetchPitcherById(id) {
  try {
    const res = await fetch(`https://www.koreabaseball.com/Record/Player/PitcherDetail/Basic.aspx?playerId=${id}`, { headers: { 'User-Agent': UA } });
    if (!res.ok) return null;
    const html = await res.text();
    const tbl = (html.match(/<table[\s\S]*?<\/table>/) || [])[0] || '';
    let pick = null;
    for (const m of tbl.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
      const c = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x => strip(x[1]));
      if (c.length >= 7 && /^\d+\.\d{2}$/.test(c[1])) {
        const row = { era: parseFloat(c[1]), w: parseInt(c[5], 10) || 0, l: parseInt(c[6], 10) || 0 };
        if (c[0] === '합계') return row; // 시즌 다팀 합계 우선
        if (!pick) pick = row;           // 아니면 첫 유효행
      }
    }
    return pick;
  } catch { return null; }
}

// ---------------- 꿀잼지수 ----------------
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const strength = (r) => (10 - r) / 9;
const playoffRel = (r) => (r >= 4 && r <= 7 ? 1 : (r === 3 || r === 8 ? 0.5 : 0));
const aceness = (era) => clamp01((5.0 - era) / 3.0);
const LEAGUE_ERA = 4.20;
// doom(멸망전): 둘 다 깊은 연패일 때 '연패 탈출 서사' 가산. 평소 경기는 0이라 기존 점수 불변(ADR-016).
// park(파크팩터)+offense(타선득점력) 추가 — center 45→51 (+6) 보정으로 기존 점수 분포 유지.
// v2 (2026-06-27): 피드백 13건 분석 — close↑(박빙이 꿀잼 1순위), playoff↓·rivalry↓(상황만 좋고 내용 없는 경기 과대평가), pitcher↑(선발 압도 꿀잼 태그 반영). 총합 129 유지.
const W = { close: 36, quality: 20, form: 15, rivalry: 6, playoff: 6, pitcher: 17, doom: 18, park: 5, offense: 6 };
const calibrate = (raw) => Math.round(100 / (1 + Math.exp(-(raw - 51) / 10)));
// 시즌 진행도 (KBO 4~10월): 0.0=4월, 1.0=10월. 후반부로 갈수록 순위전 긴박감 가산.
const seasonPhase = (date) => Math.max(0, Math.min(1, (parseInt(date.slice(4, 6), 10) - 4) / 6));

// 파크팩터: 구장별 타자/투수 유불리 (1.0=리그평균). 부분 문자열 매칭.
// 라팍·사직 타자 유리, 잠실·고척 투수 유리 — KBO 통계적 경향 반영.
const PARK_FACTOR_MAP = [
  ['대구', 1.10], ['사직', 1.05], ['광주', 1.03], ['창원', 1.02],
  ['인천', 1.00], ['수원', 0.98], ['대전', 0.96], ['잠실', 0.90], ['고척', 0.88],
];
const parkScore = (stadium) => {
  const s = stadium ?? '';
  const pf = PARK_FACTOR_MAP.find(([k]) => s.includes(k))?.[1] ?? 1.00;
  // 0.88(고척)→0, 1.00(중립)→0.55, 1.10(라팍)→1.0
  return clamp01((pf - 0.88) / 0.22);
};

const rivKey = (a, b) => [a, b].sort().join('|');
const RIVALRY = { 'LG|두산': 1.0, 'NC|롯데': 0.7, '롯데|삼성': 0.7, 'KIA|삼성': 0.6 };
const RIVALRY_NAME = { 'LG|두산': '잠실 라이벌 더비', 'NC|롯데': '낙동강 더비', '롯데|삼성': '영남 더비', 'KIA|삼성': '전통의 명문 자존심 대결' };

const last10Wins = (s) => parseInt((s || '').match(/^(\d+)승/)?.[1] ?? '5', 10);
const streakSigned = (s) => {
  const m = (s || '').match(/(\d+)(승|패)/);
  if (!m) return 0;
  return (+m[1]) * (m[2] === '승' ? 1 : -1);
};

function computeHonjam(aw, hm, sa, sh, aPit, hPit, aERA, hERA, h2hRec, stadium, phase = 0) {
  const a = { rank: sa.rank, wr: sa.winRate, gb: sa.gamesBehind, l10: last10Wins(sa.last10), streak: streakSigned(sa.streak) };
  const h = { rank: sh.rank, wr: sh.winRate, gb: sh.gamesBehind, l10: last10Wins(sh.last10), streak: streakSigned(sh.streak) };
  // form은 '방향 무관 기세'(연승·연패 대칭, ADR-007): 최근10이 .500에서 멀수록 + 연속이 길수록.
  const l10dev = (n) => Math.abs(n - 5) / 5;
  // doom(멸망전): 둘 다 5연패 이상일 때, 더 얕은 쪽 연패 깊이로 강도 산정(누가 먼저 끊나 서사).
  const loseDepth = Math.min(Math.max(0, -a.streak), Math.max(0, -h.streak));
  // 타선 득점력: 경기당 득점(RS/G). rs=0이면 리그평균(5.0) 가정 → 중립값 0.5.
  const LEAGUE_RS_PER_GAME = 5.0;
  const rsPerGame = (rs, games) => (rs > 0 && games > 0) ? rs / games : LEAGUE_RS_PER_GAME;
  const aRSPG = rsPerGame(sa.rs ?? 0, sa.games);
  const hRSPG = rsPerGame(sh.rs ?? 0, sh.games);
  const parts = {
    close: clamp01(1 - Math.abs(a.wr - h.wr) / 0.15),
    quality: (strength(a.rank) + strength(h.rank)) / 2,
    form: 0.6 * ((l10dev(a.l10) + l10dev(h.l10)) / 2) + 0.4 * Math.min(1, Math.max(Math.abs(a.streak), Math.abs(h.streak)) / 7),
    rivalry: RIVALRY[rivKey(aw, hm)] || 0,
    playoff: (playoffRel(a.rank) + playoffRel(h.rank)) / 2,
    pitcher: (aceness(aERA) + aceness(hERA)) / 2,
    // doom: 둘 다 3연패 이상이면 서사 가동. 3연패≈0.22, 5연패≈0.44, 10연패=1.0
    doom: loseDepth >= 3 ? clamp01((loseDepth - 1) / 9) : 0,
    park: parkScore(stadium),
    // 양 팀 평균 득점/경기: 3.5이하→0, 5.0(리그평균)→0.5, 6.5이상→1.0
    offense: clamp01(((aRSPG + hRSPG) / 2 - 3.5) / 3.0),
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
  const totalL10 = a.l10 + h.l10;
  const sp = Math.abs(a.streak) >= Math.abs(h.streak) ? [aw, a.streak] : [hm, h.streak];
  frag.form = sp[1] <= -5 ? `${sp[0]} ${-sp[1]}연패 탈출 도전`
    : sp[1] <= -3 ? `${sp[0]} ${-sp[1]}연패 탈출 발판`
    : sp[1] >= 5 ? `${sp[0]} ${sp[1]}연승 질주, 기세 절정`
    : sp[1] >= 3 ? `${sp[0]} ${sp[1]}연승 질주`
    : totalL10 >= 15 ? `양 팀 최근 10경기 합 ${totalL10}승, 화력 최고조`
    : totalL10 <= 7 ? `양 팀 동반 슬럼프, 승기 선점 싸움`
    : `최근 10경기 ${aw} ${a.l10}승 · ${hm} ${h.l10}승`;
  frag.rivalry = RIVALRY_NAME[rivKey(aw, hm)] || '';
  const rankDiff = Math.abs(a.rank - h.rank);
  const minRank = Math.min(a.rank, h.rank);
  frag.playoff = (a.rank >= 7 || h.rank >= 7) ? `${Math.max(a.rank, h.rank)}위권 PO 생존 경쟁`
    : (minRank >= 5 && rankDiff <= 1) ? `${a.rank}위·${h.rank}위 와일드카드 판가름`
    : '가을야구 직행 순위 다툼';
  const bestNM = aERA <= hERA ? aPit : hPit, bestERA = Math.min(aERA, hERA);
  frag.pitcher = bestERA < 2.5 ? `${bestNM} ERA ${bestERA} 압도적 에이스 등판`
    : (aERA < 3.6 && hERA < 3.6) ? `양 팀 에이스 투수전(ERA ${aERA}·${hERA})`
    : (bestERA < 3.6 ? `${bestNM}(ERA ${bestERA}) 호투 기대` : '');
  // doom frag: 3~4연패=바닥 싸움, 5+연패=멸망전으로 단계 구분
  frag.doom = loseDepth >= 5 ? `연패 탈출 멸망전 · ${aw} ${-a.streak}연패 vs ${hm} ${-h.streak}연패`
    : loseDepth >= 3 ? `동반 연패 바닥 싸움 · ${aw} ${-a.streak}연패 vs ${hm} ${-h.streak}연패`
    : '';
  frag.park = parts.park >= 0.8 ? `라팍·사직급 타자 친화 구장, 고득점 기대`
    : parts.park <= 0.2 ? `잠실·고척급 투수 공원, 투수전 예상`
    : '';
  const avgRSPG = ((aRSPG + hRSPG) / 2).toFixed(1);
  frag.offense = parts.offense >= 0.7 ? `양 팀 타선 화력 상위권(평균 ${avgRSPG}점/경기)`
    : parts.offense >= 0.5 ? `${aw}·${hm} 득점력 기대(평균 ${avgRSPG}점/경기)`
    : '';

  const raw = Object.entries(W).reduce((s, [k, w]) => s + w * parts[k], 0);
  // 시즌 진행도 가산: 9~10월 박빙·순위전 경기에 최대 +8 raw (4월=0, 10월=+8)
  const phaseBonus = phase * 8 * ((parts.close + parts.playoff) / 2);
  // rivalry·doom은 일반 기여도에서 빼고 '리드 문구'로 따로 앞세움
  const contrib = Object.entries(W).map(([k, w]) => [k, w * parts[k]]).filter(([k, v]) => k !== 'rivalry' && k !== 'doom' && v > 0.5 && frag[k]).sort((x, y) => y[1] - x[1]);
  const main = contrib.length ? frag[contrib[0][0]] : frag.close;
  const lead = frag.rivalry || (parts.doom >= 0.5 ? frag.doom : '');
  let reason;
  if (lead) reason = `${lead} · ${main}`;
  else if (contrib[1] && contrib[1][1] >= contrib[0][1] * 0.65 && frag[contrib[1][0]] !== main) reason = `${main} · ${frag[contrib[1][0]]}`;
  else reason = main;

  // 관전 포인트: 라이벌(있으면) + 게임차/상대전적 라벨 항목 + 나머지 서사(close 제외, 게임차로 대체)
  const closeDesc = gbDiff === 0 ? '동률 초접전' : gbDiff <= 2 ? '막상막하' : gbDiff <= 5 ? '순위 다툼' : '';
  const gamePoint = closeDesc ? `게임차 : ${gbStr} · ${closeDesc}` : `게임차 : ${gbStr}`;
  let h2hPoint = '';
  if (h2hRec) {
    const [w, l, d] = h2hRec.split('-').map(Number);
    if (Number.isFinite(w) && Number.isFinite(l)) h2hPoint = `상대전적 : ${aw} ${w}승 ${l}패${d > 0 ? ` ${d}무` : ''}`;
  }

  const points = [];
  if (frag.rivalry) points.push(frag.rivalry);
  if (parts.doom >= 0.3 && frag.doom) points.push(frag.doom);
  points.push(gamePoint);
  if (h2hPoint) points.push(h2hPoint);
  for (const [k] of contrib) if (k !== 'close' && frag[k] && !points.includes(frag[k])) points.push(frag[k]);

  return {
    score: calibrate(raw + phaseBonus),
    reason,
    points: points.slice(0, 4),
    factors: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, +v.toFixed(2)])),
  };
}

// ---------------- 상태 / 라이브 ----------------
// GAME_STATE_SC: 1=예정, 2=경기중, 3=종료 (실데이터로 확인). RESULT_CK=1도 종료.
function gameStatus(g) {
  if (g.CANCEL_SC_ID && g.CANCEL_SC_ID !== '0') return 'CANCELED';
  if (g.GAME_RESULT_CK === 1 || g.GAME_STATE_SC === '3') return 'FINAL';
  if (g.GAME_STATE_SC === '2') return 'LIVE';
  return 'SCHEDULED';
}
// '지금 볼 각' 라이브 흥미도(0~100): 박빙×늦은이닝 코어 + 끝내기 찬스·연장·난타전 드라마 가산.
// 코어 천장을 85로 두고 드라마 가산분(끝내기/연장/난타전)에 헤드룸을 남겨, 진짜 명장면이 평범한 9회보다 위로 오게 함.
function liveHeat(inning, half, scoreDiff, totalRuns) {
  const inn = inning || 1;
  const innF = Math.min(1, inn / 9);              // 이닝 진행 0~1 (9회 만점)
  const closeF = Math.max(0, 1 - scoreDiff / 6);  // 박빙 0~1 (6점차+ = 코어 0 → 볼 각 없음)
  let heat = 85 * closeF * (0.45 + 0.55 * innF);  // 코어: 9회 동점 ≈ 85
  // 끝내기 찬스: 9회+ 말에 동점/1점차(말 진행 자체가 홈 동점·열세 의미) → 한 방이면 끝
  if (inn >= 9 && half === 'B' && scoreDiff <= 1) heat += 10;
  // 연장: 회를 거듭할수록 가산(박빙일 때만 의미 있게). 회당 +4, 최대 +12
  if (inn > 9) heat += closeF * Math.min(12, (inn - 9) * 4);
  // 난타전: 총득점 많으면 소폭 가산(박빙 한정 — 대량점수차 콜드성 경기는 제외)
  heat += closeF * Math.min(8, (totalRuns || 0) / 2);
  return Math.round(Math.max(0, Math.min(100, heat)));
}
function liveLabel(inning, half, scoreDiff) {
  const hk = half === 'B' ? '말' : '초';
  const inn = inning ? `${inning}회${hk}` : '경기 중';
  if (inning >= 9 && half === 'B' && scoreDiff <= 1) return `${inn} 끝내기 찬스`;
  if (inning > 9 && scoreDiff === 0) return `${inn} 연장 혈투`;
  if (scoreDiff === 0) return `${inn} 동점 접전`;
  if (scoreDiff <= 1) return `${inn} ${scoreDiff}점차 접전`;
  return `${inn} ${scoreDiff}점차`;
}

// ---------------- 월요 리포트 ----------------
// 주(KST, 월~일) 경계 계산
function weekBounds(ymd) {
  const d = new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8)));
  const offset = (d.getUTCDay() + 6) % 7; // 월요일까지 일수 (0=일)
  const fmt = (x) => `${x.getUTCFullYear()}${String(x.getUTCMonth() + 1).padStart(2, '0')}${String(x.getUTCDate()).padStart(2, '0')}`;
  const thisMon = new Date(d); thisMon.setUTCDate(d.getUTCDate() - offset);
  const thisSun = new Date(thisMon); thisSun.setUTCDate(thisMon.getUTCDate() + 6);
  const lastMon = new Date(thisMon); lastMon.setUTCDate(thisMon.getUTCDate() - 7);
  const lastSun = new Date(thisMon); lastSun.setUTCDate(thisMon.getUTCDate() - 1);
  return { thisMon: fmt(thisMon), thisSun: fmt(thisSun), lastMon: fmt(lastMon), lastSun: fmt(lastSun) };
}

// 이번주 예측용 가정 선발 ERA(선발 미정이라 평균 에이스 가정 → 점수 보정). LEAGUE_ERA(4.20)보다 좋게.
const WEEKLY_ERA = 3.2;

// 지난주 성적 한줄평 (하이브리드: 규칙으로 상황 판별 + 손수 쓴 밈/드립 문구 라이브러리).
// AI 없음·환각 없음. 실데이터(주간 승패·현재 순위·연속·지난주 잡은/진 상대·다음주 상대)만 사용.
// 경기 내 사건(역전/끝내기 등)은 데이터에 없으므로 절대 지어내지 않는다.
// 같은 데이터엔 항상 같은 문구(결정적), 팀마다 시드가 달라 변주 — seed로 변형 선택.
function weeklyNote(code, rec, ctx) {
  const tn = (c) => ctx.byCode[c]?.name ?? c;
  const { w, l, d, rank } = rec;
  const g = w + l + d;
  const { streak, beat, lost, nextOppRank, rankOf = {}, streakOf = {}, thisOpps = [] } = ctx;
  const seed = (w * 131 + l * 977 + rank * 31) >>> 0; // 인접 값이 다른 변형에 흩어지도록 혼합
  const pick = (arr) => arr[seed % arr.length];

  // 지난주 잡은 '윗물'(나보다 순위 높고 4위 이내) / 덜미 잡힌 '아랫물'(나보다 낮고 8위 이하)
  const upset = beat.filter((o) => o.rank < rank && o.rank <= 4).sort((a, b) => a.rank - b.rank)[0];
  const slip = lost.filter((o) => o.rank > rank && o.rank >= 8).sort((a, b) => b.rank - a.rank)[0];
  const rec2 = `${w}승${l}패${d ? ` ${d}무` : ''}`;

  // 이번주 '해볼 만한 상대': 하위권(8위↓)이거나 연패 중인 약체. 단 상승세(3연승↑) 상대는 제외.
  // 나보다 크게 강하지 않은(순위 비슷↓ 또는 같이 연패) 상대 중 가장 약체를 고른다. 부진한 팀에만 희망 클로즈로 붙임.
  const winnable = thisOpps
    .filter((o) => o !== code)
    .map((o) => ({ code: o, rank: rankOf[o] ?? 99, streak: streakOf[o] ?? 0 }))
    .filter((o) => o.streak < 3 && (o.rank >= 8 || (o.streak <= -3 && o.rank >= rank - 2))) // 하위권 약체 or (연패 중 & 나보다 크게 높지 않음). 상승세 상대는 제외
    .sort((a, b) => (b.rank - a.rank) || (a.streak - b.streak))[0];
  const hope = winnable ? `그래도 이번주 ${tn(winnable.code)} 만나니까 해볼 만해` : null;

  // 우선순위: 극단(전승/장기연속/전패) → 순위 특수(1위/꼴찌/선두권) → 서사(업셋/덜미) → 위닝/루징/반타작
  if (g === 0) return '지난주 경기 없이 재정비 — 이번주를 노린다';
  if (l === 0 && w >= 3) return pick([`${w}전 ${w}승, 거칠 것 없는 무패 주간 🔥`, `지난주 ${w}연승 싹쓸이 — 폼 미쳤다`, `${w}경기 전부 승, 이번주도 못 막는다`]);
  if (streak <= -4) return hope ? `${-streak}연패… ${hope}` : pick([`${-streak}연패 늪, 탈출이 급하다`, `${-streak}연패째… 이러다 큰일 난다`, `${-streak}연패 행진, 분위기 반전이 절실`]);
  if (w === 0 && l >= 3) return hope ? `${l}전 ${l}패… ${hope}` : pick([`${l}전 ${l}패… 출구가 안 보인다`, `지난주 한 경기도 못 잡았다, 단체로 멘탈 가출`, `${l}연패로 마감… 다음주는 제발`]);
  if (streak >= 4) return pick([`${streak}연승 폭주 기관차 🚂 누가 좀 말려봐`, `${streak}연승, 지금이 전성기`, `${streak}연승 질주 — 상승세 제대로다`]);
  if (rank === 1) return pick([`선두 수성 중 — 어쩌라고, 1위인데 (${rec2})`, `${rec2}, 1위는 1위가 한다`, `${rec2}로 선두 유지, 클래스가 다르다`]);
  if (rank === 2 && nextOppRank === 1) return `${rec2}, 다음주 선두 직접 잡으러 간다`;
  if (rank === 10) return hope ? `최하위지만 ${hope}` : pick([`${rec2}, 탈꼴찌가 간절하다`, `10위 바닥에서 반등을 노린다 (${rec2})`, `${rec2}, 더 내려갈 곳도 없다`]);
  if (w > l && upset) return pick([`${tn(upset.code)} 잡고 ${rec2} 위닝 — 윗물 정조준`, `윗물 ${tn(upset.code)} 잡은 ${rec2}, 무섭다`]);
  if (l > w && slip) return pick([`${tn(slip.code)}한테 덜미, ${rec2} 뼈아픈 한 주`, `${tn(slip.code)}한테 발목… ${rec2} 아쉽다`]);
  if (w > l) return pick([`${rec2} 위닝, 분위기 탄다`, `이기는 맛 아는 한 주 — ${rec2}`, `${rec2}로 위닝 마감, 상승 기류`]);
  if (l > w) return hope ? `${rec2} 루징, ${hope}` : pick([`${rec2} 루징, 반등이 필요해`, `살짝 삐끗한 한 주 ${rec2}`, `${rec2}, 다음주 반등을 노린다`]);
  return pick([`딱 반타작 ${rec2}, 평타는 쳤다`, `${rec2} 5할 페이스, 무난한 한 주`, `${rec2}, 이겼다 졌다 롤러코스터`]);
}

function buildReport(date, schedule, standings, starterMap = {}) {
  const wb = weekBounds(date);
  const stByName = Object.fromEntries(standings.map(s => [s.name, s]));
  const inRange = (d, a, b) => d >= a && d <= b;

  // 지난주: 팀별 성적(10팀 전체, 무경기는 0-0-0) + 현재 순위
  const lastTeam = {};
  for (const s of standings) if (s.code) lastTeam[s.code] = { w: 0, l: 0, d: 0, rank: s.rank };
  const reg = (code, sf, sa) => { const t = lastTeam[code]; if (!t) return; if (sf > sa) t.w++; else if (sf < sa) t.l++; else t.d++; };
  // 한줄평용 신호: 지난주 잡은/진 상대(순위 포함), 현재 연속, 다음주 첫 상대
  const rankOf = Object.fromEntries(standings.filter(s => s.code).map(s => [s.code, s.rank]));
  const streakOf = Object.fromEntries(standings.filter(s => s.code).map(s => [s.code, streakSigned(s.streak)]));
  const beatLost = {}; // code -> { beat:[{code,rank}], lost:[{code,rank}] }
  const bl = (code) => (beatLost[code] ||= { beat: [], lost: [] });
  const addWin = (winner, loser) => { bl(winner).beat.push({ code: loser, rank: rankOf[loser] ?? 99 }); bl(loser).lost.push({ code: winner, rank: rankOf[winner] ?? 99 }); };
  for (const g of schedule.filter(x => x.finished && inRange(x.date, wb.lastMon, wb.lastSun))) {
    reg(g.away, g.aS, g.hS); reg(g.home, g.hS, g.aS);
    if (g.aS !== g.hS) (g.aS > g.hS ? addWin(g.away, g.home) : addWin(g.home, g.away));
  }

  // 이번주: 매치업 단위로 중복 제거(시리즈 묶기) → 근사 꿀잼 TOP3(이유 포함) + 팀별 일정
  const thisGames = schedule.filter(g => inRange(g.date, wb.thisMon, wb.thisSun));
  const byPair = {};
  for (const g of thisGames) {
    const k = `${g.away}-${g.home}`;
    (byPair[k] ||= { away: g.away, home: g.home, dates: [] }).dates.push(g.date);
  }
  const thisTop = Object.values(byPair)
    .map(p => {
      const aw = byCode[p.away]?.name, hm = byCode[p.home]?.name;
      const sa = stByName[aw], sh = stByName[hm];
      if (!sa || !sh) return null;
      const hj = computeHonjam(aw, hm, sa, sh, '', '', WEEKLY_ERA, WEEKLY_ERA, null, null, seasonPhase(date)); // 선발 평균 에이스, 구장 중립 가정
      const ds = p.dates.slice().sort();
      return { away: p.away, home: p.home, pred: hj.score, reason: hj.reason, dateStart: ds[0], dateEnd: ds[ds.length - 1] };
    })
    .filter(Boolean).sort((x, y) => y.pred - x.pred).slice(0, 3);
  const thisTeam = {};
  for (const g of thisGames) {
    const key = `${g.date}${g.away}${g.home}`;
    const st = starterMap[key] ?? {};
    const item = { date: g.date, away: g.away, home: g.home, ...st };
    (thisTeam[g.away] ||= []).push(item);
    (thisTeam[g.home] ||= []).push(item);
  }

  // 지난주 한줄평 부착(이번주 상대·첫 상대 순위까지 반영)
  for (const [code, rec] of Object.entries(lastTeam)) {
    const sched = (thisTeam[code] || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const firstOpp = sched.length ? (sched[0].away === code ? sched[0].home : sched[0].away) : null;
    const thisOpps = [...new Set((thisTeam[code] || []).map(gm => (gm.away === code ? gm.home : gm.away)))];
    rec.note = weeklyNote(code, rec, {
      byCode, rankOf, streakOf, thisOpps,
      streak: streakOf[code] ?? 0,
      beat: beatLost[code]?.beat ?? [],
      lost: beatLost[code]?.lost ?? [],
      nextOppRank: firstOpp ? (rankOf[firstOpp] ?? null) : null,
    });
  }

  return {
    lastWeek: { range: [wb.lastMon, wb.lastSun], team: lastTeam },
    thisWeek: { range: [wb.thisMon, wb.thisSun], top: thisTop, team: thisTeam },
  };
}

// ---------------- Build ----------------
async function main() {
  const date = process.argv[2] || kstToday();
  const phase = seasonPhase(date);
  console.log(`[build] date=${date} phase=${phase.toFixed(2)}`);

  const [rawGames, { standings, h2h }, pmap, schedule] = await Promise.all([
    fetchGames(date),
    fetchStandings(),
    fetchPitcherStats(),
    fetchSchedule2mo(date).catch(() => []), // 스케줄 실패해도 빌드 계속
  ]);
  const stByName = Object.fromEntries(standings.map(s => [s.name, s]));
  const recent = buildRecent(schedule);

  // 이번주 선발 맵: 이번주 전체 경기 날짜(최대 7일)를 병렬 fetch
  // 오늘 경기는 rawGames에 이미 있으므로 제외
  const wb = weekBounds(date);
  const weekDates = [...new Set(
    schedule.filter(g => g.date >= wb.thisMon && g.date <= wb.thisSun).map(g => g.date)
  )].filter(d => d !== date);
  const weekGamesList = await Promise.all(
    weekDates.map(d => fetchGames(d).catch(() => []))
  );
  const starterMap = {};
  for (const games of [[...rawGames], ...weekGamesList]) {
    for (const g of games) {
      if (!g.G_ID || g.G_ID.length < 12) continue;
      const key = g.G_ID.slice(0, 12);
      const awSt = (g.T_PIT_P_NM || '').trim() || null;
      const hmSt = (g.B_PIT_P_NM || '').trim() || null;
      if (awSt || hmSt) starterMap[key] = { awayStarter: awSt, homeStarter: hmSt };
    }
  }

  const report = buildReport(date, schedule, standings, starterMap);

  // 선발 보강: 랭킹표(규정 충족)에 없는 선발만 player ID로 개별 조회 → 규정 미달 투수도 ERA/승/패 노출
  const missIds = [...new Set(
    rawGames
      .flatMap(g => [[g.T_PIT_P_NM, g.T_PIT_P_ID], [g.B_PIT_P_NM, g.B_PIT_P_ID]])
      .filter(([nm, id]) => id && nm && nm.trim() && !pmap[nm.trim()])
      .map(([, id]) => id)
  )];
  const byId = Object.fromEntries(await Promise.all(missIds.map(async id => [id, await fetchPitcherById(id)])));
  // 선발 기록 조회: 이름(랭킹표) 우선 → 없으면 ID(개별조회)
  const statOf = (nm, id) => pmap[(nm || '').trim()] || (id != null ? byId[id] : null) || null;

  const filledById = Object.values(byId).filter(Boolean).length;
  console.log(`[build] games=${rawGames.length} standings=${standings.length} pitchers=${Object.keys(pmap).length}(+${filledById} byId) recentTeams=${Object.keys(recent).length} thisWeekTop=${report.thisWeek.top.length}`);

  // 라인업: SCHEDULED/LIVE 경기만 병렬 fetch
  const seasonId = date.slice(0, 4);
  const lineupMap = {};
  const lineupTargets = rawGames.filter(g => { const s = gameStatus(g); return s === 'SCHEDULED' || s === 'LIVE'; });
  await Promise.all(lineupTargets.map(async (g) => {
    const lu = await fetchLineup(g.G_ID, seasonId);
    if (lu) lineupMap[g.G_ID] = lu;
  }));
  console.log(`[build] lineups fetched=${Object.keys(lineupMap).length}/${lineupTargets.length}`);

  // freeze: 직전 산출물의 꿀잼지수를 읽어, 이미 시작된 경기는 '경기 전 값'을 유지(드리프트 방지)
  const prevHonjam = {};
  const prevStatus = {};
  try {
    const prev = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'games.json'), 'utf8'));
    for (const g of prev.games || []) {
      if (g.gameId && g.honjam) prevHonjam[g.gameId] = g.honjam;
      if (g.gameId) prevStatus[g.gameId] = g.status;
    }
  } catch { /* 직전 산출물 없음(첫 실행/새 날짜) → 신규 계산 */ }

  const games = rawGames.map(g => {
    const awName = g.AWAY_NM.trim(), hmName = g.HOME_NM.trim();
    const sa = stByName[awName], sh = stByName[hmName];
    const aPit = (g.T_PIT_P_NM || '').trim(), hPit = (g.B_PIT_P_NM || '').trim();
    const aStat = statOf(g.T_PIT_P_NM, g.T_PIT_P_ID), hStat = statOf(g.B_PIT_P_NM, g.B_PIT_P_ID);
    const status = gameStatus(g);
    const hasScore = status === 'FINAL' || status === 'LIVE'; // 종료·경기중엔 스코어 노출
    const aScore = hasScore ? +g.T_SCORE_CN : null;
    const bScore = hasScore ? +g.B_SCORE_CN : null;
    let honjam = null;
    if (status !== 'SCHEDULED' && prevHonjam[g.G_ID]) {
      const frozen = resolveFrozen({ prevHonjam: prevHonjam[g.G_ID], prevStatus: prevStatus[g.G_ID] });
      honjam = { ...prevHonjam[g.G_ID], frozen }; // 경기 시작 후엔 경기 전 값 고정 + frozen 보존/발화
    } else if (sa && sh) {
      honjam = computeHonjam(awName, hmName, sa, sh, aPit, hPit, aStat?.era ?? LEAGUE_ERA, hStat?.era ?? LEAGUE_ERA, h2h[awName]?.[hmName] ?? null, g.S_NM ?? null, phase);
    }
    const starter = (name, st) => name ? { name, era: st?.era ?? null, w: st?.w ?? null, l: st?.l ?? null } : null;
    // 종료 경기: 승리/패전/세이브 투수(경기 단위 필드). 무승부면 win/lose 없음 → null.
    const pn = (name) => { const t = (name || '').trim(); return t || null; };
    const decision = status === 'FINAL' ? { win: pn(g.W_PIT_P_NM), lose: pn(g.L_PIT_P_NM), save: pn(g.SV_PIT_P_NM) } : null;
    let live = null;
    if (status === 'LIVE') {
      const inning = g.GAME_INN_NO ?? null;
      const half = g.GAME_TB_SC ?? null;
      const diff = Math.abs((aScore ?? 0) - (bScore ?? 0));
      const total = (aScore ?? 0) + (bScore ?? 0);
      live = {
        inning, half,
        out: g.OUT_CN ?? null,
        b1: (g.B1_BAT_ORDER_NO ?? 0) !== 0,
        b2: (g.B2_BAT_ORDER_NO ?? 0) !== 0,
        b3: (g.B3_BAT_ORDER_NO ?? 0) !== 0,
        // T(초)=원정팀 공격: 홈팀(B)이 투수, 원정팀(T)이 타자. B(말)=반대.
        pitcher: half === 'T' ? (g.B_P_NM || '').trim() || null : (g.T_P_NM || '').trim() || null,
        batter:  half === 'T' ? (g.T_P_NM || '').trim() || null : (g.B_P_NM || '').trim() || null,
        heat: liveHeat(inning, half, diff, total),
        label: liveLabel(inning, half, diff),
      };
    }
    // 경기 후 꿀잼결산: 종료 박스스코어로 '실제 꿀잼' 계산(예측과 같은 보정곡선) + 판정
    let recap = null;
    if (status === 'FINAL' && aScore != null && bScore != null) {
      const diff = Math.abs(aScore - bScore);
      const total = aScore + bScore;
      const inning = g.GAME_INN_NO || 9;
      const extra = inning > 9 ? 1 : 0;
      const walkoff = (bScore > aScore && g.GAME_TB_SC === 'B' && inning >= 9) ? 1 : 0;
      const rawActual = 55 * Math.max(0, 1 - diff / 7) + 20 * extra + 15 * walkoff + 10 * Math.min(1, total / 16);
      const actual = Math.round(100 / (1 + Math.exp(-(rawActual - 30) / 10)));
      const pred = honjam ? honjam.score : null;
      const verdict = pred == null ? null
        : actual >= pred + 10 ? '기대 이상'
        : actual <= pred - 10 ? '기대 이하'
        : '예측 적중';
      recap = { actual, verdict };
    }
    return {
      gameId: g.G_ID,
      time: g.G_TM,
      stadium: g.S_NM,
      status,
      cancelReason: status === 'CANCELED' ? (g.CANCEL_SC_NM || '취소') : null, // 예: "우천취소"
      broadcast: g.TV_IF || '',
      away: { code: g.AWAY_ID, name: awName, rank: g.T_RANK_NO ?? sa?.rank ?? null, score: aScore, starter: starter(aPit, aStat) },
      home: { code: g.HOME_ID, name: hmName, rank: g.B_RANK_NO ?? sh?.rank ?? null, score: bScore, starter: starter(hPit, hStat) },
      honjam,
      live,
      recap,
      decision,
      lineup: lineupMap[g.G_ID] ?? null,
    };
  });

  // 추천 경기 = 최고 꿀잼지수
  const ranked = games.filter(g => g.honjam).sort((a, b) => b.honjam.score - a.honjam.score);
  const recommendedGameId = ranked[0]?.gameId ?? null;

  const dt = `${date.slice(0, 4)}년 ${+date.slice(4, 6)}월 ${+date.slice(6, 8)}일`;
  const updatedAt = new Date().toISOString();

  // recap-history 누적 + trackRecord 집계
  let history = [];
  try {
    const h = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'recap-history.json'), 'utf8'));
    history = Array.isArray(h.records) ? h.records : [];
  } catch { /* 첫 실행 → 빈 history */ }
  const incoming = games.map(g => toRecord(g, date)).filter(Boolean);
  const merged = mergeHistory(history, incoming);
  const trackRecord = aggregate(merged, { window: WINDOW, minSample: MIN_SAMPLE });
  // 집계 미달 시 최근 5경기 프리뷰 (선별 금지: 있는 그대로 slice)
  if (!trackRecord.ready && merged.length > 0) {
    trackRecord.recentRecapPreview = merged.slice(-5).reverse().map(r => ({ pred: r.pred, verdict: r.verdict }));
  }
  console.log(`[build] recap-history: +${incoming.length} new, total ${merged.length}, hitRate ${trackRecord.hitRate}% (n=${trackRecord.sampleSize}, ready=${trackRecord.ready})`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'recap-history.json'),
    JSON.stringify({ updatedAt, ...trackRecord, records: merged }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'games.json'), JSON.stringify({ date, dateText: dt, updatedAt, trackRecord, recommendedGameId, games }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'standings.json'), JSON.stringify({ updatedAt, standings }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'teams.json'), JSON.stringify({ teams: TEAMS }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'recent.json'), JSON.stringify({ updatedAt, recent }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify({ updatedAt, ...report }, null, 2));

  console.log(`[build] wrote games/standings/teams/recent/report.json`);
  console.log(`[build] 추천경기: ${recommendedGameId}`);
}

main().catch(e => { console.error('[build] FAILED:', e.message); process.exit(1); });
