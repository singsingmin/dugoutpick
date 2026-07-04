// 서버 푸시 발송기 — 경기 시작 ~30분 전 "오늘 내 팀 경기" 알림.
// update-data 워크플로에서 build.mjs 뒤 실행. games.json(방금 생성) 읽어 시작 임박 경기 →
// 해당 팀 팬(profiles.favorite_team)의 enabled 푸시 토큰 조회 → Expo Push 발송. push_log로 중복 방지.
// 의존성 없음(Node fetch + builtins). service_role로 Supabase REST 접근(RLS 우회).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPA_URL || !SUPA_KEY) { console.log('[push] SUPABASE env 없음 — 스킵'); process.exit(0); }

// 발송 윈도: 시작 20~40분 전(넓게 잡아 5분 간격 실행 누락에도 커버, push_log가 중복 차단).
const WIN_LO = 20 * 60 * 1000, WIN_HI = 40 * 60 * 1000;

const H = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' };
const rest = (p) => `${SUPA_URL}/rest/v1/${p}`;

function kstStart(yyyymmdd, hhmm) {
  if (!/^\d{8}$/.test(yyyymmdd) || !/^\d{1,2}:\d{2}$/.test(hhmm || '')) return null;
  const y = +yyyymmdd.slice(0, 4), mo = +yyyymmdd.slice(4, 6), d = +yyyymmdd.slice(6, 8);
  const [h, mi] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - 9 * 3600 * 1000);   // KST=UTC+9
}

async function tokensForTeam(code) {
  // favorite_team=code인 프로필 → 그 user_id의 enabled 토큰.
  const pr = await fetch(rest(`profiles?favorite_team=eq.${encodeURIComponent(code)}&select=id`), { headers: H });
  const profs = await pr.json();
  const ids = (profs || []).map((p) => p.id);
  if (ids.length === 0) return [];
  const tr = await fetch(rest(`push_tokens?enabled=eq.true&user_id=in.(${ids.join(',')})&select=token`), { headers: H });
  const toks = await tr.json();
  return (toks || []).map((t) => t.token).filter(Boolean);
}

async function sendExpo(messages) {
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(chunk),
    });
    if (!res.ok) console.warn('[push] Expo 발송 실패:', res.status, await res.text());
  }
}

(async () => {
  const gamesPath = path.join(__dirname, 'output', 'games.json');
  if (!fs.existsSync(gamesPath)) { console.log('[push] games.json 없음 — 스킵'); return; }
  const data = JSON.parse(fs.readFileSync(gamesPath, 'utf8'));
  const now = Date.now();
  const sendDate = `${data.date.slice(0, 4)}-${data.date.slice(4, 6)}-${data.date.slice(6, 8)}`;

  const due = (data.games || []).filter((g) => {
    if (g.status === 'CANCELED' || g.status === 'FINAL' || g.status === 'LIVE') return false;
    const start = kstStart(data.date, g.time);
    if (!start) return false;
    const delta = start.getTime() - now;
    return delta >= WIN_LO && delta <= WIN_HI;
  });
  if (due.length === 0) { console.log('[push] 발송 대상 경기 없음'); return; }

  for (const g of due) {
    // 중복 방지: push_log 삽입(게임+날짜 유니크). 이미 있으면 409 → 스킵.
    const logRes = await fetch(rest('push_log'), {
      method: 'POST', headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({ game_id: g.gameId, send_date: sendDate }),
    });
    if (logRes.status === 409) { console.log(`[push] 이미 발송됨: ${g.gameId}`); continue; }
    if (!logRes.ok) { console.warn(`[push] push_log 실패(${g.gameId}):`, logRes.status); continue; }

    // 팀별 개인화("오늘 [내 팀] 경기").
    const messages = [];
    for (const side of ['away', 'home']) {
      const me = g[side], opp = g[side === 'away' ? 'home' : 'away'];
      const tokens = await tokensForTeam(me.code);
      const score = g.honjam?.score;
      for (const to of tokens) {
        messages.push({
          to,
          title: `오늘 ${me.name} 경기 ⚾`,
          body: `vs ${opp.name}${score != null ? ` · 꿀잼지수 ${score}점` : ''} — 볼 각 준비됐나요?`,
          sound: 'default',
        });
      }
    }
    if (messages.length === 0) { console.log(`[push] 대상 토큰 없음: ${g.gameId}`); continue; }
    await sendExpo(messages);
    console.log(`[push] 발송: ${g.gameId} → ${messages.length}건`);
  }
})().catch((e) => { console.error('[push] 예외:', e); process.exit(0); });   // 실패해도 파이프라인 안 깨게
