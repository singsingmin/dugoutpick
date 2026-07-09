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

// 정산 시점 실제 경기 성격 태그(경기성향형 칭호용, P3). recap이 없으면(과거 소급 등) 가능한 태그만.
//   games.json recap = { actual, verdict, diff, total, extra, walkoff } / 과거는 recap-history의 actual만.
export function computeResultTags(selectedGameId, recap, dhResult) {
  const tags = [];
  const r = recap || {};
  if (r.walkoff) tags.push('walkoff');
  if (r.extra) tags.push('extra');
  if (typeof r.diff === 'number') {
    if (r.diff <= 1) tags.push('close_1');
    else if (r.diff === 2) tags.push('close_2');
  }
  if ((r.total ?? 0) >= 14) tags.push('slugfest');
  if ((r.actual ?? 0) >= 70) tags.push('classic_game');
  const isTop = !!dhResult && (selectedGameId === dhResult.actualTopGameId
    || (Array.isArray(dhResult.tiedGameIds) && dhResult.tiedGameIds.includes(selectedGameId)));
  if (isTop) tags.push('daily_top');
  return tags;
}

// 보상/포인트(v1 예시 — 정확 수치는 docs/prediction-league-design.md §7·10에서 "구현 단계 확정" 대상).
// 연속 적중 보너스는 settle_prediction이 스트릭을 아는 시점(DB 트랜잭션 내부)에 넣는 게 맞아서
// 여기선 기본(참여+적중) 금액만 계산 — 스트릭 가중은 후속 튜닝 과제로 남김.
export function rewardFor(status) {
  if (status === 'hit') return { reward: 10, points: 11 };  // 적중 10 + 참여 1
  if (status === 'miss') return { reward: 3, points: 1 };   // 참여 보상 3(적중 어려워 매일 참여 유인) + 포인트 1
  return { reward: 0, points: 0 };                          // void: 참여 취급 안 함(보상·연속 유지)
}

// "YYYYMMDD" → "YYYY-MM-DD"(predictions.date 컬럼 형식). 이미 iso면 그대로.
export function ymdToIso(ymd) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

// 정산 계획(순수) — 과거 pending까지 소급 정산해 "영구 pending" 버그(P1-1)를 막는다.
//   ① 그날 dailyHoney 확정 있음 → judgeSelection(hit/miss/void). 취소 감지는 그날 게임상태가 있을 때만
//      (=오늘자). 과거 실패건은 상태맵이 비어 있어 취소 경기를 miss로 볼 수 있으나, 정산실패+취소선택
//      동시 발생은 극히 드문 이중결함이라 감수(보상 오지급 방향 아님).
//   ② dailyHoney 확정 없음 + 그날이 오늘 이전(과거) → void. "전 경기 취소/노게임 = 확정된 명경기 없음"을
//      소급 무효 처리(2026-07-07 결정: void, 스트릭 유지). settle_prediction의 void가 스트릭 보존.
//   ③ 오늘자 미확정 → 보류(정산 안 함). 미래 날짜 → 무시.
// 반환: [{ user_id, date(iso), status, reward, points }]
export function planSettlements(pendingRows, dhByDate, todayIso, todayGameStatus) {
  const out = [];
  for (const row of pendingRows || []) {
    const d = row.date;                                    // "YYYY-MM-DD"
    const result = dhByDate[d];
    let status;
    if (result) {
      const statusMap = d === todayIso ? (todayGameStatus || {}) : {};
      status = judgeSelection(row.selected_game_id, result, statusMap);
    } else if (d < todayIso) {                             // iso 문자열 사전순 = 날짜순
      status = 'void';
    } else {
      continue;                                            // 오늘자 미확정 또는 미래 → 보류
    }
    const { reward, points } = rewardFor(status);
    out.push({ user_id: row.user_id, date: d, status, reward, points, selected_game_id: row.selected_game_id });
  }
  return out;
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

// 과거 pending 전체를 dailyHoney-history와 대조해 소급 정산(P1-1). todayGames로 오늘자 취소만 감지.
// recapByGame: gameId→recap 조회맵(오늘 full recap + 과거 actual) — result_tags 계산용.
async function settlePending(todayYmd, dhResults, todayGames, recapByGame) {
  const todayIso = ymdToIso(todayYmd);
  const pr = await fetch(rest('predictions?status=eq.pending&select=user_id,date,selected_game_id'), { headers: H });
  if (!pr.ok) { console.warn('[predictions] pending 조회 실패:', pr.status); return; }
  const pending = await pr.json();
  if (!pending || pending.length === 0) { console.log('[predictions] 정산 대상 없음'); return; }

  const dhByDate = Object.fromEntries((dhResults || []).map((r) => [ymdToIso(r.date), r]));
  const todayGameStatus = Object.fromEntries((todayGames || []).map((g) => [g.gameId, g.status]));
  const plan = planSettlements(pending, dhByDate, todayIso, todayGameStatus);
  if (plan.length === 0) { console.log(`[predictions] 정산 보류(pending ${pending.length}건, 확정된 날짜 없음)`); return; }

  let ok = 0;
  for (const s of plan) {
    const resultTags = computeResultTags(s.selected_game_id, (recapByGame || {})[s.selected_game_id], dhByDate[s.date]);
    const res = await fetch(rpc('settle_prediction'), {
      method: 'POST', headers: H,
      body: JSON.stringify({ p_user_id: s.user_id, p_date: s.date, p_status: s.status, p_reward: s.reward, p_points: s.points, p_result_tags: resultTags }),
    });
    if (!res.ok) console.warn(`[predictions] 정산 실패(user=${s.user_id} date=${s.date}):`, res.status, await res.text());
    else ok++;
  }
  console.log(`[predictions] 정산 완료: ${ok}/${plan.length}건(pending ${pending.length}건 중)`);
}

async function main() {
  if (!SUPA_URL || !SUPA_KEY) { console.log('[predictions] SUPABASE env 없음 — 스킵'); return; }

  const gamesPath = path.join(__dirname, 'output', 'games.json');
  if (!fs.existsSync(gamesPath)) { console.log('[predictions] games.json 없음 — 스킵'); return; }
  const gamesData = JSON.parse(fs.readFileSync(gamesPath, 'utf8'));

  await upsertWindow(gamesData.date, gamesData.games);

  // dailyHoney-history 전체를 넘겨 과거 pending까지 소급 정산(파일 없어도 과거 void 정산은 진행).
  const dhPath = path.join(__dirname, 'output', 'dailyHoney-history.json');
  const dhResults = fs.existsSync(dhPath)
    ? (JSON.parse(fs.readFileSync(dhPath, 'utf8')).results || [])
    : [];

  // gameId→recap 조회맵: 오늘 games(full recap: diff/total/extra/walkoff/actual) + recap-history(과거 actual).
  const recapByGame = {};
  for (const g of gamesData.games || []) if (g.recap) recapByGame[g.gameId] = g.recap;
  const rhPath = path.join(__dirname, 'output', 'recap-history.json');
  if (fs.existsSync(rhPath)) {
    const rh = JSON.parse(fs.readFileSync(rhPath, 'utf8'));
    for (const rec of (rh.records || [])) {
      if (!recapByGame[rec.gameId]) recapByGame[rec.gameId] = { actual: rec.actual };
    }
  }

  await settlePending(gamesData.date, dhResults, gamesData.games, recapByGame);
}

// 스크립트로 직접 실행될 때만 동작 — 테스트가 순수 함수만 import할 때 네트워크 부작용 방지.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error('[predictions] 예외:', e); process.exit(0); });  // 실패해도 파이프라인 안 깨게
}
