import type { UniformPresetId } from './uniformResolver';

export type ScoreSkinKind = 'jersey' | 'scoreboard';

// 스킨 선택 화면 카테고리 탭. uniform=유니폼, stadium=야구장, special=스페셜.
export type ScoreSkinCategory = 'uniform' | 'stadium' | 'special';

export type ScoreSkinId =
  | 'jersey.classic'
  | 'jersey.pinstripe'
  | 'jersey.cream'
  | 'jersey.classicSplit'
  | 'jersey.creamSplit'
  | 'scoreboard.vintage';

export interface ScoreSkinConfig {
  id: ScoreSkinId;
  kind: ScoreSkinKind;
  category: ScoreSkinCategory;
  label: string;
  description: string;
  badgeLabel: string;
  uniformPreset?: UniformPresetId;
}

export const SCORE_SKINS: Record<ScoreSkinId, ScoreSkinConfig> = {
  'jersey.classic': {
    id: 'jersey.classic', kind: 'jersey', category: 'uniform',
    label: '클래식', description: '정석형 기본 스타일', badgeLabel: '기본',
    uniformPreset: 'classic',
  },
  'jersey.pinstripe': {
    id: 'jersey.pinstripe', kind: 'jersey', category: 'uniform',
    label: '핀스트라이프', description: '야구 감성 강조', badgeLabel: '추천',
    uniformPreset: 'pinstripe',
  },
  'jersey.cream': {
    id: 'jersey.cream', kind: 'jersey', category: 'uniform',
    label: '크림', description: '부드럽고 고급스러운 느낌', badgeLabel: '프리미엄',
    uniformPreset: 'cream',
  },
  'jersey.classicSplit': {
    id: 'jersey.classicSplit', kind: 'jersey', category: 'uniform',
    label: '클래식 스플릿', description: '몸통·소매 톤 분리', badgeLabel: '신규',
    uniformPreset: 'classicSplit',
  },
  'jersey.creamSplit': {
    id: 'jersey.creamSplit', kind: 'jersey', category: 'uniform',
    label: '크림 스플릿', description: '크림 몸통·팀색 소매', badgeLabel: '신규',
    uniformPreset: 'creamSplit',
  },
  'scoreboard.vintage': {
    id: 'scoreboard.vintage', kind: 'scoreboard', category: 'stadium',
    label: '전광판', description: '야구장 레트로 점수판', badgeLabel: '신규',
  },
};

export const SCORE_SKIN_LIST = Object.values(SCORE_SKINS) as ScoreSkinConfig[];

const VALID_IDS = new Set<string>(Object.keys(SCORE_SKINS));
const LEGACY_MAP: Record<string, ScoreSkinId> = {
  classic: 'jersey.classic',
  pinstripe: 'jersey.pinstripe',
  cream: 'jersey.cream',
};

export function normalizeScoreSkinId(v: string | null | undefined): ScoreSkinId {
  if (!v) return 'jersey.classic';
  if (VALID_IDS.has(v)) return v as ScoreSkinId;
  return LEGACY_MAP[v] ?? 'jersey.classic';
}
