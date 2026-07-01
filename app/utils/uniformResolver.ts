const CREAM_BODY = '#F7E8C8';    // cream 몸판 (따뜻한 아이보리)
const CREAM_PIPING = '#FFF0CC'; // 크림 파이핑/숫자
const CREAM_NUMBER = '#FFF3D6'; // classic/pinstripe 숫자

export type UniformPresetId = 'classic' | 'pinstripe' | 'cream' | 'classicSplit' | 'creamSplit';

// V6.5: 소매 배색 모드. useSleeveSplit=true일 때만 적용(false면 소매=몸통).
export type SleeveMode = 'sameAsBody' | 'team' | 'cream' | 'tintedTeam';

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
  useSleeveSplit?: boolean;   // false/미지정 = 기존 V6 (소매=몸통, 렌더 동일)
  sleeveMode?: SleeveMode;
}

// 색 밝기 조정: amount<0 어둡게, >0 밝게 ([-1,1]).
function adjustColor(hex: string, amount: number): string {
  if (!hex || !hex.startsWith('#') || hex.length !== 7) return hex;
  const ch = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  const adj = (c: number) => amount < 0
    ? Math.round(c * (1 + amount))
    : Math.round(c + (255 - c) * amount);
  const h2 = (c: number) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0');
  return `#${h2(adj(ch(1)))}${h2(adj(ch(3)))}${h2(adj(ch(5)))}`;
}

export type BadgeVariant = 'hero' | 'compact' | 'detail';

export interface ResolvedUniformStyle {
  bodyColor: string;
  // V6.5 소매 분리
  sleeveSplit: boolean;
  leftSleeveColor: string;
  rightSleeveColor: string;
  sleeveSeamColor: string;
  sleeveSeamOpacity: number;
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
  // V6.5 테스트 프리셋 — 소매/몸통 배색 분리
  classicSplit: {
    id: 'classicSplit',
    label: '클래식 스플릿',
    description: '몸통·소매 톤 분리',
    badgeLabel: '신규',
    bodyMode: 'team',
    pipingStyle: 'cream',
    stripeStyle: 'none',
    numberStyle: 'classic',
    outlineStyle: 'soft',
    useSleeveSplit: true,
    sleeveMode: 'tintedTeam',   // 소매를 팀색보다 살짝 어둡게
  },
  creamSplit: {
    id: 'creamSplit',
    label: '크림 스플릿',
    description: '크림 몸통 · 팀색 소매',
    badgeLabel: '신규',
    bodyMode: 'cream',
    pipingStyle: 'team',
    stripeStyle: 'none',
    numberStyle: 'team',
    outlineStyle: 'soft',
    useSleeveSplit: true,
    sleeveMode: 'team',         // 소매를 팀색으로
  },
};

// 유효하지 않은 저장값(default/vintage 등) → classic 정규화
const VALID_PRESET_IDS = new Set<string>(['classic', 'pinstripe', 'cream', 'classicSplit', 'creamSplit']);
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

  // V6.5 소매 색상 — useSleeveSplit=false면 소매=몸통(기존 V6와 동일 렌더).
  const sleeveSplit = !!config.useSleeveSplit;
  let sleeveColor = bodyColor;
  if (sleeveSplit) {
    switch (config.sleeveMode) {
      case 'team':       sleeveColor = teamColor; break;
      case 'cream':      sleeveColor = CREAM_BODY; break;
      case 'tintedTeam': sleeveColor = adjustColor(teamColor, -0.15); break; // 팀색보다 15% 어둡게
      default:           sleeveColor = bodyColor; break; // sameAsBody
    }
  }
  // 소매 seam: 아주 약하게(색차 위주). 바디색에 따라 밝은/어두운 선. compact는 생략(0).
  const sleeveSeamColor = config.bodyMode === 'cream'
    ? 'rgba(90,65,40,0.18)'      // 크림 바디 → 어두운 seam
    : 'rgba(255,240,204,0.18)';  // 팀컬러 바디 → 밝은 seam
  const sleeveSeamOpacity = !sleeveSplit
    ? 0
    : variant === 'compact' ? 0 : variant === 'hero' ? 0.6 : 0.75; // 딱딱함 완화

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
    bodyColor,
    sleeveSplit, leftSleeveColor: sleeveColor, rightSleeveColor: sleeveColor,
    sleeveSeamColor, sleeveSeamOpacity,
    pipingColor, pipingWidth,
    cuffColor: pipingColor, cuffOpacity, cuffWidth,
    stripeColor, stripeOpacity, stripeWidth, stripeGap,
    numberFill, numberStroke, numberStrokeWidth,
    numberShadowColor, numberShadowOpacity,
    outerStrokeColor, outerStrokeWidth,
    shadowOpacity, shadowOffsetY,
  };
}
