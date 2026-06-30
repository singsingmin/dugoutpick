// 오늘야구각 전용 유니폼 배지 v5 — 귀여운 키링/아크릴 굿즈 배지 스타일
// hero=추천카드  compact=리스트  detail=상세화면
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Path, Defs, ClipPath, G, Text as SvgText, Line } from 'react-native-svg';
import { colors } from '../theme';
import GguljamScoreLabel from './GguljamScoreLabel';

export type UniformPreset = 'default' | 'classic' | 'pinstripe' | 'vintage';

interface Props {
  score: number;
  variant?: 'hero' | 'compact' | 'detail';
  homeTeamColor?: string;
  teamColor?: string;       // 하위 호환
  uniformPreset?: UniformPreset;
}

const CREAM = '#F5EDDA';
const BORDER_COLOR = '#2A201A';

// ── 유니폼 프리셋 ──────────────────────────────────────────────────────────────
// default:   크림 파이핑 + 약한 핀스트라이프 (V5 final 기본)
// classic:   크림 파이핑 + 스트라이프 없음 (깔끔·클래식)
// pinstripe: 크림 파이핑 + 핀스트라이프 두드러지게 (양키스풍)
// vintage:   골드 파이핑 + 스트라이프 없음 + 테두리 강조 (복고풍)
interface PresetConfig {
  piping: string;      // 파이핑 색상
  pipingW: number;     // 파이핑 strokeWidth
  stripes: boolean;    // 핀스트라이프 표시 여부 (compact 항상 false)
  stripeOp: number;    // 핀스트라이프 opacity
  cuffOp: number;      // 소매 커프 라인 opacity
  borderOp: number;    // 외곽선 opacity
  shadowOp: number;    // 드롭쉐도우 opacity
}

const PRESETS: Record<UniformPreset, PresetConfig> = {
  default: {
    piping: CREAM, pipingW: 5,
    stripes: true,  stripeOp: 0.07,
    cuffOp: 0.50, borderOp: 0.18, shadowOp: 0.08,
  },
  classic: {
    piping: CREAM, pipingW: 5,
    stripes: false, stripeOp: 0,
    cuffOp: 0.55, borderOp: 0.22, shadowOp: 0.10,
  },
  pinstripe: {
    piping: CREAM, pipingW: 4,
    stripes: true,  stripeOp: 0.15,
    cuffOp: 0.50, borderOp: 0.18, shadowOp: 0.08,
  },
  vintage: {
    piping: '#D4AF37', pipingW: 6,
    stripes: false, stripeOp: 0,
    cuffOp: 0.70, borderOp: 0.28, shadowOp: 0.12,
  },
};

// 팀 컬러 배지 보정: 밝은 색 어둡게, 어두운 색 유지
function badgeColor(hex: string): string {
  if (!hex || !hex.startsWith('#') || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  const k = luma > 120 ? 0.85 : luma > 60 ? 0.95 : 1.0;
  const nr = Math.min(255, Math.round(r * k));
  const ng = Math.min(255, Math.round(g * k));
  const nb = Math.min(255, Math.round(b * k));
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

// ── 대형 유니폼 실루엣 (뒷면 백넘버) — V4 ────────────────────────────────────
// viewBox -4 -4 104 100
// 어깨: x=8/92 (y=18), 소매 끝: x=4/96 (y=31), 커프: x=20/80 (y=39)
// body: x=23~77, y=39~84, center y=61.5
const JERSEY =
  'M 36,6 Q 22,9 8,18' +    // 칼라→왼쪽 어깨 접합
  ' L 4,31' +                // 왼쪽 소매 외곽 끝
  ' L 20,39' +               // 왼쪽 소매 커프 (안쪽 수렴)
  ' L 23,84' +               // 왼쪽 몸통
  ' Q 23,89 29,89' +         // 왼쪽 밑단 코너
  ' L 71,89' +               // 밑단
  ' Q 77,89 77,84' +         // 오른쪽 밑단 코너
  ' L 80,39' +               // 오른쪽 몸통
  ' L 96,31' +               // 오른쪽 소매 커프
  ' L 92,18' +               // 오른쪽 소매 외곽 끝
  ' Q 78,9 64,6' +           // 오른쪽 어깨→칼라
  ' Q 50,13 36,6 Z';         // 뒷목 칼라 U

// ── 소형 유니폼 실루엣 (뒷면 백넘버) — V4 ────────────────────────────────────
// viewBox -3 -3 56 62
// 어깨: x=3/47 (y=11), 소매 끝: x=1/49 (y=18), 커프: x=11/39 (y=21)
// body: x=12~38, y=21~47, center y=34
const JERSEY_SM =
  'M 18,4 Q 11,6 3,11' +    // 칼라→왼쪽 어깨 접합
  ' L 1,18' +                // 왼쪽 소매 외곽 끝
  ' L 11,21' +               // 왼쪽 소매 커프
  ' L 12,47' +               // 왼쪽 몸통
  ' Q 12,51 17,51' +         // 왼쪽 밑단 코너
  ' L 33,51' +               // 밑단
  ' Q 38,51 38,47' +         // 오른쪽 밑단 코너
  ' L 39,21' +               // 오른쪽 몸통
  ' L 49,18' +               // 오른쪽 소매 커프
  ' L 47,11' +               // 오른쪽 소매 외곽 끝
  ' Q 39,6 32,4' +           // 오른쪽 어깨→칼라
  ' Q 25,9 18,4 Z';          // 뒷목 칼라 U

let _seq = 0;

function digitCount(score: number): 1 | 2 | 3 {
  const d = String(score).length;
  return d >= 3 ? 3 : d === 2 ? 2 : 1;
}

// ── 숫자 위치·크기 테이블 ────────────────────────────────────────────────────
// dominantBaseline="middle" → y = 시각 중심
// 대형 V4 body center=61.5 (y=39~84) → target y=58 (시각 중앙보다 살짝 위)
// 소형 V4 body center=34 (y=21~47) → target y=33 (살짝 위)
const SCORE_TEXT = {
  hero: {
    1: { fontSize: 44, y: 58 },
    2: { fontSize: 38, y: 58 },
    3: { fontSize: 30, y: 57 },
  },
  detail: {
    1: { fontSize: 44, y: 58 },
    2: { fontSize: 38, y: 58 },
    3: { fontSize: 30, y: 57 },
  },
  compact: {
    1: { fontSize: 20, y: 33 },
    2: { fontSize: 16, y: 33 },
    3: { fontSize: 13, y: 32 },
  },
} as const;

// ── 대형 배지 (hero / detail) ─────────────────────────────────────────────────
function LargeJersey({ score, tc, cid, w, h, variant, preset }: {
  score: number; tc: string; cid: string; w: number; h: number;
  variant: 'hero' | 'detail'; preset: PresetConfig;
}) {
  const dc = digitCount(score);
  const { fontSize, y } = SCORE_TEXT[variant][dc];
  const STRIPES = [36, 43, 50, 57, 64];

  return (
    <Svg width={w} height={h} viewBox="-4 -4 104 100">
      <Defs>
        <ClipPath id={cid}><Path d={JERSEY} /></ClipPath>
      </Defs>

      {/* 드롭 쉐도우 */}
      <Path d={JERSEY} fill={`rgba(60,40,20,${preset.shadowOp})`} translateX={2} translateY={3} />

      {/* 클립 내부 레이어 */}
      <G clipPath={`url(#${cid})`}>
        <Path d={JERSEY} fill={tc} />
        {/* 파이핑 */}
        <Path d={JERSEY} fill="none" stroke={preset.piping} strokeWidth={preset.pipingW} strokeLinejoin="round" />
        {/* 핀스트라이프 */}
        {preset.stripes && STRIPES.map((x) => (
          <Line key={x} x1={x} y1={10} x2={x} y2={87}
            stroke={preset.piping} strokeWidth={0.5} opacity={preset.stripeOp} />
        ))}
      </G>

      {/* 외곽선 */}
      <Path d={JERSEY} fill="none"
        stroke={BORDER_COLOR} strokeWidth={2.0} strokeLinejoin="round" opacity={preset.borderOp} />

      {/* 소매 커프 실밥 라인 */}
      <Path d="M 6,32 L 20,40" fill="none"
        stroke={preset.piping} strokeWidth={1.6} strokeLinecap="round" opacity={preset.cuffOp} />
      <Path d="M 80,40 L 94,32" fill="none"
        stroke={preset.piping} strokeWidth={1.6} strokeLinecap="round" opacity={preset.cuffOp} />

      {/* 등번호 */}
      <SvgText
        x={50} y={y}
        fontSize={fontSize} fontWeight="900"
        fill="none"
        stroke="rgba(0,0,0,0.20)" strokeWidth={3.5} strokeLinejoin="round"
        textAnchor="middle" dominantBaseline="middle"
      >{score}</SvgText>
      <SvgText
        x={50} y={y}
        fontSize={fontSize} fontWeight="900"
        fill={CREAM}
        textAnchor="middle" dominantBaseline="middle"
      >{score}</SvgText>
    </Svg>
  );
}

// ── 소형 배지 (compact) ───────────────────────────────────────────────────────
function CompactJersey({ score, tc, cid, preset }: {
  score: number; tc: string; cid: string; preset: PresetConfig;
}) {
  const dc = digitCount(score);
  const { fontSize, y } = SCORE_TEXT.compact[dc];

  return (
    <Svg width={48} height={53} viewBox="-3 -3 56 62">
      <Defs>
        <ClipPath id={cid}><Path d={JERSEY_SM} /></ClipPath>
      </Defs>

      <Path d={JERSEY_SM} fill={`rgba(60,40,20,${preset.shadowOp})`} translateX={1} translateY={2} />
      <G clipPath={`url(#${cid})`}>
        <Path d={JERSEY_SM} fill={tc} />
        {/* compact: 핀스트라이프 항상 생략 */}
        <Path d={JERSEY_SM} fill="none" stroke={preset.piping} strokeWidth={4} strokeLinejoin="round" />
      </G>
      <Path d={JERSEY_SM} fill="none"
        stroke={BORDER_COLOR} strokeWidth={1.5} strokeLinejoin="round" opacity={preset.borderOp} />

      {/* 소매 커프 실밥 라인 */}
      <Path d="M 2,19 L 11,22" fill="none"
        stroke={preset.piping} strokeWidth={1} strokeLinecap="round" opacity={preset.cuffOp} />
      <Path d="M 39,22 L 48,19" fill="none"
        stroke={preset.piping} strokeWidth={1} strokeLinecap="round" opacity={preset.cuffOp} />

      {/* 숫자 */}
      <SvgText
        x={25} y={y}
        fontSize={fontSize} fontWeight="900"
        fill="none"
        stroke="rgba(0,0,0,0.20)" strokeWidth={2.5} strokeLinejoin="round"
        textAnchor="middle" dominantBaseline="middle"
      >{score}</SvgText>
      <SvgText
        x={25} y={y}
        fontSize={fontSize} fontWeight="900"
        fill={CREAM}
        textAnchor="middle" dominantBaseline="middle"
      >{score}</SvgText>
    </Svg>
  );
}

// ── 공개 컴포넌트 ─────────────────────────────────────────────────────────────
export default function JerseyScoreBadge({
  score, variant = 'hero', homeTeamColor, teamColor, uniformPreset = 'default',
}: Props) {
  const [cid] = useState<string>(() => `jsb_${++_seq}`);
  const tc = badgeColor(homeTeamColor ?? teamColor ?? colors.accent);
  const preset = PRESETS[uniformPreset];

  if (variant === 'compact') {
    return <CompactJersey score={score} tc={tc} cid={cid} preset={preset} />;
  }

  // hero: 88×85 / detail: 110×106  (viewBox 104:100 = 1.04 비율)
  const [w, h] = variant === 'detail' ? [110, 106] : [88, 85];
  return (
    <View style={{ alignItems: 'center', gap: 5 }}>
      <GguljamScoreLabel variant={variant} />
      <LargeJersey score={score} tc={tc} cid={cid} w={w} h={h} variant={variant} preset={preset} />
    </View>
  );
}
