// 추천코드 v1 데이터 레이어. 정책: docs 없음(Discord 논의 2026-07-07) — 0010_referral_codes.sql 참고.
// 코드 발급=보호된 계정만(서버 트리거가 자동 생성), 입력=누구나 평생 1회, 보상은 RPC만.
import { supabase } from './supabase';

export async function fetchMyReferralCode(): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('referral_code').maybeSingle();
  if (error) throw error;
  return data?.referral_code ?? null;
}

export async function fetchHasRedeemed(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('referral_redemptions')
    .select('id')
    .eq('referee_user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export interface RedeemResult { success: boolean; reason?: string; reward?: number }
export async function rpcRedeemReferralCode(code: string): Promise<RedeemResult> {
  const { data, error } = await supabase.rpc('redeem_referral_code', { p_code: code });
  if (error) throw error;
  return data as RedeemResult;
}
