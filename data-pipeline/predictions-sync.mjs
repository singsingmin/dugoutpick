// 예측 리그 서버 연동 — update-data 워크플로에서 build.mjs 뒤 실행.
// 책임 2가지: ①오늘 예측 마감(prediction_windows.lock_at=오늘 첫 경기 시작) upsert
//           ②dailyHoney가 "오늘" 방금 확정됐으면 그날 pending 예측들을 hit/miss/void 정산.
// 판정은 오직 dailyHoney-history의 오늘자 확정 결과로만 — 야구공/랭킹이 개입할 여지 없음.
// 설계: docs/prediction-league-design.md. 스키마: supabase/migrations/0006_prediction_league.sql.
// 의존성 없음(Node fetch + builtins). service_role로 Supabase REST 접근(RLS 우회).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const H = SUPA_KEY ? { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' } : null;
const rest = (p) => `${SUPA_URL}/rest/v1/${p}`;
const rpc = (fn) => `${SUPA_URL}/rest/v1/rpc/${fn}`;

// "HH:MM" + "YYYYMMDD"(KST) → UTC Date. 시간 형식이 아니면 null(취소경기 등 시간 없는 경우 대비).
export function kstStart(yyyymmdd, hhmm) {
  if (!/^\d{8}$/.test(yyyymmdd) || !/^\d{1,2}:\d{2}$/.test(hhmm || '')) return null;
  const y = +yyyymmdd.slice(0, 4), mo = +yyyymmdd.slice(4, 6), d = +yyyymmdd.slice(6, 8);
  const [h, mi] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - 9 * 3600 * 1000);
}

// 그날 게임들 중 가장 이른 시작 시각(=예측 마감). 시간 파싱 안 되는 항목은 무시.
export function earliestLockAt(date, games) {
  const times = (games || []).map((g) => kstStart(date, g.time)).filter(Boolean);
  if (times.length === 0) return null;
  return new Date(Math.min(...times.map((t) => t.getTime())));
}

// 예측 판정: 취소된 경기를 골랐으면 void, 실제 1위(또는 공동1위)와 일치하면 hit, 아니면 miss.
export function judgeSelection(selectedGameId, dhResult, gameStatusById) {
  if ((gameStatusById || {})[selectedGameId] === 'CANCELED') return 'void';
  if (selectedGameId === dhResult.actualTopGameId) return 'hit';
  if (Array.isArray(dhResult.tiedGameIds) && dhResult.tiedGameIds.includes(selectedGameId)) return 'hit';
  return 'miss';
}

// 보상/포인트(v1 예시 — 정확 수치는 docs/prediction-league-design.md §7·10에서 "구현 단계 확정" 대상).
// 연속 적중 보너스는 settle_prediction이 스트릭을 아는 시점(DB 트랜잭션 내부)에 넣는 게 맞아서
// 여기선 기본(참여+적중) 금액만 계산 — 스트릭 가중은 후속 튜닝 과제로 남김.
export function rewardFor(status) {
  if (status === 'hit') return { reward: 10, points: 11 };  // 적중 10 + 참여 1
  if (status === 'miss') return { reward: 0, points: 1 };   // 참여만
  return { reward: 0, points: 0 };                          // void: 참여 취급 안 함
}

async function upsertWindow(date, games) {
  const lockAt = earliestLockAt(date, games);
  if (!lockAt) { console.log('[predictions] 오늘 경기 없음 — 예측창 upsert 스킵'); return; }
  const isoDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  const res = await fetch(rpc('upsert_prediction_window'), {
    method: 'POST', headers: H, body: JSON.stringify({ p_date: isoDate, p_lock_at: lockAt.toISOString() }),
  });
  if (!res.ok) console.warn('[predictions] 예측창 upsert 실패:', res.status, await res.text());
  else console.log(`[predictions] 예측창 upsert: ${isoDate} lock_at=${lockAt.toISOString()}`);
}

async function settleToday(date, dhResult, games) {
  const isoDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  const pr = await fetch(rest(`predictions?date=eq.${isoDate}&status=eq.pending&select=user_id,selected_game_id`), { headers: H });
  if (!pr.ok) { console.warn('[predictions] pending 조회 실패:', pr.status); return; }
  const pending = await pr.json();
  if (!pending || pending.length === 0) { console.log(`[predictions] ${isoDate} 정산 대상 없음`); return; }

  const gameStatusById = Object.fromEntries((games || []).map((g) => [g.gameId, g.status]));
  for (const row of pending) {
    const status = judgeSelection(row.selected_game_id, dhResult, gameStatusById);
    const { reward, points } = rewardFor(status);
    const res = await fetch(rpc('settle_prediction'), {
      method: 'POST', headers: H,
      body: JSON.stringify({ p_user_id: row.user_id, p_date: isoDate, p_status: status, p_reward: reward, p_points: points }),
    });
    if (!res.ok) console.warn(`[predictions] 정산 실패(user=${row.user_id}):`, res.status, await res.text());
  }
  console.log(`[predictions] ${isoDate} 정산 완료: ${pending.length}건`);
}

async function main() {
  if (!SUPA_URL || !SUPA_KEY) { console.log('[predictions] SUPABASE env 없음 — 스킵'); return; }

  const gamesPath = path.join(__dirname, 'output', 'games.json');
  if (!fs.existsSync(gamesPath)) { console.log('[predictions] games.json 없음 — 스킵'); return; }
  const gamesData = JSON.parse(fs.readFileSync(gamesPath, 'utf8'));

  await upsertWindow(gamesData.date, gamesData.games);

  const dhPath = path.join(__dirname, 'output', 'dailyHoney-history.json');
  if (!fs.existsSync(dhPath)) { console.log('[predictions] dailyHoney-history.json 없음 — 정산 스킵'); return; }
  const dh = JSON.parse(fs.readFileSync(dhPath, 'utf8'));
  const last = (dh.results || [])[dh.results.length - 1];
  // 오늘자가 "방금" 확정된 경우만 정산(그 외엔 today의 games.json으로 취소여부 확인 불가 — 알려진 한계).
  if (!last || last.date !== gamesData.date) {
    console.log('[predictions] 오늘자 dailyHoney 미확정 — 정산 스킵');
    return;
  }
  await settleToday(gamesData.date, last, gamesData.games);
}

// 스크립트로 직접 실행될 때만 동작 — 테스트가 순수 함수만 import할 때 네트워크 부작용 방지.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error('[predictions] 예외:', e); process.exit(0); });  // 실패해도 파이프라인 안 깨게
}
