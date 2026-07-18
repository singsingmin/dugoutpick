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

// 포스트시즌(가을야구) 시리즈 컨텍스트. 파이프라인이 PO 기간에만 채움(그 외 undefined/null).
// 설계: docs/postseason-plan.md. 산출 로직: data-pipeline/postseason.mjs.
export type PostseasonRound = 'WC' | '준PO' | 'PO' | 'KS';
// 오늘 경기의 시리즈 컨텍스트(시리즈 현황 카드용).
export interface PostseasonSeriesContext {
  round: PostseasonRound;
  roundName: string;                    // "한국시리즈"
  gameNo: number;                       // 차전
  seriesFormat: number;                 // 최대 경기수(WC 2 / 준PO·PO 5 / KS 7)
  high: string;                         // 상위 시드 팀코드
  low: string;                          // 하위 시드 팀코드
  seriesScore: Record<string, number>;  // 팀코드 → 승수(오늘 경기 '전'까지)
  matchpoint: Record<string, boolean>;  // 오늘 이기면 진출/우승
  elimination: Record<string, boolean>; // 오늘 지면 탈락
  isFinalGame: boolean;                 // 최종차전
  wcAdvantage: boolean;                 // WC 4위 1승 어드밴티지
  contextLine: string;                  // 카드 맥락 한 줄(파이프라인 precompute)
}

// 브래킷(스텝래더) 한 라운드 상태.
export interface BracketRound {
  round: PostseasonRound;
  roundName: string;
  high: string | null;                  // 상위 시드(확정), 미정이면 null
  low: string | null;                   // 하위 진출자(이전 라운드 승자), 미정이면 null
  score: Record<string, number>;        // 팀코드 → 승수
  status: 'upcoming' | 'active' | 'done';
  winner: string | null;
}

// PO 기간 전체 상태. active면 그 기간, today는 오늘 경기 시리즈(없으면 null), bracket은 전체 대진.
export interface PostseasonState {
  active: boolean;
  today: PostseasonSeriesContext | null;
  bracket: BracketRound[];
}

export interface GamesData {
  date: string;                       // YYYYMMDD
  dateText: string;                   // "2026년 5월 31일"
  updatedAt: string;                  // ISO
  recommendedGameId: string | null;   // 최고 꿀잼지수 경기
  games: Game[];
  trackRecord?: TrackRecord;          // 없으면 '집계 중' 처리
  postseason?: PostseasonState | null; // PO 기간에만 존재(append-only, 과거/정규시즌엔 없음)
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
  // 팀코드 → "N승"/"N패"/"N무". 그래프와 동일한 일정 소스에서 계산한 현재 연속(순위표 페이지 '연속'과
  // 시점 어긋남 방지). optional: 구버전 recent.json 캐시/번들엔 없을 수 있어 앱은 standings.streak로 폴백.
  recentStreak?: Record<string, string>;
}

// Phase 3-Pre 판정: 그날 실제 꿀잼 1위 경기(예측 리그 정답 데이터, '어제의 명경기' 카드용)
export interface DailyHoneyTeamSnapshot { code: string; name: string; score: number | null }
export interface DailyHoneyResult {
  date: string;
  actualTopGameId: string | null;
  tiedGameIds?: string[];
  recapScore: number;
  decidingReasonTags: string[];
  // 화면 표시 분기(0009 이후 신규 — append-only freeze라 과거 기록엔 없음, 앱에서 방어적으로 유도).
  displayMode?: 'highlight' | 'summary';
  displayTitle?: string;
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
