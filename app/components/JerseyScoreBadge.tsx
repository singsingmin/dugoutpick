// 오늘야구각 전용 유니폼 배지 v6 — 귀여운 키링/아크릴 굿즈 배지 스타일
// hero=추천카드  compact=리스트  detail=상세화면
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Path, Defs, ClipPath, G, Text as SvgText, Line } from 'react-native-svg';
import { colors } from '../theme';
import GguljamScoreLabel from './GguljamScoreLabel';
import {
  type UniformPresetId,
  type ResolvedUniformStyle,
  UNIFORM_PRESETS,
  resolveUniformPreset,
} from '../utils/uniformResolver';
import { useUniformPreset } from '../context/ScoreSkin';

export type UniformPreset = UniformPresetId;

interface Props {
  score: number;
  variant?: 'hero' | 'compact' | 'detail';
  homeTeamColor?: string;
  teamColor?: string;       // 하위 호환
  uniformPreset?: UniformPreset;
  showLabel?: boolean;
}

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

// ── 대형 유니폼 실루엣 (뒷면 백넘버) — V6 ────────────────────────────────────
// viewBox -4 -4 104 100
// 어깨: x=16/84 (y=15), 소매 끝: x=10/90 (y=28), 커프: x=22/78 (y=38)
// body: x=22~78, y=38~80, center y=59
const JERSEY =
  'M 37,6 Q 22,10 16,15' +  // 칼라→왼쪽 어깨 (곡선)
  ' L 10,28' +               // 왼쪽 소매 외곽 끝 (아래로 떨어짐)
  ' L 22,38' +               // 왼쪽 소매 커프→몸통 연결
  ' L 22,80' +               // 왼쪽 몸통
  ' Q 22,85 28,85' +         // 왼쪽 밑단 코너
  ' L 72,85' +               // 밑단
  ' Q 78,85 78,80' +         // 오른쪽 밑단 코너
  ' L 78,38' +               // 오른쪽 몸통
  ' L 90,28' +               // 오른쪽 소매 커프→외곽
  ' L 84,15' +               // 오른쪽 어깨
  ' Q 78,10 63,6' +          // 오른쪽 어깨→칼라 (곡선)
  ' Q 50,14 37,6 Z';         // 뒷목 칼라 U

// ── 소형 유니폼 실루엣 (뒷면 백넘버) — V6 ────────────────────────────────────
// viewBox -3 -3 56 62
// 어깨: x=8/42 (y=7), 소매 끝: x=5/45 (y=14), 커프: x=11/39 (y=19)
// body: x=11~39, y=19~40, center y=29.5
const JERSEY_SM =
  'M 19,3 Q 11,5 8,7' +     // 칼라→왼쪽 어깨
  ' L 5,14' +                // 왼쪽 소매 외곽 끝
  ' L 11,19' +               // 왼쪽 소매 커프→몸통
  ' L 11,40' +               // 왼쪽 몸통
  ' Q 11,43 14,43' +         // 왼쪽 밑단 코너
  ' L 36,43' +               // 밑단
  ' Q 39,43 39,40' +         // 오른쪽 밑단 코너
  ' L 39,19' +               // 오른쪽 몸통
  ' L 45,14' +               // 오른쪽 소매 외곽
  ' L 42,7' +                // 오른쪽 어깨
  ' Q 39,5 32,3' +           // 오른쪽 어깨→칼라
  ' Q 25,7 19,3 Z';          // 뒷목 칼라 U

let _seq = 0;

function digitCount(score: number): 1 | 2 | 3 {
  const d = String(score).length;
  return d >= 3 ? 3 : d === 2 ? 2 : 1;
}

// ── 숫자 위치·크기 테이블 ────────────────────────────────────────────────────
// y = 숫자 세로 중심(SVG viewBox 좌표). 낮출수록 위로. 실기기 보정: 위로 ~3 올림.
const SCORE_TEXT = {
  hero: {
    1: { fontSize: 44, y: 54 },
    2: { fontSize: 38, y: 54 },
    3: { fontSize: 30, y: 53 },
  },
  detail: {
    1: { fontSize: 44, y: 54 },
    2: { fontSize: 38, y: 54 },
    3: { fontSize: 30, y: 53 },
  },
  compact: {
    1: { fontSize: 20, y: 28 },
    2: { fontSize: 16, y: 28 },
    3: { fontSize: 13, y: 27 },
  },
} as const;

// ── 핀스트라이프 동적 좌표 계산 ──────────────────────────────────────────────
// bodyStart/bodyEnd: 몸통 x 범위, gap: 줄 간격
function calcStripeXs(bodyStart: number, bodyEnd: number, gap: number): number[] {
  const center = (bodyStart + bodyEnd) / 2;
  const xs: number[] = [center];
  for (let x = center - gap; x >= bodyStart + 2; x -= gap) xs.push(x);
  for (let x = center + gap; x <= bodyEnd - 2; x += gap) xs.push(x);
  return xs.sort((a, b) => a - b);
}

// ── 대형 배지 (hero / detail) ─────────────────────────────────────────────────
function LargeJersey({ score, cid, w, h, variant, resolved }: {
  score: number; cid: string; w: number; h: number;
  variant: 'hero' | 'detail'; resolved: ResolvedUniformStyle;
}) {
  const dc = digitCount(score);
  const { fontSize, y } = SCORE_TEXT[variant][dc];
  // 대형: 몸통 x=22~78. 핀스트라이프용 동적 좌표
  const stripeXs = calcStripeXs(22, 78, resolved.stripeGap);

  return (
    <Svg width={w} height={h} viewBox="-4 -4 104 100">
      <Defs>
        <ClipPath id={cid}><Path d={JERSEY} /></ClipPath>
      </Defs>

      {/* 드롭 쉐도우 */}
      <Path d={JERSEY}
        fill={`rgba(60,40,20,${resolved.shadowOpacity})`}
        translateX={resolved.shadowOffsetY * 0.8} translateY={resolved.shadowOffsetY} />

      {/* 클립 내부 레이어 */}
      <G clipPath={`url(#${cid})`}>
        <Path d={JERSEY} fill={resolved.bodyColor} />
        {/* V6.5 소매 배색 — 라글란형 반소매(목→어깨→소매끝→겨드랑이 y=48).
            clip으로 실루엣 보존, 몸통 위로 올라와도 무방. 숫자 영역(x40~60) 침범 안 함. */}
        {resolved.sleeveSplit && (
          <>
            <Path d="M 33,12 L 16,15 L 10,28 L 22,48 Z" fill={resolved.leftSleeveColor} />
            <Path d="M 67,12 L 84,15 L 90,28 L 78,48 Z" fill={resolved.rightSleeveColor} />
            {resolved.sleeveSeamOpacity > 0 && (
              <>
                <Line x1={22} y1={48} x2={33} y2={12}
                  stroke={resolved.sleeveSeamColor} strokeWidth={1.0}
                  opacity={resolved.sleeveSeamOpacity} strokeLinecap="round" />
                <Line x1={78} y1={48} x2={67} y2={12}
                  stroke={resolved.sleeveSeamColor} strokeWidth={1.0}
                  opacity={resolved.sleeveSeamOpacity} strokeLinecap="round" />
              </>
            )}
          </>
        )}
        {/* 파이핑 */}
        <Path d={JERSEY} fill="none"
          stroke={resolved.pipingColor} strokeWidth={resolved.pipingWidth} strokeLinejoin="round" />
        {/* 핀스트라이프 */}
        {resolved.stripeOpacity > 0 && stripeXs.map((x) => (
          <Line key={x} x1={x} y1={10} x2={x} y2={83}
            stroke={resolved.stripeColor} strokeWidth={resolved.stripeWidth}
            opacity={resolved.stripeOpacity} />
        ))}
      </G>

      {/* 외곽선 */}
      <Path d={JERSEY} fill="none"
        stroke={resolved.outerStrokeColor} strokeWidth={resolved.outerStrokeWidth}
        strokeLinejoin="round" />

      {/* 소매 커프 실밥 라인 */}
      <Path d="M 11,29 L 22,39" fill="none"
        stroke={resolved.cuffColor} strokeWidth={resolved.cuffWidth}
        strokeLinecap="round" opacity={resolved.cuffOpacity} />
      <Path d="M 78,39 L 89,29" fill="none"
        stroke={resolved.cuffColor} strokeWidth={resolved.cuffWidth}
        strokeLinecap="round" opacity={resolved.cuffOpacity} />

      {/* 숫자 그림자 (offset text) */}
      {resolved.numberShadowOpacity > 0 && (
        <SvgText
          x={50} y={y + 1.5}
          fontSize={fontSize} fontWeight="900"
          fill={resolved.numberShadowColor}
          opacity={resolved.numberShadowOpacity}
          textAnchor="middle" dominantBaseline="middle"
        >{score}</SvgText>
      )}
      {/* 숫자 외곽선 */}
      <SvgText
        x={50} y={y}
        fontSize={fontSize} fontWeight="900"
        fill="none"
        stroke={resolved.numberStroke} strokeWidth={resolved.numberStrokeWidth}
        strokeLinejoin="round"
        textAnchor="middle" dominantBaseline="middle"
      >{score}</SvgText>
      {/* 숫자 fill */}
      <SvgText
        x={50} y={y}
        fontSize={fontSize} fontWeight="900"
        fill={resolved.numberFill}
        textAnchor="middle" dominantBaseline="middle"
      >{score}</SvgText>
    </Svg>
  );
}

// ── 소형 배지 (compact) ───────────────────────────────────────────────────────
function CompactJersey({ score, cid, resolved }: {
  score: number; cid: string; resolved: ResolvedUniformStyle;
}) {
  const dc = digitCount(score);
  const { fontSize, y } = SCORE_TEXT.compact[dc];
  // 소형: 몸통 x=11~39
  const stripeXs = calcStripeXs(11, 39, resolved.stripeGap);

  return (
    <Svg width={48} height={53} viewBox="-3 -3 56 62">
      <Defs>
        <ClipPath id={cid}><Path d={JERSEY_SM} /></ClipPath>
      </Defs>

      <Path d={JERSEY_SM}
        fill={`rgba(60,40,20,${resolved.shadowOpacity})`}
        translateX={resolved.shadowOffsetY * 0.8} translateY={resolved.shadowOffsetY} />
      <G clipPath={`url(#${cid})`}>
        <Path d={JERSEY_SM} fill={resolved.bodyColor} />
        {/* V6.5 소매 배색 (compact: 라글란형, seam 생략, 색상만) */}
        {resolved.sleeveSplit && (
          <>
            <Path d="M 16,6 L 8,7 L 5,14 L 11,25 Z" fill={resolved.leftSleeveColor} />
            <Path d="M 34,6 L 42,7 L 45,14 L 39,25 Z" fill={resolved.rightSleeveColor} />
          </>
        )}
        <Path d={JERSEY_SM} fill="none"
          stroke={resolved.pipingColor} strokeWidth={resolved.pipingWidth} strokeLinejoin="round" />
        {resolved.stripeOpacity > 0 && stripeXs.map((x) => (
          <Line key={x} x1={x} y1={5} x2={x} y2={42}
            stroke={resolved.stripeColor} strokeWidth={resolved.stripeWidth}
            opacity={resolved.stripeOpacity} />
        ))}
      </G>
      <Path d={JERSEY_SM} fill="none"
        stroke={resolved.outerStrokeColor} strokeWidth={resolved.outerStrokeWidth}
        strokeLinejoin="round" />

      {/* 소매 커프 실밥 라인 */}
      <Path d="M 6,15 L 11,20" fill="none"
        stroke={resolved.cuffColor} strokeWidth={resolved.cuffWidth}
        strokeLinecap="round" opacity={resolved.cuffOpacity} />
      <Path d="M 39,20 L 44,15" fill="none"
        stroke={resolved.cuffColor} strokeWidth={resolved.cuffWidth}
        strokeLinecap="round" opacity={resolved.cuffOpacity} />

      {/* 숫자 그림자 */}
      {resolved.numberShadowOpacity > 0 && (
        <SvgText
          x={25} y={y + 1}
          fontSize={fontSize} fontWeight="900"
          fill={resolved.numberShadowColor}
          opacity={resolved.numberShadowOpacity}
          textAnchor="middle" dominantBaseline="middle"
        >{score}</SvgText>
      )}
      {/* 숫자 외곽선 */}
      <SvgText
        x={25} y={y}
        fontSize={fontSize} fontWeight="900"
        fill="none"
        stroke={resolved.numberStroke} strokeWidth={resolved.numberStrokeWidth * 0.7}
        strokeLinejoin="round"
        textAnchor="middle" dominantBaseline="middle"
      >{score}</SvgText>
      {/* 숫자 fill */}
      <SvgText
        x={25} y={y}
        fontSize={fontSize} fontWeight="900"
        fill={resolved.numberFill}
        textAnchor="middle" dominantBaseline="middle"
      >{score}</SvgText>
    </Svg>
  );
}

// ── 공개 컴포넌트 ─────────────────────────────────────────────────────────────
export default function JerseyScoreBadge({
  score, variant = 'hero', homeTeamColor, teamColor, uniformPreset, showLabel = true,
}: Props) {
  const [cid] = useState<string>(() => `jsb_${++_seq}`);
  const { preset: contextPreset } = useUniformPreset();
  const tc = badgeColor(homeTeamColor ?? teamColor ?? colors.accent);
  const config = UNIFORM_PRESETS[uniformPreset ?? contextPreset];
  const resolved = resolveUniformPreset(config, tc, variant);

  if (variant === 'compact') {
    return <CompactJersey score={score} cid={cid} resolved={resolved} />;
  }

  // hero: 88×85 / detail: 110×106  (viewBox 104:100 = 1.04 비율)
  const [w, h] = variant === 'detail' ? [110, 106] : [88, 85];
  return (
    <View style={{ alignItems: 'center', gap: 5 }}>
      {showLabel && <GguljamScoreLabel variant={variant} />}
      <LargeJersey score={score} cid={cid} w={w} h={h} variant={variant} resolved={resolved} />
    </View>
  );
}
