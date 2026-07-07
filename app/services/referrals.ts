// 추천코드 v1 데이터 레이어. 정책: docs 없음(Discord 논의 2026-07-07) — 0010_referral_codes.sql 참고.
// 코드 발급=보호된 계정만(서버 트리거가 자동 생성), 입력=누구나 평생 1회, 보상은 RPC만.
import { supabase } from './supabase';

// get_or_create_referral_code RPC(0013) — 보호 계정이 코드를 읽을 때 없으면 즉시 생성해 반환.
// 트리거 발화 타이밍에 의존하지 않아 "발급 중..." 멈춤을 근본 차단. 익명 계정은 null.
export async function fetchMyReferralCode(): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_or_create_referral_code');
  if (error) throw error;
  return (data as string | null) ?? null;
}

// 정의 함수(has_redeemed_referral)로 조회 — referral_redemptions 직접 select는 잠겨 있음(referrer UUID 비노출, 0011).
export async function fetchHasRedeemed(): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_redeemed_referral');
  if (error) throw error;
  return data === true;
}

export interface RedeemResult { success: boolean; reason?: string; reward?: number }
export async function rpcRedeemReferralCode(code: string): Promise<RedeemResult> {
  const { data, error } = await supabase.rpc('redeem_referral_code', { p_code: code });
  if (error) throw error;
  return data as RedeemResult;
}
