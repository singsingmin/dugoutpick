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

// liveHeat v1.1 raw core — data-pipeline/liveHeatCore.mjs 와 동일 로직(복제).
// ⚠️ 수정 시 liveHeatCore.mjs + test/liveheat.test.mjs 골든 테이블을 함께 갱신할 것(ADR-021).
// 무상태 raw 만 계산. momentum/smooth 는 앱 클라이언트(app/utils/liveHeat.ts) 전용.
function isBottom(half: string): boolean {
  return half === 'B' || half === 'bottom';
}

function getCloseFactor(diff: number): number {
  if (diff <= 0) return 1.0;
  if (diff === 1) return 0.94;
  if (diff === 2) return 0.78;
  if (diff === 3) return 0.58;
  if (diff === 4) return 0.38;
  if (diff === 5) return 0.20;
  return 0.06;
}

function liveHeat(inning: number, half: string, scoreDiff: number, totalRuns: number): number {
  const inn = inning || 1;
  const bottom = isBottom(half);
  const diff = Math.abs(scoreDiff);

  const closeF = getCloseFactor(diff);
  const halfProgress = inn + (bottom ? 0.5 : 0);
  const cappedProgress = Math.min(halfProgress, 9.5);
  const lateF = 0.35 + 0.65 * Math.pow(cappedProgress / 9.5, 1.2);

  let heat = 78 * closeF * lateF;

  if (inn >= 9 && bottom && diff <= 1) heat += 12;
  else if (inn >= 9 && diff <= 1) heat += 5;

  const isExtra = inn > 9;
  if (isExtra && diff <= 2) heat += Math.min(12, 6 + Math.max(0, inn - 10) * 3);

  const runs = totalRuns || 0;
  if (diff <= 3) heat += Math.min(8, Math.max(0, runs - 7) * 1.5);

  return Math.max(0, Math.min(100, Math.round(heat)));
}

function liveLabel(inning: number, half: string, scoreDiff: number, totalRuns: number): string {
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

// ── KBO live fetch 캐시 + stale fallback (Cloudflare Cache API, 엣지 colo별) ──
// fresh: LIVE 있으면 15초 / 없으면 60초. stale 허용: 5분(KBO 장애 시 마지막 성공값 반환).
const FRESH_LIVE_MS = 15_000;
const FRESH_IDLE_MS = 60_000;
const STALE_MAX_MS = 300_000;
type CacheState = 'HIT' | 'MISS' | 'STALE' | 'FALLBACK_STATIC';
interface CachedLive { games: any[]; fetchedAt: number; }

function liveCacheKey(date: string): Request {
  return new Request(`https://dugout-live-cache.internal/kbo-live/${date}`);
}

async function getLiveGames(date: string): Promise<{ games: any[]; state: CacheState }> {
  const key = liveCacheKey(date);
  let cached: CachedLive | null = null;
  const hit = await caches.default.match(key);
  if (hit) { try { cached = (await hit.json()) as CachedLive; } catch { cached = null; } }

  const now = Date.now();
  if (cached && Array.isArray(cached.games)) {
    const age = now - cached.fetchedAt;
    const hasLive = cached.games.some((g) => resolveStatus(g, '') === 'LIVE');
    const freshMs = hasLive ? FRESH_LIVE_MS : FRESH_IDLE_MS;
    if (age <= freshMs) return { games: cached.games, state: 'HIT' };   // 신선 → KBO 호출 안 함
  }

  // 신선 캐시 없음 → KBO 재요청
  try {
    const games = await fetchKboGames(date);
    const body = JSON.stringify({ games, fetchedAt: now } as CachedLive);
    await caches.default.put(key, new Response(body, {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${STALE_MAX_MS / 1000}` },
    }));
    return { games, state: 'MISS' };
  } catch (e) {
    // 재요청 실패 → stale 캐시(5분 내) 있으면 그걸로, 없으면 상위에서 정적 폴백
    if (cached && Array.isArray(cached.games) && (now - cached.fetchedAt) <= STALE_MAX_MS) {
      return { games: cached.games, state: 'STALE' };
    }
    throw e;
  }
}

const CORS: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Expose-Headers': 'X-Live-Cache',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const path = new URL(request.url).pathname.replace(/^\//, '') || 'games.json';

    if (path === 'games.json') {
      const date = kstToday();
      // 정적 데이터(GitHub)는 항상 fetch. 실패 시 텍스트 폴백.
      let staticData: any;
      try {
        staticData = await fetch(`${GITHUB_RAW}/games.json?t=${Date.now()}`).then(r => r.json());
      } catch {
        // JSON 파싱 실패 → 원문 텍스트라도 그대로 전달 시도. 그 fetch마저 실패하면 503(500 대신 명시적 응답).
        try {
          const fb = await fetch(`${GITHUB_RAW}/games.json?t=${Date.now()}`);
          return new Response(await fb.text(), { headers: { ...CORS, 'X-Live-Cache': 'FALLBACK_STATIC' } });
        } catch {
          return new Response(JSON.stringify({ games: [], error: 'static_unavailable' }), {
            status: 503, headers: { ...CORS, 'X-Live-Cache': 'FALLBACK_STATIC' },
          });
        }
      }
      // 라이브는 캐시 경유(신선 15/60초, stale 5분). 완전 실패면 오버레이 없이 정적만.
      let kboGames: any[] = [];
      let cacheState: CacheState = 'FALLBACK_STATIC';
      try {
        const live = await getLiveGames(date);
        kboGames = live.games; cacheState = live.state;
      } catch { /* kboGames=[] → 오버레이 없이 정적 그대로, 헤더 FALLBACK_STATIC */ }

      {
        const kboById: Record<string, any> = {};
        for (const g of kboGames) if (g.G_ID) kboById[g.G_ID] = g;

        const games = (staticData?.games ?? []).map((game: any) => {
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
              label: liveLabel(inning, half, diff, total),
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
          { headers: { ...CORS, 'X-Live-Cache': cacheState } }
        );
      }
    }

    // standings/report/recent 등 → GitHub raw 패스스루
    const proxy = await fetch(`${GITHUB_RAW}/${path}?t=${Date.now()}`);
    return new Response(await proxy.text(), { status: proxy.status, headers: CORS });
  },
};
