// 계정 데이터 레이어 (Phase 3 Stage 3) — 서버(Supabase) + 로컬 캐시 미러.
// 설계: docs/phase3-account-design.md §4·§7. 재화 이동은 RPC만, 비민감은 RLS 직접.
// ScoreSkin context가 이 모듈만 호출 → 화면/인터페이스 불변, 구현만 서버로 스왑.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import type { BaseballTx, TxReason } from '../utils/attendance';

export interface AccountState {
  balance: number;
  appliedSkinId: string;
  ownedSkinIds: string[];
  attStreak: number;
  attCount: number;
  attLastDate: string | null;   // KST YYYY-MM-DD
  favoriteTeam: string | null;
  transactions: BaseballTx[];    // 최근 100건(newest-first)
}

export interface ClaimResult { claimed: boolean; earned: number; base: number; bonus: number; streak: number; error?: boolean; }
export interface PurchaseResult { success: boolean; balance?: number; reason?: string; }

const DEFAULT_SKIN = 'jersey.classic.team';
const CACHE_KEY = 'account.cache.v1';

export const EMPTY_ACCOUNT: AccountState = {
  balance: 0, appliedSkinId: DEFAULT_SKIN, ownedSkinIds: [],
  attStreak: 0, attCount: 0, attLastDate: null, favoriteTeam: null, transactions: [],
};

// ─── 로컬 캐시 (오프라인/즉시 표시) ───────────────────────────────
export async function loadCache(): Promise<AccountState | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as AccountState) : null;
  } catch { return null; }
}
export async function saveCache(s: AccountState): Promise<void> {
  try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(s)); } catch {}
}

interface LedgerRow {
  id: string; type: 'earn' | 'spend'; amount: number;
  reason: string; label: string | null; related_skin_id: string | null; created_at: string;
}
function mapLedger(rows: LedgerRow[] | null): BaseballTx[] {
  return (rows ?? []).map((r) => ({
    id: r.id, type: r.type, amount: r.amount, reason: r.reason as TxReason,
    label: r.label ?? '', createdAt: r.created_at,
    relatedSkinId: r.related_skin_id ?? undefined,
  }));
}

// ─── 서버에서 계정 상태 조립 (profiles + owned_skins + ledger) ─────
// profile 없음(예: 트리거 前 세션) → null 반환, 호출부가 처리.
export async function fetchAccount(): Promise<AccountState | null> {
  const [profRes, ownedRes, ledgerRes] = await Promise.all([
    supabase.from('profiles').select('*').maybeSingle(),
    supabase.from('owned_skins').select('skin_id'),
    supabase.from('baseball_ledger').select('*').order('created_at', { ascending: false }).limit(100),
  ]);
  const prof = profRes.data as {
    balance: number; applied_skin_id: string; favorite_team: string | null;
    att_streak: number; att_count: number; att_last_date: string | null;
  } | null;
  if (!prof) return null;
  return {
    balance: prof.balance ?? 0,
    appliedSkinId: prof.applied_skin_id ?? DEFAULT_SKIN,
    ownedSkinIds: ((ownedRes.data as { skin_id: string }[] | null) ?? []).map((o) => o.skin_id),
    attStreak: prof.att_streak ?? 0,
    attCount: prof.att_count ?? 0,
    attLastDate: prof.att_last_date ?? null,
    favoriteTeam: prof.favorite_team ?? null,
    transactions: mapLedger(ledgerRes.data as LedgerRow[] | null),
  };
}

// ─── 재화 이동 RPC (서버 검증) ───────────────────────────────────
export async function rpcClaimAttendance(): Promise<ClaimResult> {
  const { data, error } = await supabase.rpc('claim_attendance');
  if (error) throw error;
  return data as ClaimResult;
}
export async function rpcPurchaseSkin(skinId: string): Promise<PurchaseResult> {
  const { data, error } = await supabase.rpc('purchase_skin', { p_skin_id: skinId });
  if (error) throw error;
  return data as PurchaseResult;
}

// ─── 비민감 직접 업데이트 (RLS + 컬럼 GRANT) ──────────────────────
export async function updateAppliedSkin(userId: string, skinId: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ applied_skin_id: skinId }).eq('id', userId);
  if (error) throw error;
}

// ─── 디버그 전용 RPC (debug 빌드·app_config.debug_enabled 게이팅, 0002 마이그레이션) ──
export async function rpcDebugReset(): Promise<void> {
  const { error } = await supabase.rpc('debug_reset');
  if (error) throw error;
}
export async function rpcDebugGrant(amount: number): Promise<void> {
  const { error } = await supabase.rpc('debug_grant', { p_amount: amount });
  if (error) throw error;
}
