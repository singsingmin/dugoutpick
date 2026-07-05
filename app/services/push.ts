// 서버 푸시 토큰 등록 (Phase 3 / 서버 푸시 V1).
// 앱이 Expo 푸시 토큰을 발급받아 서버(push_tokens, 0004)에 등록 → GitHub Actions 발송기가
// 경기 시작 전 조회해 발송. 로컬 스케줄링(앱 열어야 예약됨 한계)을 대체.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';
import { getNotifyEnabled, hasPermission, cancelLocalSchedules } from '../utils/notifications';

const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;

// Expo 푸시 토큰 발급 → 서버 등록(enabled=true). 실패 사유를 함께 반환해 UI가 표면화할 수 있게 함
// (예전엔 boolean만 반환하고 호출부가 버려서, 등록 실패해도 "알림 ON"으로 보이던 조용한 실패 존재).
export async function registerPushToken(): Promise<{ ok: boolean; error?: string }> {
  if (Platform.OS === 'web') return { ok: false, error: '웹은 푸시 미지원' };
  if (!projectId) return { ok: false, error: 'projectId 미설정' };
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return { ok: false, error: '토큰 발급 실패(빈 값)' };
    const { error } = await supabase.rpc('upsert_push_token', {
      p_token: token, p_platform: Platform.OS, p_enabled: true,
    });
    if (error) { console.warn('[push] 토큰 등록 실패:', error.message); return { ok: false, error: `서버 등록 실패: ${error.message}` }; }
    return { ok: true };
  } catch (e) {
    // 안드로이드에서 FCM 자격증명 미설정 시 여기서 throw되는 경우가 많음.
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[push] 토큰 발급/등록 예외:', msg);
    return { ok: false, error: `토큰 발급 예외: ${msg}` };
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
