// 예측 리그 데이터 레이어 (Phase 4 Stage 3). 설계: docs/prediction-league-design.md.
// 제출은 RPC(서버가 마감·중복 검증), 조회는 자기 행만(RLS). 정산은 파이프라인이 별도로 함.
import { supabase } from './supabase';

export type PredictionStatus = 'pending' | 'hit' | 'miss' | 'void';

export interface TodayPrediction {
  selectedGameId: string;
  status: PredictionStatus;
  rewardBaseballs: number;
  rankingPoints: number;
}

export interface PredictionStats {
  nickname: string | null;
  totalPredictions: number;
  totalHits: number;
  currentStreak: number;
  bestStreak: number;
  equippedTitle: string | null;
  equippedBackground: string | null;
}

// dateIso: "YYYY-MM-DD"(KST). 오늘 예측이 없으면 null(첫 참여 또는 아직 미제출).
export async function fetchTodayPrediction(dateIso: string): Promise<TodayPrediction | null> {
  const { data, error } = await supabase
    .from('predictions')
    .select('selected_game_id, status, reward_baseballs, ranking_points')
    .eq('date', dateIso)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    selectedGameId: data.selected_game_id,
    status: data.status,
    rewardBaseballs: data.reward_baseballs,
    rankingPoints: data.ranking_points,
  };
}

// 리그 미참여(row 없음) → null.
export async function fetchPredictionStats(): Promise<PredictionStats | null> {
  const { data, error } = await supabase
    .from('prediction_stats')
    .select('nickname, total_predictions, total_hits, current_streak, best_streak, equipped_title, equipped_background')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    nickname: data.nickname,
    totalPredictions: data.total_predictions,
    totalHits: data.total_hits,
    currentStreak: data.current_streak,
    bestStreak: data.best_streak,
    equippedTitle: data.equipped_title,
    equippedBackground: data.equipped_background,
  };
}

export interface SubmitResult { success: boolean; reason?: string; gameId?: string; }
export async function rpcSubmitPrediction(gameId: string): Promise<SubmitResult> {
  const { data, error } = await supabase.rpc('submit_prediction', { p_game_id: gameId });
  if (error) throw error;
  return data as SubmitResult;
}

export interface NicknameResult { success: boolean; reason?: string; nickname?: string; }
export async function rpcSetNickname(nickname: string): Promise<NicknameResult> {
  const { data, error } = await supabase.rpc('set_nickname', { p_nickname: nickname });
  if (error) throw error;
  return data as NicknameResult;
}

// user_id는 서버가 절대 반환하지 않음(docs/stage6-cosmetics-design.md §4-3) — is_me만 내려받아 내 행 강조.
export interface LeaderboardRow { nickname: string; hits: number; participations: number; isMe: boolean }
export interface PointsLeaderboardRow extends LeaderboardRow { monthlyPoints: number }
export interface HitRateLeaderboardRow extends LeaderboardRow { hitRate: number }

// 월간 포인트 랭킹(메인). p_month 없으면 이번 달(서버 KST 기준).
export async function fetchMonthlyLeaderboard(limit = 50): Promise<PointsLeaderboardRow[]> {
  const { data, error } = await supabase.rpc('get_monthly_leaderboard', { p_limit: limit });
  if (error) throw error;
  return ((data ?? []) as { nickname: string; monthly_points: number; hits: number; participations: number; is_me: boolean }[])
    .map((r) => ({ nickname: r.nickname, monthlyPoints: r.monthly_points, hits: r.hits, participations: r.participations, isMe: r.is_me }));
}

// 월간 적중률 랭킹(보조, 최소 참여 조건은 서버 기본값 적용).
export async function fetchMonthlyHitrateLeaderboard(limit = 50): Promise<HitRateLeaderboardRow[]> {
  const { data, error } = await supabase.rpc('get_monthly_hitrate_leaderboard', { p_limit: limit });
  if (error) throw error;
  return ((data ?? []) as { nickname: string; hit_rate: number; hits: number; participations: number; is_me: boolean }[])
    .map((r) => ({ nickname: r.nickname, hitRate: r.hit_rate, hits: r.hits, participations: r.participations, isMe: r.is_me }));
}
