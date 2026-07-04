// 응원팀 영속화 (Phase 3 Stage 3-2) — 서버(profiles.favorite_team) + 로컬 캐시 미러.
// 저장 값은 팀 code (예: 'HT','LG'). 인터페이스 불변 → 읽기 화면 7곳 무변경.
// favorite_team은 비민감(RLS 직접 UPDATE) → 오프라인 낙관적 허용(로컬 즉시, 서버 best-effort).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';

const CHEER_TEAM_KEY = 'dugout.cheerTeam';

// 읽기 = 로컬 캐시(오프라인/즉시). 서버 값은 hydrateCheerTeam()이 캐시에 반영.
export async function getCheerTeam(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CHEER_TEAM_KEY);
  } catch {
    return null;
  }
}

// 쓰기 = 로컬 낙관적 + 서버 best-effort(비민감, offline last-write-wins).
export async function setCheerTeam(code: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CHEER_TEAM_KEY, code);
  } catch {
    /* 저장 실패해도 앱은 계속 동작 */
  }
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    if (uid) await supabase.from('profiles').update({ favorite_team: code }).eq('id', uid);
  } catch {
    /* 오프라인/서버 오류 — 로컬은 반영됨, 다음 쓰기에서 서버 동기화 */
  }
}

// 서버 favorite_team → 로컬 캐시 (재설치 복구·최초 하이드레이션). 서버 null이면 로컬 유지.
export async function hydrateCheerTeam(): Promise<void> {
  try {
    const { data } = await supabase.from('profiles').select('favorite_team').maybeSingle();
    const team = (data as { favorite_team: string | null } | null)?.favorite_team;
    if (team) await AsyncStorage.setItem(CHEER_TEAM_KEY, team);
  } catch {
    /* 오프라인 — 로컬 캐시로 계속 동작 */
  }
}
