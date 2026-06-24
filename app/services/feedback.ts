import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

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

export async function saveFeedback(entry: FeedbackEntry): Promise<void> {
  const key = FEEDBACK_KEY(entry.gameId);
  const raw = await AsyncStorage.getItem(key);
  const existing: FeedbackEntry[] = raw ? JSON.parse(raw) : [];
  existing.push(entry);
  await AsyncStorage.setItem(key, JSON.stringify(existing));
}

export async function sendToDiscord(entry: FeedbackEntry, matchLabel: string): Promise<void> {
  try {
    const webhookUrl: string | null = Constants.expoConfig?.extra?.discordWebhookUrl ?? null;
    if (!webhookUrl) return;

    const thumbsEmoji = entry.thumbs === 'up' ? '👍' : '👎';
    const thumbsLabel = entry.thumbs === 'up' ? '꿀잼' : '노잼';
    const date = entry.ts.slice(0, 10);

    const content = [
      `[피드백] ${date} ${matchLabel}`,
      `예측: ${entry.predictedScore}점 | 평가: ${thumbsEmoji} ${thumbsLabel}`,
      `이유: ${entry.reasonLabel ?? '(없음)'}`,
      `gameId: ${entry.gameId} | ts: ${entry.ts}`,
    ].join('\n');

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
  } catch (e) {
    console.error('[feedback] Discord 전송 실패:', e);
  }
}

export async function hasFeedback(gameId: string): Promise<boolean> {
  const raw = await AsyncStorage.getItem(FEEDBACK_KEY(gameId));
  if (!raw) return false;
  const entries: FeedbackEntry[] = JSON.parse(raw);
  return entries.length > 0;
}
