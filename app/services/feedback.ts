import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export interface FeedbackTag {
  slug: string;
  label: string;
  thumbs: 'up' | 'down';
}

export interface FeedbackEntry {
  gameId: string;
  predictedScore: number;
  thumbs: 'up' | 'down';
  reasonTag: string | null;
  reasonLabel: string | null;
  ts: string;
  factors?: Record<string, number>;
}

export const TAGS_DOWN: FeedbackTag[] = [
  { slug: 'score_gap',      label: '점수 격차 너무 컸음',  thumbs: 'down' },
  { slug: 'starter_change', label: '선발 교체됨',          thumbs: 'down' },
  { slug: 'low_tension',    label: '생각보다 루즈했음',    thumbs: 'down' },
  { slug: 'other_down',     label: '기타',                 thumbs: 'down' },
];

export const TAGS_UP: FeedbackTag[] = [
  { slug: 'dramatic_end',   label: '끝내기·역전 명경기',   thumbs: 'up' },
  { slug: 'ace_dominant',   label: '선발 투수 압도적',     thumbs: 'up' },
  { slug: 'close_game',     label: '박빙 접전',            thumbs: 'up' },
  { slug: 'other_up',       label: '기타',                 thumbs: 'up' },
];

const FEEDBACK_KEY = (gameId: string) => `dugout.feedback.${gameId}`;

// 서버(feedback 테이블) INSERT + 로컬 마커(오프라인 hasFeedback·중복 제출 방지).
// 민감 쓰기라 제출은 온라인에서만(위젯이 useOnline으로 게이팅). 리뷰는 Supabase 대시보드/쿼리.
export async function saveFeedback(entry: FeedbackEntry): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    if (uid) {
      const { error } = await supabase.from('feedback').insert({
        user_id: uid,
        game_id: entry.gameId,
        thumbs: entry.thumbs,
        reason_tag: entry.reasonTag,
        reason_label: entry.reasonLabel,
        predicted_score: entry.predictedScore,
        factors: entry.factors ?? null,
      });
      if (error && error.code !== '23505') console.warn('[feedback] 서버 저장 실패:', error.message);
    }
  } catch (e) {
    console.warn('[feedback] 서버 저장 예외:', e);
  }
  // 로컬 마커(제출 완료 표시 — 오프라인에서도 hasFeedback 동작)
  try {
    await AsyncStorage.setItem(FEEDBACK_KEY(entry.gameId), JSON.stringify([entry]));
  } catch {
    /* 로컬 저장 실패 무시 */
  }
}

export async function hasFeedback(gameId: string): Promise<boolean> {
  const raw = await AsyncStorage.getItem(FEEDBACK_KEY(gameId));
  if (!raw) return false;
  const entries: FeedbackEntry[] = JSON.parse(raw);
  return entries.length > 0;
}
