// 통합 보상 인박스(reward_events) 데이터 레이어 — P1(docs/roadmap.md §G).
// 서버가 정산 등에서 발행한 미확인 보상 알림을 앱 진입 시 fetch → 토스트/모달 → seen 처리.
import { supabase } from './supabase';

export interface RewardEvent {
  id: number;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export async function fetchUnseenRewardEvents(): Promise<RewardEvent[]> {
  const { data, error } = await supabase
    .from('reward_events')
    .select('id, event_type, payload, created_at')
    .eq('seen', false)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    eventType: r.event_type,
    payload: (r.payload ?? {}) as Record<string, unknown>,
    createdAt: r.created_at,
  }));
}

export async function markRewardEventsSeen(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.rpc('mark_reward_events_seen', { p_ids: ids });
  if (error) throw error;
}

// 이벤트 → 표시 문구. type별로 확장(P2~: title_earned·rank_award 등).
export function rewardEventMessage(e: RewardEvent): { title: string; detail: string } {
  const p = e.payload;
  const reward = typeof p.reward === 'number' ? p.reward : 0;
  switch (e.eventType) {
    case 'monthly_milestone':
      return { title: typeof p.label === 'string' ? p.label : '월간 달성 보상', detail: `야구공 +${reward}` };
    default:
      return { title: '보상 도착', detail: reward ? `야구공 +${reward}` : '' };
  }
}
