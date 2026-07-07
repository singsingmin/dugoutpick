// 예측 리그 시즌 정산 — 수동 트리거 전용(workflow_dispatch). 시즌 종료일이 매년 달라 자동 감지 안 함.
// 실제 계산/지급은 grant_season_rewards RPC(DB, 단일 트랜잭션) — 여기선 파라미터 전달만.
const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const START = process.env.SEASON_START;   // YYYY-MM-DD
const END = process.env.SEASON_END;       // YYYY-MM-DD
const LABEL = process.env.SEASON_LABEL;   // 예: "2026"
const DRY_RUN = process.env.SEASON_DRY_RUN === '1';  // 1이면 수상자 카운트만 계산, 지급 안 함(P2-5)

async function main() {
  if (!SUPA_URL || !SUPA_KEY) { console.log('[season-rewards] SUPABASE env 없음 — 스킵'); return; }
  if (!START || !END || !LABEL) { console.log('[season-rewards] SEASON_START/SEASON_END/SEASON_LABEL 입력 필요'); return; }

  const res = await fetch(`${SUPA_URL}/rest/v1/rpc/grant_season_rewards`, {
    method: 'POST',
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_start: START, p_end: END, p_label: LABEL, p_dry_run: DRY_RUN }),
  });
  if (!res.ok) { console.warn('[season-rewards] 실패:', res.status, await res.text()); return; }
  const tag = DRY_RUN ? '[DRY-RUN 미지급]' : '정산 완료';
  console.log(`[season-rewards] ${LABEL}(${START}~${END}) ${tag}:`, JSON.stringify(await res.json()));
}

main().catch((e) => { console.error('[season-rewards] 예외:', e); process.exit(1); });
