// 꿀잼지수 스킨 데이터모델 — styleId × paletteId × colorMode(유니폼) / assetKey × renderType(에셋).
// 사용자는 완성형 스킨 하나를 선택(UX 동일). 내부만 확장형 구조(고정색/스킨팩/프리미엄 대비).
import type { UniformPresetId, UniformColorOverride } from './uniformResolver';
import { findBackground } from './lockerBackgroundConfig';

export type ScoreSkinKind = 'jersey' | 'asset';
export type ScoreSkinCategory = 'uniform' | 'stadium' | 'special';

// 구현된 유니폼 스타일(= uniformResolver의 UNIFORM_PRESETS 키). 새 스타일 추가 시 양쪽 확장.
export type JerseyStyleId = UniformPresetId;
export type JerseyPaletteId =
  | 'team' | 'red' | 'orange' | 'yellow' | 'green' | 'sky'
  | 'blue' | 'navy' | 'purple' | 'pink' | 'black' | 'cream' | 'gray';
export type JerseyColorMode = 'team' | 'fixed';
export type UnlockType = 'free' | 'currency' | 'event' | 'premium';  // MVP 동작=free/currency, event/premium=미래용
export type CurrencyType = 'baseball';
export type AssetRenderType = 'scoreboard' | 'imageFrame';

interface BaseSkin {
  id: string;
  label: string;
  description?: string;
  category: ScoreSkinCategory;
  unlockType: UnlockType;
  price?: number;              // currency 스킨의 야구공 가격(1~99)
  currencyType?: CurrencyType; // 현재 'baseball'만
  unlockGroup?: string;        // 섹션 그룹핑용(예: color_uniform_pack) — 구매 여부와 무관
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
  yellow: { id: 'yellow', label: '옐로우', colorMode: 'fixed', baseColor: '#F4D84E', darkNumber: true },
  green:  { id: 'green',  label: '그린',   colorMode: 'fixed', baseColor: '#2E8B57' },
  sky:    { id: 'sky',    label: '스카이', colorMode: 'fixed', baseColor: '#8FD8FF', darkNumber: true },
  blue:   { id: 'blue',   label: '블루',   colorMode: 'fixed', baseColor: '#1E6BB8' },
  navy:   { id: 'navy',   label: '네이비', colorMode: 'fixed', baseColor: '#1B3A6B' },
  purple: { id: 'purple', label: '퍼플',   colorMode: 'fixed', baseColor: '#7A4FA3' },
  pink:   { id: 'pink',   label: '핑크',   colorMode: 'fixed', baseColor: '#F4A9C8', darkNumber: true },
  black:  { id: 'black',  label: '블랙',   colorMode: 'fixed', baseColor: '#1F1F1F' },
  cream:  { id: 'cream',  label: '크림',   colorMode: 'fixed', baseColor: '#F2ECD9', darkNumber: true },
  gray:   { id: 'gray',   label: '그레이', colorMode: 'fixed', baseColor: '#8A8A8A' },
};

// white 스타일 전용 포인트 컬러 — 흰 바디 위 가독성 위해 팔레트 baseColor보다 살짝 진하게 보정.
export const WHITE_POINT_COLORS: Partial<Record<JerseyPaletteId, string>> = {
  red: '#C92A3A', pink: '#D96B96', orange: '#E9551C', yellow: '#C99A12',
  green: '#2E8B57', sky: '#2E8FBD', blue: '#1E63B6', black: '#1F1F1F',
};

// 컬러 유니폼(classic 고정색)용 명시 트림/숫자색 — 팔레트 baseColor(=몸통)와 별개로 지정.
// 밝은 몸통에서 숫자 가독성·색 성격을 팔레트별로 최적화(핑크=흰숫자, 하늘=빨강숫자, 노랑=차콜숫자).
export const COLOR_UNIFORM_OVERRIDES: Partial<Record<JerseyPaletteId, UniformColorOverride>> = {
  pink:   { trimColor: '#F9EBD8', numberFill: '#FFFDF8', numberStroke: '#B56A8C' },  // 연분홍 위 크림 밴드(흰밴드는 떠보임)
  sky:    { trimColor: '#2F6F94', numberFill: '#E94B4B', numberStroke: '#9E2F2F' },  // 틸 밴드(숫자=레드와 경쟁 회피)
  yellow: { trimColor: '#6A5A1E', numberFill: '#2B2B2B', numberStroke: '#FFF4B8' },  // 올리브 밴드(숫자=차콜과 구분)
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
    unlockType: 'free', sortOrder: 40, isHidden: true,   // 일단 숨김(목록 비노출)
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
    unlockType: 'currency', price: 30, currencyType: 'baseball', sortOrder: 500,   // 유니폼 섹션(줄무늬 310~380) 뒤로. 야구장 탭에선 단독 첫번째.
  },
  {
    id: 'ticket.retro', kind: 'asset', category: 'stadium',
    label: '레트로 티켓', description: '야구장 입장권 스타일',
    assetKey: 'ticketRetro', renderType: 'imageFrame',
    unlockType: 'currency', price: 30, currencyType: 'baseball', sortOrder: 510,   // 전광판 다음(야구장 섹션).
  },
  {
    id: 'homeplate.retro', kind: 'asset', category: 'stadium',
    label: '홈플레이트', description: '홈플레이트 프레임 스타일',
    assetKey: 'homePlate', renderType: 'imageFrame',
    unlockType: 'currency', price: 30, currencyType: 'baseball', sortOrder: 520,   // 티켓 다음(야구장 섹션).
  },
  // ── 야구장 에셋 5종 (imageFrame) ──
  {
    id: 'nameplate.dugout', kind: 'asset', category: 'stadium',
    label: '더그아웃 네임플레이트', description: '더그아웃 명패 스타일',
    assetKey: 'nameplateDugout', renderType: 'imageFrame',
    unlockType: 'currency', price: 30, currencyType: 'baseball', sortOrder: 530,
  },
  {
    id: 'lineup.card', kind: 'asset', category: 'stadium',
    label: '라인업 카드', description: '선발 라인업 카드 스타일',
    assetKey: 'lineupCard', renderType: 'imageFrame',
    unlockType: 'currency', price: 35, currencyType: 'baseball', sortOrder: 540,
  },
  {
    id: 'tacticboard.retro', kind: 'asset', category: 'stadium',
    label: '작전보드', description: '더그아웃 작전보드 스타일',
    assetKey: 'tacticBoard', renderType: 'imageFrame',
    unlockType: 'currency', price: 35, currencyType: 'baseball', sortOrder: 550,
  },
  {
    id: 'gate.ballpark', kind: 'asset', category: 'stadium',
    label: '구장 게이트 사인', description: '야구장 입구 사인 스타일',
    assetKey: 'ballparkGate', renderType: 'imageFrame',
    unlockType: 'currency', price: 40, currencyType: 'baseball', sortOrder: 560,
  },
  {
    id: 'speedgun.bullpen', kind: 'asset', category: 'stadium',
    label: '불펜 스피드건 보드', description: '불펜 구속 전광 보드 스타일',
    assetKey: 'speedgunBoard', renderType: 'imageFrame',
    unlockType: 'currency', price: 45, currencyType: 'baseball', sortOrder: 570,
  },
  // ── 스페셜 에셋 ──
  {
    id: 'medal.special', kind: 'asset', category: 'special',
    label: '꿀잼 메달', description: '스페셜 골드 메달',
    assetKey: 'medalSpecial', renderType: 'imageFrame',
    unlockType: 'currency', price: 60, currencyType: 'baseball', sortOrder: 600,   // 스페셜 섹션 첫 항목.
  },
  {
    id: 'trophy.mvp', kind: 'asset', category: 'special',
    label: 'MVP 트로피 플라크', description: '스페셜 MVP 트로피',
    assetKey: 'mvpTrophy', renderType: 'imageFrame',
    unlockType: 'currency', price: 75, currencyType: 'baseball', sortOrder: 610,
  },
  {
    id: 'ring.champ', kind: 'asset', category: 'special',
    label: '챔피언십 링', description: '스페셜 챔피언십 링',
    assetKey: 'champRing', renderType: 'imageFrame',
    unlockType: 'currency', price: 90, currencyType: 'baseball', sortOrder: 620,
  },
  // ── 고정색 컬러 유니폼(컬러팩) — classic × 고정 팔레트. 응원팀 무관 동일색. ──
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
    unlockType: 'currency', price: 10, currencyType: 'baseball',
    unlockGroup: 'color_uniform_pack',
    sortOrder: 110 + i * 10,
  })),
  // ── 흰색 유니폼(화이트팩) — white 스타일 × 포인트 컬러. 흰 바탕 + 컬러 포인트. ──
  ...( ['red', 'pink', 'orange', 'yellow', 'green', 'sky', 'blue', 'black'] as JerseyPaletteId[]
  ).map((p, i): JerseySkin => ({
    id: `jersey.white.${p}`,
    kind: 'jersey',
    category: 'uniform',
    label: `화이트 ${JERSEY_PALETTES[p].label}`,
    description: `흰색 바탕 + ${JERSEY_PALETTES[p].label} 포인트`,
    styleId: 'white',
    paletteId: p,
    colorMode: 'fixed',
    unlockType: 'currency', price: 15, currencyType: 'baseball',
    unlockGroup: 'white_uniform_pack',
    sortOrder: 210 + i * 10,
  })),
  // ── 줄무늬 유니폼(줄무늬팩) — stripe 스타일 × 포인트 컬러. 흰 바탕 + 컬러 세로 줄무늬. ──
  ...( ['red', 'pink', 'orange', 'yellow', 'green', 'sky', 'blue', 'black'] as JerseyPaletteId[]
  ).map((p, i): JerseySkin => ({
    id: `jersey.stripe.${p}`,
    kind: 'jersey',
    category: 'uniform',
    label: `줄무늬 ${JERSEY_PALETTES[p].label}`,
    description: `흰색 바탕 + ${JERSEY_PALETTES[p].label} 줄무늬`,
    styleId: 'stripe',
    paletteId: p,
    colorMode: 'fixed',
    unlockType: 'currency', price: 20, currencyType: 'baseball',
    unlockGroup: 'stripe_uniform_pack',
    sortOrder: 310 + i * 10,
  })),
];

// ── 섹션 그룹 (스킨샵 정리용) ──────────────────────────────────────────────
// 유니폼은 unlockGroup별로, 그 외 에셋은 category별로 섹션이 나뉜다.
// 새 스킨팩을 추가할 때: 스킨에 unlockGroup + sortOrder만 부여하면 섹션이 자동 생성되고,
// 제목을 지정하려면 여기 한 줄만 추가하면 된다(SkinSelect.tsx는 손댈 필요 없음).
// 섹션 노출 순서는 각 섹션 첫 스킨의 sortOrder를 따른다.
export const SKIN_SECTION_TITLES: Record<string, string> = {
  'uniform:__basic': '기본 유니폼',
  'uniform:color_uniform_pack': '컬러 유니폼',
  'uniform:white_uniform_pack': '화이트 유니폼',
  'uniform:stripe_uniform_pack': '줄무늬 유니폼',
  stadium: '야구장 스킨',
  special: '스페셜 스킨',
};

// 스킨이 속한 섹션 키. 유니폼은 unlockGroup(없으면 기본), 에셋은 category.
export function getSkinSectionKey(s: ScoreSkin): string {
  if (s.category === 'uniform') return `uniform:${s.unlockGroup ?? '__basic'}`;
  return s.category;
}

// 섹션 제목. 등록 안 된 키는 유니폼/에셋에 맞는 기본값으로 폴백(제목 누락돼도 안전).
export function getSkinSectionTitle(key: string): string {
  return SKIN_SECTION_TITLES[key] ?? (key.startsWith('uniform:') ? '기타 유니폼' : '기타 스킨');
}

const DEFAULT_ID = 'jersey.classic.team';
const BY_ID = new Map<string, ScoreSkin>(SCORE_SKINS.map((s) => [s.id, s]));

// 화면 노출 목록(숨김 제외 + 정렬).
export const SCORE_SKIN_LIST: ScoreSkin[] = SCORE_SKINS
  .filter((s) => !s.isHidden)
  .sort((a, b) => a.sortOrder - b.sortOrder);

export function getScoreSkinById(id: string | null | undefined): ScoreSkin {
  return (id && BY_ID.get(id)) || BY_ID.get(DEFAULT_ID)!;
}

// 거래내역 표시 라벨 — 스킨 구매는 서버가 넣은 코드값(jersey.classic.red 구매) 대신
// 한글 스킨명(레드 유니폼 구매)으로. 그 외 사유는 서버 label 그대로.
export function txDisplayLabel(reason: string, relatedSkinId: string | null | undefined, fallback: string): string {
  if (reason === 'skin_purchase' && relatedSkinId && BY_ID.has(relatedSkinId)) {
    return `${getScoreSkinById(relatedSkinId).label} 구매`;
  }
  // 배경 구매 원장 라벨은 "lockerbg.xxx 구매"(영문 id) — 한글명으로 치환. id는 라벨 첫 토큰에서 추출.
  if (reason === 'background_purchase') {
    const bg = findBackground(fallback.split(' ')[0]);
    if (bg) return `${bg.label} 구매`;
  }
  return fallback;
}

// 보유 판정 — free이거나 구매목록에 있거나 현재 적용 중(grandfather).
export function isSkinOwned(skin: ScoreSkin, ownedIds: readonly string[], selectedId: string | null): boolean {
  return skin.unlockType === 'free' || ownedIds.includes(skin.id) || selectedId === skin.id;
}

// 유니폼 스킨의 실효 색상 — team이면 teamColor, fixed면 팔레트색.
// white/stripe 스타일은 흰 바디 위 가독성 위해 보정된 포인트색(WHITE_POINT_COLORS) 사용.
export function resolveJerseyColor(skin: JerseySkin, teamColor: string | undefined): string | undefined {
  if (skin.colorMode === 'fixed') {
    if (skin.styleId === 'white' || skin.styleId === 'stripe') {
      return WHITE_POINT_COLORS[skin.paletteId] ?? JERSEY_PALETTES[skin.paletteId]?.baseColor ?? teamColor;
    }
    return JERSEY_PALETTES[skin.paletteId]?.baseColor ?? teamColor;
  }
  return teamColor;
}

// 밝은 바탕 고정색 유니폼은 숫자를 어둡게(가독성). white/stripe 스타일은 포인트색 숫자라 미적용.
export function resolveJerseyNumberMode(skin: JerseySkin): 'dark' | undefined {
  if (skin.styleId === 'white' || skin.styleId === 'stripe') return undefined;
  return JERSEY_PALETTES[skin.paletteId]?.darkNumber ? 'dark' : undefined;
}

// 컬러팩(classic 고정색) 유니폼의 명시 트림/숫자색 오버라이드. 그 외(팀색·white·stripe)는 없음.
export function resolveUniformOverride(skin: ScoreSkin): UniformColorOverride | undefined {
  if (skin.kind !== 'jersey') return undefined;
  if (skin.styleId === 'classic' && skin.colorMode === 'fixed') return COLOR_UNIFORM_OVERRIDES[skin.paletteId];
  return undefined;
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
