// 칭호 표시명 매핑 — Stage 6(docs/stage6-cosmetics-design.md §3-3).
// 칭호는 구매하지 않으므로 서버 카탈로그 테이블이 없음 — 여기가 유일한 표시명 소스.
// 고정 업적 칭호는 title_id로 직접 매핑, 월간/시즌 칭호는 title_id 명명 규칙(§3-6)을 정규식으로 파싱.
// 칭호 등급 — UI 강조·수집 가치용(예측 결과·랭킹에는 영향 없음). titleConfig가 표시 SoT(P2).
export type TitleGrade = 'common' | 'rare' | 'epic' | 'legendary';
export const GRADE_META: Record<TitleGrade, { label: string; color: string }> = {
  common:    { label: '일반', color: '#7C7C7C' },
  rare:      { label: '희귀', color: '#3B82C4' },
  epic:      { label: '영웅', color: '#9B59B6' },
  legendary: { label: '전설', color: '#D9A520' },
};

export interface TitleDisplay {
  label: string;
  description?: string;
  grade: TitleGrade;
}

const FIXED_TITLES: Record<string, TitleDisplay> = {
  'title.rookie_watcher':   { label: '신입 관전러', description: '예측 리그 첫 참여', grade: 'common' },
  'title.first_prediction': { label: '첫 예측 완료', description: '예측 리그 첫 예측 제출', grade: 'common' },
  'title.first_hit':        { label: '첫 적중 완료', description: '예측 첫 적중', grade: 'common' },
  'title.streak3':          { label: '3연속 적중러', description: '3연속 적중 달성', grade: 'common' },
  'title.streak5':          { label: '5연속 적중러', description: '5연속 적중 달성', grade: 'rare' },
  'title.honey_detective':  { label: '꿀잼 탐정', description: '누적 적중 10회 달성', grade: 'rare' },
  'title.veteran30':        { label: '야구각 감별사', description: '누적 유효 참여 30회 달성', grade: 'rare' },
};

const AWARD_LABEL: Record<string, string> = {
  champion: '예측왕', top10: 'TOP10', detective: '감별왕', legend: '꿀잼 레전드',
};

// 명예의 전당 등에서 award_type 자체를 한글로 표시할 때 사용.
export function awardTypeLabel(awardType: string): string {
  return AWARD_LABEL[awardType] ?? awardType;
}

export function formatPeriod(kind: 'monthly' | 'season', raw: string): string {
  if (kind === 'monthly' && /^\d{6}$/.test(raw)) return `${raw.slice(0, 4)}.${raw.slice(4, 6)}`;
  return kind === 'season' ? `${raw} 시즌` : raw;
}

// title.monthly_champion.202608 / title.season_legend.2026 형태 파싱
const DYNAMIC_RE = /^title\.(monthly|season)_(champion|top10|detective|legend)\.(.+)$/;

// 동적 명예 칭호 등급 — 시즌 우승/레전드=전설, 시즌 기타·월간 우승=영웅, 월간 기타=희귀.
function dynamicGrade(kind: 'monthly' | 'season', type: string): TitleGrade {
  if (kind === 'season') return type === 'champion' || type === 'legend' ? 'legendary' : 'epic';
  return type === 'champion' ? 'epic' : 'rare';
}

export function titleDisplay(titleId: string): TitleDisplay {
  const fixed = FIXED_TITLES[titleId];
  if (fixed) return fixed;
  const m = titleId.match(DYNAMIC_RE);
  if (m) {
    const [, kind, type, period] = m as [string, 'monthly' | 'season', string, string];
    const label = `${formatPeriod(kind, period)} ${AWARD_LABEL[type] ?? type}`;
    return { label, grade: dynamicGrade(kind, type) };
  }
  return { label: titleId, grade: 'common' };
}
