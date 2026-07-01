// 꿀잼지수 스킨 데이터모델 — styleId × paletteId × colorMode(유니폼) / assetKey × renderType(에셋).
// 사용자는 완성형 스킨 하나를 선택(UX 동일). 내부만 확장형 구조(고정색/스킨팩/프리미엄 대비).
import type { UniformPresetId } from './uniformResolver';

export type ScoreSkinKind = 'jersey' | 'asset';
export type ScoreSkinCategory = 'uniform' | 'stadium' | 'special';

// 구현된 유니폼 스타일(= uniformResolver의 UNIFORM_PRESETS 키). 새 스타일 추가 시 양쪽 확장.
export type JerseyStyleId = UniformPresetId;
export type JerseyPaletteId =
  | 'team' | 'red' | 'orange' | 'yellow' | 'green' | 'sky'
  | 'blue' | 'navy' | 'purple' | 'pink' | 'black' | 'cream' | 'gray';
export type JerseyColorMode = 'team' | 'fixed';
export type UnlockType = 'free' | 'premium' | 'event' | 'season' | 'pack';
export type AssetRenderType = 'scoreboard' | 'imageFrame';

interface BaseSkin {
  id: string;
  label: string;
  description?: string;
  category: ScoreSkinCategory;
  unlockType: UnlockType;
  unlockGroup?: string;   // 스킨팩 관리용(예: color_uniform_pack)
  isDefault?: boolean;
  isHidden?: boolean;
  sortOrder: number;
}

export interface JerseySkin extends BaseSkin {
  kind: 'jersey';
  category: 'uniform';
  styleId: JerseyStyleId;
  paletteId: JerseyPaletteId;
  colorMode: JerseyColorMode;
}

export interface AssetSkin extends BaseSkin {
  kind: 'asset';
  category: 'stadium' | 'special';
  assetKey: string;
  renderType: AssetRenderType;
}

export type ScoreSkin = JerseySkin | AssetSkin;
export type ScoreSkinId = string; // 개방형 id(jersey.<style>.<palette> / <asset>.<key>)

// ── 팔레트 config (고정색은 지금 config만 준비, 실제 스킨 노출은 안 함) ──────────
export interface JerseyPalette {
  id: JerseyPaletteId;
  label: string;
  colorMode: JerseyColorMode;
  baseColor?: string;          // fixed일 때 사용
  resolveFromTeamColor?: boolean;
  darkNumber?: boolean;        // 밝은 바탕 → 숫자를 어두운 색으로(가독성)
}

export const JERSEY_PALETTES: Record<JerseyPaletteId, JerseyPalette> = {
  team:   { id: 'team',   label: '내 팀 컬러', colorMode: 'team', resolveFromTeamColor: true },
  red:    { id: 'red',    label: '레드',   colorMode: 'fixed', baseColor: '#C91F37' },
  orange: { id: 'orange', label: '오렌지', colorMode: 'fixed', baseColor: '#F15A24' },
  yellow: { id: 'yellow', label: '옐로우', colorMode: 'fixed', baseColor: '#F2C230', darkNumber: true },
  green:  { id: 'green',  label: '그린',   colorMode: 'fixed', baseColor: '#2E8B57' },
  sky:    { id: 'sky',    label: '스카이', colorMode: 'fixed', baseColor: '#4FB0E5', darkNumber: true },
  blue:   { id: 'blue',   label: '블루',   colorMode: 'fixed', baseColor: '#1E6BB8' },
  navy:   { id: 'navy',   label: '네이비', colorMode: 'fixed', baseColor: '#1B3A6B' },
  purple: { id: 'purple', label: '퍼플',   colorMode: 'fixed', baseColor: '#7A4FA3' },
  pink:   { id: 'pink',   label: '핑크',   colorMode: 'fixed', baseColor: '#E86AA6', darkNumber: true },
  black:  { id: 'black',  label: '블랙',   colorMode: 'fixed', baseColor: '#1F1F1F' },
  cream:  { id: 'cream',  label: '크림',   colorMode: 'fixed', baseColor: '#F2ECD9', darkNumber: true },
  gray:   { id: 'gray',   label: '그레이', colorMode: 'fixed', baseColor: '#8A8A8A' },
};

// ── 스킨 목록 (isHidden=false만 노출, sortOrder 순) ───────────────────────────
export const SCORE_SKINS: ScoreSkin[] = [
  {
    id: 'jersey.classic.team', kind: 'jersey', category: 'uniform',
    label: '클래식', description: '내 팀 컬러 기본형',
    styleId: 'classic', paletteId: 'team', colorMode: 'team',
    unlockType: 'free', isDefault: true, sortOrder: 10,
  },
  {
    id: 'jersey.pinstripe.team', kind: 'jersey', category: 'uniform',
    label: '핀스트라이프', description: '내 팀 컬러 줄무늬형',
    styleId: 'pinstripe', paletteId: 'team', colorMode: 'team',
    unlockType: 'free', sortOrder: 20,
  },
  {
    id: 'jersey.cream.team', kind: 'jersey', category: 'uniform',
    label: '크림', description: '크림 바탕 + 내 팀 컬러',
    styleId: 'cream', paletteId: 'team', colorMode: 'team',
    unlockType: 'free', sortOrder: 30,
  },
  {
    id: 'jersey.classicSplit.team', kind: 'jersey', category: 'uniform',
    label: '클래식 소매', description: '내 팀 컬러 + 소매 배색',
    styleId: 'classicSplit', paletteId: 'team', colorMode: 'team',
    unlockType: 'free', sortOrder: 40,
  },
  {
    id: 'jersey.creamSplit.team', kind: 'jersey', category: 'uniform',
    label: '크림 소매', description: '크림 바탕 + 내 팀 컬러 소매',
    styleId: 'creamSplit', paletteId: 'team', colorMode: 'team',
    unlockType: 'free', sortOrder: 50,
  },
  {
    id: 'scoreboard.vintage', kind: 'asset', category: 'stadium',
    label: '전광판', description: '야구장 레트로 점수판',
    assetKey: 'scoreboardVintage', renderType: 'scoreboard',
    unlockType: 'free', sortOrder: 100,
  },
  // ── 고정색 유니폼(컬러팩) — classic 스타일 × 고정 팔레트. 응원팀 무관 동일색. ──
  ...( ['red', 'pink', 'orange', 'yellow', 'green', 'sky', 'blue', 'black'] as JerseyPaletteId[]
  ).map((p, i): JerseySkin => ({
    id: `jersey.classic.${p}`,
    kind: 'jersey',
    category: 'uniform',
    label: `${JERSEY_PALETTES[p].label} 유니폼`,
    description: '고정 컬러 유니폼',
    styleId: 'classic',
    paletteId: p,
    colorMode: 'fixed',
    unlockType: 'free',
    unlockGroup: 'color_uniform_pack',
    sortOrder: 110 + i * 10,
  })),
];

const DEFAULT_ID = 'jersey.classic.team';
const BY_ID = new Map<string, ScoreSkin>(SCORE_SKINS.map((s) => [s.id, s]));

// 화면 노출 목록(숨김 제외 + 정렬).
export const SCORE_SKIN_LIST: ScoreSkin[] = SCORE_SKINS
  .filter((s) => !s.isHidden)
  .sort((a, b) => a.sortOrder - b.sortOrder);

export function getScoreSkinById(id: string | null | undefined): ScoreSkin {
  return (id && BY_ID.get(id)) || BY_ID.get(DEFAULT_ID)!;
}

// 유니폼 스킨의 실효 색상 — team이면 teamColor, fixed면 팔레트 baseColor.
export function resolveJerseyColor(skin: JerseySkin, teamColor: string | undefined): string | undefined {
  if (skin.colorMode === 'fixed') {
    return JERSEY_PALETTES[skin.paletteId]?.baseColor ?? teamColor;
  }
  return teamColor;
}

// 밝은 바탕 고정색 유니폼은 숫자를 어둡게(가독성). 팀스킨/어두운 고정색은 기본(크림).
export function resolveJerseyNumberMode(skin: JerseySkin): 'dark' | undefined {
  return JERSEY_PALETTES[skin.paletteId]?.darkNumber ? 'dark' : undefined;
}

// ── 저장값 마이그레이션 (구 id/프리셋 → 새 id) ────────────────────────────────
const MIGRATION: Record<string, string> = {
  classic: 'jersey.classic.team',
  'jersey.classic': 'jersey.classic.team',
  pinstripe: 'jersey.pinstripe.team',
  'jersey.pinstripe': 'jersey.pinstripe.team',
  cream: 'jersey.cream.team',
  'jersey.cream': 'jersey.cream.team',
  classicSplit: 'jersey.classicSplit.team',
  'jersey.classicSplit': 'jersey.classicSplit.team',
  creamSplit: 'jersey.creamSplit.team',
  'jersey.creamSplit': 'jersey.creamSplit.team',
  'scoreboard.vintage': 'scoreboard.vintage',
};

export function normalizeScoreSkinId(v: string | null | undefined): ScoreSkinId {
  if (!v) return DEFAULT_ID;
  if (BY_ID.has(v)) return v;            // 이미 유효한 새 id
  return MIGRATION[v] ?? DEFAULT_ID;     // 구 id/프리셋 매핑
}
