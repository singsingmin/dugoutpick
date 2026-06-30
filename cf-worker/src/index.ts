// DugoutPick KBO Live Worker
// games.json: GitHub 정적 데이터(honjam·선발 완료본) + KBO 실시간 점수/라이브 오버레이
// 나머지(standings/report 등): GitHub raw 패스스루
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DugoutPick/1.0';
const GITHUB_RAW = 'https://raw.githubusercontent.com/singsingmin/dugoutpick/main/data-pipeline/output';

const ST_MAP: Record<string, string> = {
  '1': 'SCHEDULED', '2': 'LIVE', '3': 'FINAL', '4': 'CANCELED', '9': 'CANCELED',
};

// build.mjs 검증 완료: GAME_STATE_SC가 정확한 상태 필드. GAME_SC_ID와 다를 수 있음.
function resolveStatus(g: any, fallback: string): string {
  if (g.CANCEL_SC_ID && g.CANCEL_SC_ID !== '0') return 'CANCELED';
  if (g.GAME_RESULT_CK === 1 || g.GAME_STATE_SC === '3') return 'FINAL';
  if (g.GAME_STATE_SC === '2') return 'LIVE';
  return ST_MAP[g.GAME_SC_ID] ?? fallback;
}

function parseScore(v: any): number | null {
  if (v == null || v === '') return null;
  const n = +v;
  return isNaN(n) ? null : n;
}

function kstToday(): string {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10).replace(/-/g, '');
}

function liveHeat(inning: number, half: string, diff: number, total: number): number {
  const inn = inning || 1;
  const innF = Math.min(1, inn / 9);
  const closeF = Math.max(0, 1 - diff / 6);
  let heat = 85 * closeF * (0.45 + 0.55 * innF);
  if (inn >= 9 && half === 'B' && diff <= 1) heat += 10;
  if (inn > 9) heat += closeF * Math.min(12, (inn - 9) * 4);
  return Math.round(Math.max(0, Math.min(100, heat)));
}

function liveLabel(inning: number, half: string, diff: number): string {
  const hk = half === 'B' ? '말' : '초';
  const inn = inning ? `${inning}회${hk}` : '경기 중';
  if (inning >= 9 && half === 'B' && diff <= 1) return `${inn} 끝내기 찬스`;
  if (inning > 9 && diff === 0) return `${inn} 연장 혈투`;
  if (diff === 0) return `${inn} 동점 접전`;
  if (diff <= 1) return `${inn} ${diff}점차 접전`;
  return `${inn} ${diff}점차`;
}

async function fetchKboGames(date: string): Promise<any[]> {
  const res = await fetch('https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Referer': 'https://www.koreabaseball.com/',
      'User-Agent': UA,
    },
    body: `leId=1&srId=0&date=${date}`,
  });
  if (!res.ok) throw new Error(`KBO API ${res.status}`);
  const json = await res.json() as any;
  return json.game ?? [];
}

const CORS: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const path = new URL(request.url).pathname.replace(/^\//, '') || 'games.json';

    if (path === 'games.json') {
      try {
        const date = kstToday();
        const [staticData, kboGames] = await Promise.all([
          fetch(`${GITHUB_RAW}/games.json?t=${Date.now()}`).then(r => r.json()) as Promise<any>,
          fetchKboGames(date),
        ]);

        const kboById: Record<string, any> = {};
        for (const g of kboGames) if (g.G_ID) kboById[g.G_ID] = g;

        const games = (staticData.games ?? []).map((game: any) => {
          const g = kboById[game.gameId];
          if (!g) return game;

          const status = resolveStatus(g, game.status);
          const hasScore = status === 'FINAL' || status === 'LIVE';
          const aScore = hasScore ? parseScore(g.T_SCORE_CN) : null;
          const bScore = hasScore ? parseScore(g.B_SCORE_CN) : null;

          let live = null;
          if (status === 'LIVE') {
            const inning: number = g.GAME_INN_NO ?? 1;
            const half: string = g.GAME_TB_SC ?? 'T';
            const diff = Math.abs((aScore ?? 0) - (bScore ?? 0));
            const total = (aScore ?? 0) + (bScore ?? 0);
            live = {
              inning, half,
              out: g.OUT_CN ?? null,
              b1: (g.B1_BAT_ORDER_NO ?? 0) !== 0,
              b2: (g.B2_BAT_ORDER_NO ?? 0) !== 0,
              b3: (g.B3_BAT_ORDER_NO ?? 0) !== 0,
              pitcher: half === 'T' ? (g.B_P_NM || '').trim() || null : (g.T_P_NM || '').trim() || null,
              batter:  half === 'T' ? (g.T_P_NM || '').trim() || null : (g.B_P_NM || '').trim() || null,
              heat: liveHeat(inning, half, diff, total),
              label: liveLabel(inning, half, diff),
            };
          }

          return {
            ...game,
            status,
            cancelReason: status === 'CANCELED' ? (g.CANCEL_SC_NM || game.cancelReason || '취소') : game.cancelReason,
            away: { ...game.away, score: aScore },
            home: { ...game.home, score: bScore },
            live,
          };
        });

        return new Response(
          JSON.stringify({ ...staticData, updatedAt: new Date().toISOString(), games }),
          { headers: CORS }
        );
      } catch {
        // KBO API 실패 시 정적 데이터로 폴백
        const fallback = await fetch(`${GITHUB_RAW}/games.json?t=${Date.now()}`);
        return new Response(await fallback.text(), { headers: CORS });
      }
    }

    // standings/report/recent 등 → GitHub raw 패스스루
    const proxy = await fetch(`${GITHUB_RAW}/${path}?t=${Date.now()}`);
    return new Response(await proxy.text(), { headers: CORS });
  },
};
