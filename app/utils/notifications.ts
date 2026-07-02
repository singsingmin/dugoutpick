// 로컬 알림 — 내 팀 경기 시작 N분 전 예약(서버 푸시 아님). 접전 알림은 추후.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { loadGames, loadTeams } from '../data/load';
import { getCheerTeam } from '../data/team';

const ENABLED_KEY = 'user.notifyGameStart';
const LEAD_MIN = 30;                 // 경기 시작 N분 전
const CHANNEL_ID = 'game-start';

// 포그라운드에서도 배너/목록 표시. 웹은 미지원이라 제외.
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

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: '경기 시작 알림',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
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

// KST HH:mm + date(YYYYMMDD) → 절대 시각 Date(기기 타임존 무관, KST=UTC+9로 환산).
function kstGameStart(dateYYYYMMDD: string, hhmm: string): Date | null {
  if (!/^\d{8}$/.test(dateYYYYMMDD) || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const y = +dateYYYYMMDD.slice(0, 4), mo = +dateYYYYMMDD.slice(4, 6), d = +dateYYYYMMDD.slice(6, 8);
  const [h, mi] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - 9 * 3600 * 1000);
}

// 내 팀 오늘 경기 시작 알림 재예약: 항상 기존 예약 취소 후, enabled+권한+경기 있을 때만 예약.
// 경기 일정이 없거나 이미 시작 임박 지난 경기는 예약하지 않음.
export async function rescheduleMyTeamGameStart(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!(await getNotifyEnabled()) || !(await hasPermission())) return;
    const code = await getCheerTeam();
    if (!code) return;

    const g = await loadGames();
    const teams = loadTeams().teams;
    const nameOf = (c: string) => teams.find((t) => t.code === c)?.name ?? c;
    const myGames = g.games.filter(
      (x) => (x.away.code === code || x.home.code === code) && x.status !== 'CANCELED',
    );
    if (myGames.length === 0) return;

    await ensureAndroidChannel();
    const now = Date.now();
    for (const game of myGames) {
      const start = kstGameStart(g.date, game.time);
      if (!start) continue;
      const fireAt = new Date(start.getTime() - LEAD_MIN * 60 * 1000);
      if (fireAt.getTime() <= now) continue;   // 이미 지난 시점은 예약 안 함
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `오늘 ${nameOf(code)} 경기 곧 시작해요`,
          body: `${game.time} ${nameOf(game.away.code)} vs ${nameOf(game.home.code)}, 볼 각 준비됐나요?`,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
          channelId: CHANNEL_ID,
        },
      });
    }
  } catch {
    // 알림 실패가 앱을 죽이면 안 됨(무음)
  }
}

// 알림 끄기(취소 포함)
export async function disableAndCancel(): Promise<void> {
  await setNotifyEnabled(false);
  try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch {}
}
