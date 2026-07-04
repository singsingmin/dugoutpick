// 알림 권한·표시 유틸. 발송은 서버 푸시(services/push.ts + GitHub Actions 발송기)로 전환됨.
// (구 로컬 스케줄링 = "앱 열어야 예약됨" 한계 → 서버 푸시로 대체. cancelLocalSchedules로 잔재 정리.)
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const ENABLED_KEY = 'user.notifyGameStart';

// 포그라운드에서도 배너/목록 표시(수신 푸시 포함). 웹은 미지원이라 제외.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function getNotifyEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(ENABLED_KEY)) === '1';
}
export async function setNotifyEnabled(v: boolean): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, v ? '1' : '0');
}

export async function hasPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch { return false; }
}

// 권한 요청 → 허용 여부. 이미 허용이면 바로 true.
export async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (await hasPermission()) return true;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch { return false; }
}

// 옛 로컬 예약 취소(서버 푸시 전환 후 잔재 정리·중복 방지).
export async function cancelLocalSchedules(): Promise<void> {
  try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch {}
}

// 알림 끄기(로컬 pref off + 로컬 예약 취소). 서버 토큰 비활성은 push.disablePush().
export async function disableAndCancel(): Promise<void> {
  await setNotifyEnabled(false);
  await cancelLocalSchedules();
}
