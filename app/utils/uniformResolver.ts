const CREAM = '#F5EDDA';
const GOLD = '#D4AF37';
const BORDER_BASE = '#B8B0A3';

export type UniformPresetId = 'default' | 'classic' | 'pinstripe' | 'vintage' | 'cream';

type BodyMode = 'team' | 'cream';
type PipingStyle = 'cream' | 'gold' | 'team';
type StripeStyle = 'none' | 'subtle' | 'strong';
type NumberStyle = 'default' | 'classic' | 'vintage' | 'team';
type OutlineStyle = 'minimal' | 'soft' | 'sticker';

export interface UniformPresetConfig {
  id: UniformPresetId;
  label: string;
  bodyMode: BodyMode;
  pipingStyle: PipingStyle;
  stripeStyle: StripeStyle;
  numberStyle: NumberStyle;
  outlineStyle: OutlineStyle;
}

export type BadgeVariant = 'hero' | 'compact' | 'detail';

export interface ResolvedUniformStyle {
  bodyColor: string;
  pipingColor: string;
  pipingWidth: number;
  cuffColor: string;
  cuffOpacity: number;
  cuffWidth: number;
  stripeColor: string;
  stripeOpacity: number;
  numberFill: string;
  numberStroke: string;
  numberStrokeWidth: number;
  outerStrokeColor: string;
  outerStrokeWidth: number;
  shadowOpacity: number;
  shadowOffsetY: number; // Phase 2: drive translate for sticker style
}

export const UNIFORM_PRESETS: Record<UniformPresetId, UniformPresetConfig> = {
  default: {
    id: 'default',
    label: '기본 유니폼',
    bodyMode: 'team',
    pipingStyle: 'cream',
    stripeStyle: 'subtle',
    numberStyle: 'default',
    outlineStyle: 'soft',
  },
  classic: {
    id: 'classic',
    label: '클래식',
    bodyMode: 'team',
    pipingStyle: 'cream',
    stripeStyle: 'none',
    numberStyle: 'classic',
    outlineStyle: 'minimal',
  },
  pinstripe: {
    id: 'pinstripe',
    label: '핀스트라이프',
    bodyMode: 'team',
    pipingStyle: 'cream',
    stripeStyle: 'strong',
    numberStyle: 'classic',
    outlineStyle: 'soft',
  },
  vintage: {
    id: 'vintage',
    label: '빈티지',
    bodyMode: 'cream',
    pipingStyle: 'gold',
    stripeStyle: 'subtle',
    numberStyle: 'vintage',
    outlineStyle: 'sticker', // Phase 2 target; Phase 1 resolves to soft
  },
  cream: {
    id: 'cream',
    label: '크림 유니폼',
    bodyMode: 'cream',
    pipingStyle: 'team',
    stripeStyle: 'none',
    numberStyle: 'team',   // 크림 바탕 가독성: 팀 컬러 숫자 + 아이보리 외곽선
    outlineStyle: 'soft',
  },
};

const NUMBER_STYLES: Record<Exclude<NumberStyle, 'team'>, Pick<ResolvedUniformStyle, 'numberFill' | 'numberStroke' | 'numberStrokeWidth'>> = {
  default: { numberFill: CREAM,      numberStroke: 'rgba(0,0,0,0.20)',      numberStrokeWidth: 3.5 },
  classic: { numberFill: '#FFF7E6',  numberStroke: 'rgba(35,30,24,0.35)',   numberStrokeWidth: 4.0 },
  vintage: { numberFill: '#F3E2B8',  numberStroke: '#6B4A1E',               numberStrokeWidth: 3.8 },
  // 'team': teamColor 동적 값이므로 resolveUniformPreset 내부에서 처리
};

const OUTLINE_STYLES: Record<OutlineStyle, Pick<ResolvedUniformStyle, 'outerStrokeColor' | 'outerStrokeWidth' | 'shadowOpacity' | 'shadowOffsetY'>> = {
  minimal: { outerStrokeColor: BORDER_BASE, outerStrokeWidth: 1,   shadowOpacity: 0,    shadowOffsetY: 0 },
  soft:    { outerStrokeColor: BORDER_BASE, outerStrokeWidth: 2,   shadowOpacity: 0.18, shadowOffsetY: 1 },
  // TODO: Phase 2 — true sticker: thick cream outer border + shadow
  sticker: { outerStrokeColor: BORDER_BASE, outerStrokeWidth: 2,   shadowOpacity: 0.18, shadowOffsetY: 1 },
};

export function resolveUniformPreset(
  config: UniformPresetConfig,
  teamColor: string,   // already processed by badgeColor()
  variant: BadgeVariant,
): ResolvedUniformStyle {
  const bodyColor = config.bodyMode === 'cream' ? CREAM : teamColor;

  const pipingColor =
    config.pipingStyle === 'gold'  ? GOLD :
    config.pipingStyle === 'cream' ? CREAM :
    teamColor;

  const basePipingWidth = config.pipingStyle === 'gold' ? 6 : 5;
  const pipingWidth = variant === 'compact' ? Math.max(3, basePipingWidth - 2) : basePipingWidth;

  const stripeOpacity =
    variant === 'compact'          ? 0 :      // compact: always no stripes
    config.stripeStyle === 'none'  ? 0 :
    config.stripeStyle === 'subtle'? 0.07 :
    0.15;

  // cream body → team-color stripes; team body → cream stripes
  const stripeColor = config.bodyMode === 'cream' ? teamColor : CREAM;

  const cuffOpacity = variant === 'compact' ? 0.65 : variant === 'hero' ? 0.85 : 0.9;
  const cuffWidth   = variant === 'compact' ? 1    : 1.5;

  const outline = OUTLINE_STYLES[config.outlineStyle];
  const outerStrokeWidth = variant === 'compact'
    ? Math.max(1, outline.outerStrokeWidth * 0.75)
    : outline.outerStrokeWidth;

  return {
    bodyColor,
    pipingColor,
    pipingWidth,
    cuffColor: pipingColor,
    cuffOpacity,
    cuffWidth,
    stripeColor,
    stripeOpacity,
    ...(config.numberStyle === 'team'
      ? { numberFill: teamColor, numberStroke: 'rgba(245,237,218,0.80)', numberStrokeWidth: 2.5 }
      : NUMBER_STYLES[config.numberStyle]),
    outerStrokeColor: outline.outerStrokeColor,
    outerStrokeWidth,
    shadowOpacity: outline.shadowOpacity,
    shadowOffsetY: outline.shadowOffsetY,
  };
}
