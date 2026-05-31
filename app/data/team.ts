// 응원팀 영속화 (AsyncStorage, ADR-011). 저장 값은 팀 code (예: 'HT','LG').
import AsyncStorage from '@react-native-async-storage/async-storage';

const CHEER_TEAM_KEY = 'dugout.cheerTeam';

export async function getCheerTeam(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CHEER_TEAM_KEY);
  } catch {
    return null;
  }
}

export async function setCheerTeam(code: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CHEER_TEAM_KEY, code);
  } catch {
    /* 저장 실패해도 앱은 계속 동작 */
  }
}
