// 예측 리그 칭호·라커룸 배경 데이터 레이어 (Phase 4 Stage 6). 설계: docs/stage6-cosmetics-design.md.
// 장착은 RPC가 아니라 prediction_stats 컬럼 GRANT 직접 update(트리거가 보유 여부 검증) — 스킨과 동일 패턴.
import { supabase } from './supabase';

export interface OwnedTitle { titleId: string; acquiredVia: string; acquiredAt: string }
export interface OwnedBackground { backgroundId: string; acquiredVia: string; acquiredAt: string }

export async function fetchOwnedTitles(): Promise<OwnedTitle[]> {
  const { data, error } = await supabase
    .from('owned_titles')
    .select('title_id, acquired_via, acquired_at')
    .order('acquired_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({ titleId: r.title_id, acquiredVia: r.acquired_via, acquiredAt: r.acquired_at }));
}

export async function fetchOwnedBackgrounds(): Promise<OwnedBackground[]> {
  const { data, error } = await supabase
    .from('owned_backgrounds')
    .select('background_id, acquired_via, acquired_at')
    .order('acquired_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({ backgroundId: r.background_id, acquiredVia: r.acquired_via, acquiredAt: r.acquired_at }));
}

// equip_title/equip_background RPC 경유(0012) — prediction_stats 행을 서버가 먼저 보장하므로
// 리그 미참여(행 없음) 유저도 장착이 확실히 저장됨. null이면 해제(기본으로).
export async function equipTitle(titleId: string | null): Promise<void> {
  const { error } = await supabase.rpc('equip_title', { p_title_id: titleId });
  if (error) throw error;
}

export async function equipBackground(backgroundId: string | null): Promise<void> {
  const { error } = await supabase.rpc('equip_background', { p_background_id: backgroundId });
  if (error) throw error;
}

export interface PurchaseBackgroundResult { success: boolean; reason?: string; balance?: number }
export async function rpcPurchaseBackground(backgroundId: string): Promise<PurchaseBackgroundResult> {
  const { data, error } = await supabase.rpc('purchase_background', { p_background_id: backgroundId });
  if (error) throw error;
  return data as PurchaseBackgroundResult;
}

export type AwardType = 'champion' | 'top10' | 'detective' | 'legend';
export interface AwardHistoryRow {
  periodType: 'monthly' | 'season';
  periodLabel: string;
  awardType: AwardType;
  rank: number;
  grantedTitleId: string | null;
  grantedBackgroundId: string | null;
  displayName: string;   // 뷰가 이미 탈퇴자를 "탈퇴한 사용자"로 치환 완료
  isUserDeleted: boolean;
  awardedAt: string;
}

// award_history_public 뷰만 조회 — user_id 컬럼 자체가 없음(docs/stage6-cosmetics-design.md §3-4).
export async function fetchAwardHistory(periodType: 'monthly' | 'season', limit = 100): Promise<AwardHistoryRow[]> {
  const { data, error } = await supabase
    .from('award_history_public')
    .select('period_type, period_label, award_type, rank, granted_title_id, granted_background_id, display_name, is_user_deleted, awarded_at')
    .eq('period_type', periodType)
    .order('awarded_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    periodType: r.period_type,
    periodLabel: r.period_label,
    awardType: r.award_type,
    rank: r.rank,
    grantedTitleId: r.granted_title_id,
    grantedBackgroundId: r.granted_background_id,
    displayName: r.display_name,
    isUserDeleted: r.is_user_deleted,
    awardedAt: r.awarded_at,
  }));
}
