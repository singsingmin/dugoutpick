// 포스트시즌(가을야구) 컨텍스트 로직 — 순수 함수 모듈(I/O 없음, 테스트 가능).
// 설계: docs/postseason-plan.md. API 스파이크 검증(2026-07-11, 2025 실데이터)에 근거.
//
// 이 모듈은 build.mjs 라이브 파이프라인과 분리돼 있어 정규시즌 동작에 영향을 주지 않는다.
// (liveHeatCore.mjs 처럼 순수 로직만. fetch·wiring 은 통합 단계에서 build.mjs 로.)
//
// KBO GetKboGameList(POST, body=`leId=1&srId=${srId}&date=${date}`) 필드 실측:
//  - SR_ID(라운드별): WC=4 · 준PO=3 · PO=5 · KS=7  (로드맵 메모는 틀렸었음)
//  - GAME_SC_NM: "WC1","준PO3","PO1","KS5" (라운드+차전 문자열)
//  - VS_GAME_CN: 차전 번호(정수)
//  - T_SCORE_CN(원정)·B_SCORE_CN(홈), AWAY_NM/HOME_NM, G_ID(YYYYMMDD+away+home+n)
//  - GAME_STATE_SC="3" 종료 / GAME_RESULT_CK=1 결과확정
//  - 시리즈 스코어 필드는 없음 → 끝난 경기 누적으로 도출(홈/원정이 차전마다 바뀌므로 코드 기준)
//  - 시드/순위 필드(T_RANK_NO 등)는 null → standings 정규시즌 최종순위로 시드 판정

// 라운드별 srId (GetKboGameList 요청용)
export const ROUND_SRID = { WC: 4, '준PO': 3, PO: 5, KS: 7 };
// 감지 시 시도할 포스트시즌 srId 목록(진행 라운드만 게임 반환)
export const POSTSEASON_SRIDS = [4, 3, 5, 7];
// 시리즈 최대 경기수(표시용)
export const SERIES_FORMAT = { WC: 2, '준PO': 5, PO: 5, KS: 7 };
// 라운드 표시명
export const ROUND_LABEL = { WC: '와일드카드 결정전', '준PO': '준플레이오프', PO: '플레이오프', KS: '한국시리즈' };
// 라운드 순서(브래킷·정렬용)
export const ROUND_ORDER = ['WC', '준PO', 'PO', 'KS'];

// GAME_SC_NM 파싱 → { round, gameNo }. 준PO를 PO보다 먼저 매칭(부분문자열 함정).
export function parseRound(gameScNm) {
  if (!gameScNm) return null;
  const m = String(gameScNm).match(/(WC|준PO|PO|KS)\s*(\d+)/);
  if (!m) return null;
  return { round: m[1], gameNo: +m[2] };
}

// 시리즈 승리 조건(clinch에 필요한 승수). WC는 4위(상위) 1승 어드밴티지 → 상위 1승·하위 2승.
export function winsNeeded(round, isHighSeed) {
  if (round === 'WC') return isHighSeed ? 1 : 2;
  if (round === 'KS') return 4;
  return 3; // 준PO · PO (5전 3선승)
}

// KBO 원본 game 객체 → 정규화 shape. round 파싱 실패(=포스트시즌 아님)면 null.
export function normalizeGame(raw) {
  const gid = String(raw.G_ID || '');
  const r = parseRound(raw.GAME_SC_NM);
  if (!r || gid.length < 12) return null;
  const awayScore = raw.T_SCORE_CN === '' || raw.T_SCORE_CN == null ? null : Number(raw.T_SCORE_CN);
  const homeScore = raw.B_SCORE_CN === '' || raw.B_SCORE_CN == null ? null : Number(raw.B_SCORE_CN);
  const canceled = raw.CANCEL_SC_NM && raw.CANCEL_SC_NM !== '정상경기';
  const finished = String(raw.GAME_STATE_SC) === '3' && Number(raw.GAME_RESULT_CK) === 1 && !canceled;
  return {
    gameId: gid,
    date: gid.slice(0, 8),
    round: r.round,
    gameNo: r.gameNo,
    awayCode: gid.slice(8, 10),
    homeCode: gid.slice(10, 12),
    awayName: raw.AWAY_NM ?? null,
    homeName: raw.HOME_NM ?? null,
    awayScore: Number.isFinite(awayScore) ? awayScore : null,
    homeScore: Number.isFinite(homeScore) ? homeScore : null,
    finished,
    canceled: !!canceled,
  };
}

// 경기 승자 코드(무승부/미종료 = null). T=원정, B=홈.
export function gameWinnerCode(g) {
  if (!g.finished || g.awayScore == null || g.homeScore == null || g.awayScore === g.homeScore) return null;
  return g.awayScore > g.homeScore ? g.awayCode : g.homeCode;
}

// 같은 라운드의 종료 경기들 → 시리즈 스코어 { [code]: 승수 }. (홈/원정 무관, 코드 누적)
export function accumulateSeriesScore(roundGames) {
  const score = {};
  for (const g of roundGames) {
    const w = gameWinnerCode(g);
    if (w) score[w] = (score[w] || 0) + 1;
  }
  return score;
}

// 포스트시즌 컨텍스트 빌드.
//  round, gameNo: 오늘 경기 라운드/차전
//  awayCode, homeCode: 오늘 경기 팀 코드
//  seriesScore: 오늘 경기 '전'까지의 시리즈 스코어 { code: 승 } (accumulateSeriesScore 결과)
//  rankOf: (code) => 정규시즌 최종순위(작을수록 상위). standings 에서 유도.
export function buildPostseasonContext({ round, gameNo, awayCode, homeCode, seriesScore = {}, rankOf }) {
  const aRank = rankOf(awayCode) ?? 99;
  const hRank = rankOf(homeCode) ?? 99;
  const high = aRank <= hRank ? awayCode : homeCode; // 상위 시드(순위 낮은 수)
  const low = high === awayCode ? homeCode : awayCode;
  const sHigh = seriesScore[high] || 0;
  const sLow = seriesScore[low] || 0;
  const wnHigh = winsNeeded(round, true);
  const wnLow = winsNeeded(round, false);
  // 오늘 이기면 클린치(진출/우승)인가 = 매치포인트
  const mpHigh = sHigh + 1 >= wnHigh;
  const mpLow = sLow + 1 >= wnLow;
  // 오늘 지면 탈락 = 상대가 오늘 클린치 가능 = 상대 매치포인트
  const elimHigh = mpLow;
  const elimLow = mpHigh;
  return {
    active: true,
    round,
    roundName: ROUND_LABEL[round],
    gameNo,
    seriesFormat: SERIES_FORMAT[round],
    high, low,
    seriesScore: { [high]: sHigh, [low]: sLow },
    matchpoint: { [high]: mpHigh, [low]: mpLow },
    elimination: { [high]: elimHigh, [low]: elimLow },
    isFinalGame: mpHigh && mpLow, // 최종차전(양쪽 매치포인트)
    wcAdvantage: round === 'WC',  // 4위 1승 어드밴티지 안내 플래그
  };
}

// ── 포스트시즌 꿀잼지수(정규시즌 공식과 분리) ──────────────
// 설계: docs/postseason-plan.md §1. base 70 순수 가산, 로지스틱 없음, clamp[68,100].
// 정규시즌은 '여러 경기 중 변별'이지만 PO는 하루 1경기 → "오늘 이 경기가 얼마나 큰 판이냐" 기대치.
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const aceness = (era) => (era == null ? 0 : clamp01((5.0 - era) / 3.0)); // 5.0→0, 2.0→1

// 라운드 가산: 뒤 라운드일수록 무게.
const ROUND_BONUS = { WC: 0, '준PO': 2, PO: 4, KS: 7 };

// computePostseasonHonjam({ ctx, awayERA, homeERA, prevGame })
//  ctx: buildPostseasonContext 결과
//  awayERA, homeERA: 오늘 양 선발 ERA(없으면 null → 선발 가산 0)
//  prevGame: 시리즈 내 직전 경기 흐름 { diff(점수차), extra(연장), walkoff(끝내기), comeback(역전) } (선택)
export function computePostseasonHonjam({ ctx, awayERA = null, homeERA = null, prevGame = null }) {
  const { high, low, matchpoint, elimination, isFinalGame, seriesScore, round } = ctx;

  // 라운드
  const roundPts = ROUND_BONUS[round] ?? 0;

  // 승부처(시리즈상황 ∪ 탈락위기) — 가장 큰 지렛대
  let stakesPts;
  const anyMatchpoint = matchpoint[high] || matchpoint[low];       // 이기면 클린치
  const anyElimination = elimination[high] || elimination[low];    // 지면 탈락
  if (isFinalGame) stakesPts = 18;                                  // 최종차전(양쪽 매치포인트)
  else if (anyMatchpoint || anyElimination) stakesPts = 12;        // 엘리미네이션·클린치
  else {
    // 그 외: 시리즈 팽팽할수록 ↑ (스코어 격차 작을수록). 0-0/1-1=+8, 격차1=+5, 격차2=+2, 그 이상 0.
    const gap = Math.abs((seriesScore[high] || 0) - (seriesScore[low] || 0));
    stakesPts = Math.max(0, 8 - gap * 3);
  }

  // 선발: 양 에이스일수록 ↑ (0~+6)
  const pitcherPts = 6 * (aceness(awayERA) + aceness(homeERA)) / 2;

  // 직전경기 흐름(시리즈 내 직전 경기): 명승부였으면 다음 경기 기대 ↑ (0~+4). 최댓값 하나만.
  let momentumPts = 0;
  if (prevGame) {
    if (prevGame.walkoff) momentumPts = 4;               // 끝내기
    else if (prevGame.comeback) momentumPts = 3;         // 역전
    else if (prevGame.extra) momentumPts = 3;            // 연장
    else if (prevGame.diff === 1) momentumPts = 2;       // 1점차
  }

  const raw = 70 + roundPts + stakesPts + pitcherPts + momentumPts;
  const score = Math.max(68, Math.min(100, Math.round(raw)));

  // 리드 문구(가장 큰 서사)
  let reason;
  if (isFinalGame) reason = '운명의 최종전';
  else if (anyMatchpoint) reason = round === 'KS' ? '우승까지 한 걸음, 매치포인트' : '시리즈 매치포인트';
  else if (anyElimination) reason = '지면 탈락, 벼랑 끝 승부';
  else if (pitcherPts >= 4) reason = '양 팀 에이스 총력전';
  else reason = `${ROUND_LABEL[round]} ${ctx.gameNo}차전`;

  return {
    score,
    factors: { base: 70, round: roundPts, stakes: stakesPts, pitcher: Math.round(pitcherPts * 10) / 10, momentum: momentumPts },
    reason,
  };
}

// ── 감지(I/O) ──────────────────────────────────────────────
// 단일 날짜에 대해 포스트시즌 srId 를 순회하며 진행 중인 라운드의 경기를 반환.
// 정규시즌엔 어느 srId 도 게임을 안 주므로 games=[] (→ 포스트시즌 아님).
// fetchImpl(srId, date) => Promise<원본 game[]> 를 주입(테스트/live 공용, 기본 global fetch).
export async function fetchPostseasonGames(date, fetchImpl = defaultFetch) {
  for (const srId of POSTSEASON_SRIDS) {
    const raw = await fetchImpl(srId, date);
    const games = (raw || []).map(normalizeGame).filter(Boolean);
    if (games.length) return { srId, round: games[0].round, date, games };
  }
  return { srId: null, round: null, date, games: [] };
}

// 한 라운드 전체 경기(여러 날짜)를 모아 시리즈 스코어를 누적하기 위한 fetch.
// dates: 해당 라운드가 걸친 날짜 배열(YYYYMMDD). 같은 라운드 경기만 필터해 반환.
export async function fetchRoundGames(round, dates, fetchImpl = defaultFetch) {
  const srId = ROUND_SRID[round];
  const all = [];
  for (const date of dates) {
    const raw = await fetchImpl(srId, date);
    for (const g of (raw || []).map(normalizeGame)) {
      if (g && g.round === round) all.push(g);
    }
  }
  return all.sort((a, b) => a.gameNo - b.gameNo);
}

async function defaultFetch(srId, date) {
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  const res = await fetch('https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'Referer': 'https://www.koreabaseball.com/', 'User-Agent': UA },
    body: `leId=1&srId=${srId}&date=${date}`,
  });
  if (!res.ok) return [];
  return (await res.json()).game || [];
}

// 시리즈 현황 카드 맥락 한 줄(표시용). nameOf: (code)=>표시명.
export function seriesContextLine(ctx, nameOf = (c) => c) {
  const { high, low, gameNo, matchpoint, elimination, isFinalGame, wcAdvantage, seriesScore } = ctx;
  if (wcAdvantage && gameNo === 1) {
    return `4위 ${nameOf(high)} 1승 어드밴티지 · 5위 ${nameOf(low)}는 2연승 필요`;
  }
  if (isFinalGame) return '운명의 최종전';
  // 매치포인트(이기면 진출/우승) 우선
  if (matchpoint[high]) return `${nameOf(high)} 이기면 ${ctx.round === 'KS' ? '우승' : '진출'}`;
  if (matchpoint[low]) return `${nameOf(low)} 이기면 ${ctx.round === 'KS' ? '우승' : '진출'}`;
  // 벼랑끝(지면 탈락)
  if (elimination[low]) return `${nameOf(low)} 지면 탈락`;
  if (elimination[high]) return `${nameOf(high)} 지면 탈락`;
  const total = (seriesScore[high] || 0) + (seriesScore[low] || 0);
  return total === 0 ? '시리즈 개막' : `시리즈 ${seriesScore[high]}-${seriesScore[low]}`;
}
