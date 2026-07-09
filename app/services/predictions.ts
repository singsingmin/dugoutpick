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
  nicknameChangedMonth: string | null;   // 'YYYYMM'(KST). 최초 설정은 null, 실제 변경 시에만 기록 → 월 1회 제한 판정용.
  totalPredictions: number;
  totalHits: number;
  currentStreak: number;
  bestStreak: number;
  equippedTitle: string | null;
  equippedOwnedBackgroundId: number | null;   // 0014: 배경 장착은 소유 인스턴스 id 기준
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
    .select('nickname, nickname_changed_month, total_predictions, total_hits, current_streak, best_streak, equipped_title, equipped_owned_background_id')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    nickname: data.nickname,
    nicknameChangedMonth: data.nickname_changed_month ?? null,
    totalPredictions: data.total_predictions,
    totalHits: data.total_hits,
    currentStreak: data.current_streak,
    bestStreak: data.best_streak,
    equippedTitle: data.equipped_title,
    equippedOwnedBackgroundId: data.equipped_owned_background_id ?? null,
  };
}

export interface SubmitResult { success: boolean; reason?: string; gameId?: string; }
// snapshot: 제출 시점 경기 맥락(honey_score_at_pick·teams·start_time). 칭호=장식이라 클라 제공값 신뢰(P3).
export async function rpcSubmitPrediction(gameId: string, snapshot?: Record<string, unknown>): Promise<SubmitResult> {
  const { data, error } = await supabase.rpc('submit_prediction', { p_game_id: gameId, p_snapshot: snapshot ?? {} });
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
// rank는 서버 RANK()(동점=공동 순위, 보상 정산과 동일 타이브레이커) — 앱은 index가 아니라 이 값을 표시(0015).
export interface LeaderboardRow { rank: number; nickname: string; hits: number; participations: number; bestStreak: number; isMe: boolean }
export interface PointsLeaderboardRow extends LeaderboardRow { monthlyPoints: number }
export interface HitRateLeaderboardRow extends LeaderboardRow { hitRate: number }

// 월간 포인트 랭킹(메인). p_month 없으면 이번 달(서버 KST 기준).
export async function fetchMonthlyLeaderboard(limit = 50): Promise<PointsLeaderboardRow[]> {
  const { data, error } = await supabase.rpc('get_monthly_leaderboard', { p_limit: limit });
  if (error) throw error;
  return ((data ?? []) as { rank: number; nickname: string; monthly_points: number; hits: number; participations: number; best_streak: number; is_me: boolean }[])
    .map((r) => ({ rank: r.rank, nickname: r.nickname, monthlyPoints: r.monthly_points, hits: r.hits, participations: r.participations, bestStreak: r.best_streak, isMe: r.is_me }));
}

// 월간 적중률 랭킹(보조, 최소 참여 조건은 서버 기본값 적용).
export async function fetchMonthlyHitrateLeaderboard(limit = 50): Promise<HitRateLeaderboardRow[]> {
  const { data, error } = await supabase.rpc('get_monthly_hitrate_leaderboard', { p_limit: limit });
  if (error) throw error;
  return ((data ?? []) as { rank: number; nickname: string; hit_rate: number; hits: number; participations: number; best_streak: number; is_me: boolean }[])
    .map((r) => ({ rank: r.rank, nickname: r.nickname, hitRate: r.hit_rate, hits: r.hits, participations: r.participations, bestStreak: r.best_streak, isMe: r.is_me }));
}
