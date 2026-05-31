// 타입 안전 데이터 로더. REMOTE_BASE_URL이 null이면 번들 JSON, 값이 있으면 fetch+캐시.
// 원격 실패 시 캐시 → 번들 순으로 폴백 (오프라인 생존, ADR-002).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { REMOTE_BASE_URL } from './config';
import type { GamesData, StandingsData, TeamsData, RecentData, ReportData } from '../types';
import gamesJson from '../assets/data/games.json';
import standingsJson from '../assets/data/standings.json';
import teamsJson from '../assets/data/teams.json';
import recentJson from '../assets/data/recent.json';
import reportJson from '../assets/data/report.json';

// JSON import는 넓은 타입으로 추론되므로 unknown 경유로 단언.
const bundledGames = gamesJson as unknown as GamesData;
const bundledStandings = standingsJson as unknown as StandingsData;
const bundledTeams = teamsJson as unknown as TeamsData;
const bundledRecent = recentJson as unknown as RecentData;
const bundledReport = reportJson as unknown as ReportData;

async function loadJson<T>(fileName: string, cacheKey: string, fallback: T): Promise<T> {
  if (!REMOTE_BASE_URL) return fallback;
  try {
    const res = await fetch(`${REMOTE_BASE_URL}/${fileName}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as T;
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
    } catch {
      /* 캐시 실패는 치명적이지 않음 */
    }
    return data;
  } catch {
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached) as T;
    } catch {
      /* 무시하고 번들 폴백 */
    }
    return fallback;
  }
}

export function loadGames(): Promise<GamesData> {
  return loadJson<GamesData>('games.json', 'cache.games', bundledGames);
}

export function loadStandings(): Promise<StandingsData> {
  return loadJson<StandingsData>('standings.json', 'cache.standings', bundledStandings);
}

export function loadRecent(): Promise<RecentData> {
  return loadJson<RecentData>('recent.json', 'cache.recent', bundledRecent);
}

export function loadReport(): Promise<ReportData> {
  return loadJson<ReportData>('report.json', 'cache.report', bundledReport);
}

// teams는 온보딩이 fetch 전에 필요하므로 항상 번들(동기) 사용.
export function loadTeams(): TeamsData {
  return bundledTeams;
}
