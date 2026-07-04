// 내 팀 대표색 기반 동적 테마. 앱 전체에서 colors.accent 대신 accent를 사용.
// 팀 미설정 시 기본 포레스트 그린(colors.accent) 유지.
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadTeams } from '../data/load';
import { hydrateCheerTeam } from '../data/team';
import { useAuth } from './Auth';
import { colors } from '../theme';

const CHEER_TEAM_KEY = 'dugout.cheerTeam';

interface TeamThemeCtx {
  accent: string;
  refresh: () => Promise<void>;
}

const TeamThemeContext = createContext<TeamThemeCtx>({ accent: colors.accent, refresh: () => Promise.resolve() });

export function useTeamTheme() {
  return useContext(TeamThemeContext);
}

export function TeamThemeProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const [accent, setAccent] = useState<string>(colors.accent);

  const refresh = useCallback(async () => {
    try {
      const code = await AsyncStorage.getItem(CHEER_TEAM_KEY);
      if (!code) { setAccent(colors.accent); return; }
      const teams = loadTeams().teams;
      const team = teams.find((t) => t.code === code);
      setAccent(team?.color ?? colors.accent);
    } catch {
      setAccent(colors.accent);
    }
  }, []);

  // 세션 확보 시 서버 favorite_team → 로컬 캐시 하이드레이션 후 테마 반영(재설치 복구 대응).
  useEffect(() => {
    let active = true;
    (async () => {
      if (userId) await hydrateCheerTeam();
      if (active) await refresh();
    })();
    return () => { active = false; };
  }, [userId, refresh]);

  return (
    <TeamThemeContext.Provider value={{ accent, refresh }}>
      {children}
    </TeamThemeContext.Provider>
  );
}
