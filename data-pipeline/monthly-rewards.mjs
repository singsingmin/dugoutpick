// 예측 리그 월간 정산 — 매달 1일 03:00 KST에 실행, 지난달 순위 보상(칭호+라커룸 배경) 지급.
// 실제 계산/지급은 전부 grant_monthly_rewards RPC(DB, 단일 트랜잭션) — 여기선 "오늘이 1일인가"만 게이팅.
// MONTH(YYYYMM)를 주면 1일 게이트를 우회해 그 달을 재정산(P1-2 복구 경로 — 1일 실행 누락 시 수동 재실행).
//   RPC는 멱등(award_history_unique_award + on conflict)이라 재실행해도 중복 지급 없음.
// 시즌 정산(grant_season_rewards)은 시즌 종료일이 매년 달라 자동화하지 않음 — 수동 workflow_dispatch로 트리거.
import { fileURLToPath } from 'url';
import path from 'path';

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MONTH = (process.env.MONTH || '').trim();   // 선택: "YYYYMM" 재정산 대상 월(주면 1일 게이트 우회)

// KST 오늘이 매달 1일인가.
export function isFirstOfMonthKst(nowMs = Date.now()) {
  const k = new Date(nowMs + 9 * 3600 * 1000);
  return k.getUTCDate() === 1;
}

// KST "오늘"(1일) 기준 방금 끝난 달을 "YYYYMM"으로.
export function lastMonthYYYYMM(nowMs = Date.now()) {
  const k = new Date(nowMs + 9 * 3600 * 1000);
  const prev = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth() - 1, 1));
  return `${prev.getUTCFullYear()}${String(prev.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function main() {
  if (!SUPA_URL || !SUPA_KEY) { console.log('[monthly-rewards] SUPABASE env 없음 — 스킵'); return; }
  if (MONTH && !/^\d{6}$/.test(MONTH)) { console.warn('[monthly-rewards] MONTH 형식 오류(YYYYMM 필요):', MONTH); return; }
  if (!MONTH && !isFirstOfMonthKst()) { console.log('[monthly-rewards] 오늘은 매달 1일(KST)이 아님 — 스킵(재정산은 MONTH 지정)'); return; }

  const month = MONTH || lastMonthYYYYMM();
  if (MONTH) console.log(`[monthly-rewards] 수동 재정산 모드: ${month}`);
  const res = await fetch(`${SUPA_URL}/rest/v1/rpc/grant_monthly_rewards`, {
    method: 'POST',
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_month: month }),
  });
  if (!res.ok) { console.warn('[monthly-rewards] 실패:', res.status, await res.text()); return; }
  console.log(`[monthly-rewards] ${month} 정산 완료:`, JSON.stringify(await res.json()));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error('[monthly-rewards] 예외:', e); process.exit(0); });
}
