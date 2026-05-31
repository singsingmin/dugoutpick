// 데이터 타입 — docs/data-schema.md를 TS로 명문화. 단일 출처(앱 전역에서 import).
// 파이프라인 산출 JSON(games/standings/teams)의 형태와 1:1 대응.

export interface Team {
  code: string;       // KBO 내부코드 (HT, LG, OB ...)
  name: string;       // 짧은 표기 (KIA, LG ...)
  fullName: string;   // 정식명 (KIA 타이거즈 ...)
  color: string;      // 대표색상 hex
}

export interface Starter {
  name: string;
  era: number | null; // 미규정/미상시 null → UI '미정'
  w: number | null;   // 승 (규정 미달시 null)
  l: number | null;   // 패
}

export interface TeamSide {
  code: string;
  name: string;
  rank: number | null;
  score: number | null;       // FINAL일 때만 숫자
  starter: Starter | null;    // 선발 미등록시 null
}

export type GameStatus = 'SCHEDULED' | 'FINAL' | 'CANCELED';

export interface Honjam {
  score: number;                    // 0~100 (보정 후 표시값)
  reason: string;                   // 한 줄 예측(카드용)
  points: string[];                 // 관전포인트 최대 3개(상세용)
  factors: Record<string, number>;  // 0~1 원시 기여값(디버그/튜닝)
}

export interface Game {
  gameId: string;
  time: string;       // "14:00"
  stadium: string;
  status: GameStatus;
  broadcast: string;
  away: TeamSide;
  home: TeamSide;
  honjam: Honjam | null;  // 순위 매칭 실패시 null
}

export interface GamesData {
  date: string;                       // YYYYMMDD
  dateText: string;                   // "2026년 5월 31일"
  updatedAt: string;                  // ISO
  recommendedGameId: string | null;   // 최고 꿀잼지수 경기
  games: Game[];
}

export interface Standing {
  rank: number;
  code: string | null;
  name: string;
  games: number;
  win: number;
  loss: number;
  draw: number;
  winRate: number;
  gamesBehind: number;
  last10: string;   // "7승0무3패"
  streak: string;   // "2승" | "11패"
  home: string;     // "18-0-10" (승-무-패)
  away: string;
}

export interface StandingsData {
  updatedAt: string;
  standings: Standing[];
}

export interface TeamsData {
  teams: Team[];
}
