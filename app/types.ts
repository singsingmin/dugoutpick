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

export type GameStatus = 'SCHEDULED' | 'LIVE' | 'FINAL' | 'CANCELED';

export interface LiveState {
  inning: number | null;   // 현재 이닝
  half: string | null;     // 'T'(초) | 'B'(말)
  out: number | null;
  b1: boolean;             // 1루 주자
  b2: boolean;             // 2루 주자
  b3: boolean;             // 3루 주자
  pitcher: string | null;  // 현재 수비팀 투수
  batter: string | null;   // 현재 공격팀 타자
  heat: number;            // '지금 볼 각' 흥미도 0~100
  label: string;           // 예: "9회말 동점 접전"
}

export interface Honjam {
  score: number;                    // 0~100 (보정 후 표시값)
  reason: string;                   // 한 줄 예측(카드용)
  points: string[];                 // 관전포인트 최대 3개(상세용)
  factors: Record<string, number>;  // 0~1 원시 기여값(디버그/튜닝)
  frozen?: boolean;                 // 파이프라인 정직성 게이트용, 앱은 무시
}

export interface Recap {
  actual: number;          // 실제 꿀잼(예측과 같은 0~100 보정 척도)
  verdict: string | null;  // 예: "예측보다 더 꿀잼! 🔥"
}

export interface Decision {
  win: string | null;   // 승리투수 (무승부면 null)
  lose: string | null;  // 패전투수 (무승부면 null)
  save: string | null;  // 세이브투수 (없으면 null)
}

export interface LineupPlayer {
  order: number;
  pos: string;
  name: string;
}

export interface Lineup {
  home: LineupPlayer[];
  away: LineupPlayer[];
  confirmed: boolean;
}

export interface Game {
  gameId: string;
  time: string;       // "14:00"
  stadium: string;
  status: GameStatus;
  cancelReason: string | null; // CANCELED일 때 사유(예: "우천취소"), 아니면 null
  broadcast: string;
  away: TeamSide;
  home: TeamSide;
  honjam: Honjam | null;  // 순위 매칭 실패시 null
  live: LiveState | null; // 경기중(LIVE)일 때만, 아니면 null
  recap: Recap | null;    // 종료(FINAL)일 때만 — 경기 후 꿀잼결산
  decision: Decision | null; // 종료(FINAL)일 때만 — 승/패/세이브 투수
  lineup: Lineup | null; // SCHEDULED/LIVE만 — null이면 미제공
}

export interface TrackRecord {
  window: number;     // 집계 윈도우(최근 N건)
  sampleSize: number; // 윈도우 내 실제 표본 수
  hitRate: number;    // 0~100, 예측 적중 비율(%)
  bonusRate: number;  // 0~100, '기대 이상' 비율(%) — hitRate와 별개
  ready: boolean;     // sampleSize >= 임계치(10)일 때만 true
  recentRecapPreview?: { pred: number; verdict: string }[]; // ready===false일 때만 파이프라인이 채움
}

export interface GamesData {
  date: string;                       // YYYYMMDD
  dateText: string;                   // "2026년 5월 31일"
  updatedAt: string;                  // ISO
  recommendedGameId: string | null;   // 최고 꿀잼지수 경기
  games: Game[];
  trackRecord?: TrackRecord;          // 없으면 '집계 중' 처리
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
  vs: Record<string, string>; // 상대팀코드 → "승-패-무"
}

export interface StandingsData {
  updatedAt: string;
  standings: Standing[];
}

export interface RecentGame {
  date: string;
  oppCode: string;
  isHome: boolean;
  sf: number;            // 득점(우리 팀)
  sa: number;            // 실점
  result: 'W' | 'L' | 'D';
}

export interface RecentData {
  updatedAt: string;
  recent: Record<string, RecentGame[]>; // 팀코드 → 최근 경기(오래된→최신)
}

// Phase 3-Pre 판정: 그날 실제 꿀잼 1위 경기(예측 리그 정답 데이터, '어제의 명경기' 카드용)
export interface DailyHoneyTeamSnapshot { code: string; name: string; score: number | null }
export interface DailyHoneyResult {
  date: string;
  actualTopGameId: string | null;
  tiedGameIds?: string[];
  recapScore: number;
  decidingReasonTags: string[];
  away?: DailyHoneyTeamSnapshot;  // 필드 추가 이전 과거 기록엔 없음(append-only freeze라 소급 안 됨)
  home?: DailyHoneyTeamSnapshot;
  calculatedAt: string;
}
export interface DailyHoneyData {
  updatedAt: string;
  results: DailyHoneyResult[];
}

// 월요 리포트
export interface ReportUpcomingGame { away: string; home: string; pred: number; reason: string; dateStart: string; dateEnd: string; }
export interface TeamWeekRecord { w: number; l: number; d: number; rank: number; note?: string; }
export interface ReportData {
  updatedAt: string;
  lastWeek: { range: [string, string]; team: Record<string, TeamWeekRecord> };
  thisWeek: { range: [string, string]; top: ReportUpcomingGame[]; team: Record<string, { date: string; away: string; home: string; awayStarter?: string | null; homeStarter?: string | null }[]> };
}

export interface TeamsData {
  teams: Team[];
}
