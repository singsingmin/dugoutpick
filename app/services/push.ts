// 서버 푸시 토큰 등록 (Phase 3 / 서버 푸시 V1).
// 앱이 Expo 푸시 토큰을 발급받아 서버(push_tokens, 0004)에 등록 → GitHub Actions 발송기가
// 경기 시작 전 조회해 발송. 로컬 스케줄링(앱 열어야 예약됨 한계)을 대체.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';
import { getNotifyEnabled, hasPermission, cancelLocalSchedules } from '../utils/notifications';

const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;

// Expo 푸시 토큰 발급 → 서버 등록(enabled=true). 웹/권한없음/미설정/오류는 false.
export async function registerPushToken(): Promise<boolean> {
  if (Platform.OS === 'web' || !projectId) return false;
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return false;
    const { error } = await supabase.rpc('upsert_push_token', {
      p_token: token, p_platform: Platform.OS, p_enabled: true,
    });
    if (error) { console.warn('[push] 토큰 등록 실패:', error.message); return false; }
    return true;
  } catch (e) {
    console.warn('[push] 토큰 발급/등록 예외:', e);
    return false;
  }
}

// 서버에 알림 끄기(내 모든 기기 토큰 비활성).
export async function disablePush(): Promise<void> {
  try { await supabase.rpc('set_push_enabled', { p_enabled: false }); } catch {}
}

// 앱 시작 시: 옛 로컬 예약 정리(서버 푸시로 전환) + 알림 켜져있으면 토큰 갱신(best-effort).
export async function syncPushOnLaunch(): Promise<void> {
  await cancelLocalSchedules();
  try {
    if ((await getNotifyEnabled()) && (await hasPermission())) {
      await registerPushToken();
    }
  } catch { /* 세션 미확립 등 — 토큰은 토글 시 이미 등록됨 */ }
}
