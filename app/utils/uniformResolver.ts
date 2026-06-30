const CREAM_BODY = '#F7E8C8';    // cream 몸판 (따뜻한 아이보리)
const CREAM_PIPING = '#FFF0CC'; // 크림 파이핑/숫자
const CREAM_NUMBER = '#FFF3D6'; // classic/pinstripe 숫자

export type UniformPresetId = 'classic' | 'pinstripe' | 'cream';

export interface UniformPresetConfig {
  id: UniformPresetId;
  label: string;
  description: string;
  badgeLabel: string;
  bodyMode: 'team' | 'cream';
  pipingStyle: 'cream' | 'team';
  stripeStyle: 'none' | 'strong';
  numberStyle: 'classic' | 'team';
  outlineStyle: 'soft';
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
  stripeWidth: number;
  stripeGap: number;
  numberFill: string;
  numberStroke: string;
  numberStrokeWidth: number;
  numberShadowColor: string;
  numberShadowOpacity: number;
  outerStrokeColor: string;
  outerStrokeWidth: number;
  shadowOpacity: number;
  shadowOffsetY: number;
}

export const UNIFORM_PRESETS: Record<UniformPresetId, UniformPresetConfig> = {
  classic: {
    id: 'classic',
    label: '클래식',
    description: '정석형 기본 스타일',
    badgeLabel: '기본',
    bodyMode: 'team',
    pipingStyle: 'cream',
    stripeStyle: 'none',
    numberStyle: 'classic',
    outlineStyle: 'soft',
  },
  pinstripe: {
    id: 'pinstripe',
    label: '핀스트라이프',
    description: '야구 감성 강조',
    badgeLabel: '추천',
    bodyMode: 'team',
    pipingStyle: 'cream',
    stripeStyle: 'strong',
    numberStyle: 'classic',
    outlineStyle: 'soft',
  },
  cream: {
    id: 'cream',
    label: '크림',
    description: '부드럽고 고급스러운 느낌',
    badgeLabel: '프리미엄',
    bodyMode: 'cream',
    pipingStyle: 'team',
    stripeStyle: 'none',
    numberStyle: 'team',
    outlineStyle: 'soft',
  },
};

// 유효하지 않은 저장값(default/vintage 등) → classic 정규화
const VALID_PRESET_IDS = new Set<string>(['classic', 'pinstripe', 'cream']);
export function normalizePresetId(v: string | null | undefined): UniformPresetId {
  if (v && VALID_PRESET_IDS.has(v)) return v as UniformPresetId;
  return 'classic';
}

export function resolveUniformPreset(
  config: UniformPresetConfig,
  teamColor: string,
  variant: BadgeVariant,
): ResolvedUniformStyle {
  const bodyColor = config.bodyMode === 'cream' ? CREAM_BODY : teamColor;
  const pipingColor = config.pipingStyle === 'team' ? teamColor : CREAM_PIPING;

  // 파이핑/커프: variant별 두께
  const pipingWidth = variant === 'compact' ? 1.0 : variant === 'hero' ? 1.5 : 1.8;
  const cuffWidth   = variant === 'compact' ? 0.8 : 1.2;
  const cuffOpacity = variant === 'compact' ? 0.70 : variant === 'hero' ? 0.85 : 0.90;

  // 핀스트라이프 파라미터 (variant별)
  let stripeColor   = CREAM_PIPING;
  let stripeOpacity = 0;
  let stripeWidth   = 1.0;
  let stripeGap     = 7;

  if (config.stripeStyle === 'strong') {
    if (variant === 'compact') {
      stripeOpacity = 0.14; stripeWidth = 1.0; stripeGap = 6;
    } else if (variant === 'hero') {
      stripeOpacity = 0.21; stripeWidth = 1.0; stripeGap = 7;
    } else {
      stripeOpacity = 0.25; stripeWidth = 1.2; stripeGap = 8;
    }
  }

  // 숫자
  let numberFill: string;
  let numberStroke: string;
  let numberStrokeWidth: number;
  let numberShadowColor: string;
  let numberShadowOpacity: number;

  if (config.numberStyle === 'team') {
    // cream: 팀 컬러 숫자 + 크림 외곽선
    numberFill          = teamColor;
    numberStroke        = '#FFF4D8';
    numberStrokeWidth   = variant === 'compact' ? 0.9 : variant === 'hero' ? 1.3 : 1.6;
    numberShadowColor   = '#503C23';
    numberShadowOpacity = 0.12;
  } else if (config.stripeStyle === 'strong') {
    // pinstripe: 크림 숫자, 약간 선명한 외곽선
    numberFill          = CREAM_NUMBER;
    numberStroke        = 'rgba(25,20,15,0.38)';
    numberStrokeWidth   = variant === 'compact' ? 0.9 : variant === 'hero' ? 1.2 : 1.5;
    numberShadowColor   = '#000000';
    numberShadowOpacity = 0.14;
  } else {
    // classic: 크림 숫자, 부드러운 외곽선
    numberFill          = CREAM_NUMBER;
    numberStroke        = 'rgba(35,28,20,0.32)';
    numberStrokeWidth   = variant === 'compact' ? 0.9 : variant === 'hero' ? 1.2 : 1.5;
    numberShadowColor   = '#000000';
    numberShadowOpacity = 0.10;
  }

  // 외곽선 & 드롭쉐도우
  const outerStrokeColor = config.stripeStyle === 'strong'
    ? 'rgba(80,65,45,0.38)'
    : 'rgba(80,65,45,0.35)';
  const outerStrokeWidth = variant === 'compact' ? 1.0 : variant === 'hero' ? 1.5 : 2.0;
  const shadowOpacity    = variant === 'compact' ? 0.08 : variant === 'hero' ? 0.15 : 0.20;
  const shadowOffsetY    = variant === 'compact' ? 1 : 2;

  return {
    bodyColor, pipingColor, pipingWidth,
    cuffColor: pipingColor, cuffOpacity, cuffWidth,
    stripeColor, stripeOpacity, stripeWidth, stripeGap,
    numberFill, numberStroke, numberStrokeWidth,
    numberShadowColor, numberShadowOpacity,
    outerStrokeColor, outerStrokeWidth,
    shadowOpacity, shadowOffsetY,
  };
}
