// 오늘야구각 전용 유니폼 배지 v5 — 귀여운 키링/아크릴 굿즈 배지 스타일
// hero=추천카드  compact=리스트  detail=상세화면
import { useState } from 'react';
import Svg, { Path, Defs, ClipPath, G, Text as SvgText, Line } from 'react-native-svg';
import { colors } from '../theme';

interface Props {
  score: number;
  variant?: 'hero' | 'compact' | 'detail';
  homeTeamColor?: string;
  teamColor?: string;  // 하위 호환
}

const CREAM = '#F5EDDA';
const BORDER_COLOR = '#2A201A';   // 짙은 다크 브라운 (pure black 아님)

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

// ── 대형 유니폼 실루엣 ────────────────────────────────────────────────────────
// 귀여운 비율 + 모든 코너 Q 곡선으로 부드럽게
// x: 8~92 (84 wide), y: 6~89 (83 tall) / viewBox -4 -4 104 100
// 몸통 body: y=40~89 (49 tall), center=64.5
const JERSEY =
  'M 36,6' +
  ' Q 22,9 8,18' +       // 왼쪽 어깨 곡선
  ' L 8,30' +            // 왼쪽 소매 (짧게)
  ' Q 8,37 20,40' +      // 왼쪽 겨드랑이 곡선
  ' L 23,84' +           // 왼쪽 몸통 (살짝 테이퍼)
  ' Q 23,89 29,89' +     // 왼쪽 밑단 모서리 둥글게
  ' L 71,89' +           // 밑단
  ' Q 77,89 77,84' +     // 오른쪽 밑단 모서리 둥글게
  ' L 80,40' +           // 오른쪽 몸통
  ' Q 92,37 92,30' +     // 오른쪽 겨드랑이 곡선
  ' L 92,18' +           // 오른쪽 소매
  ' Q 78,9 64,6' +       // 오른쪽 어깨 곡선
  ' Q 50,21 36,6 Z';     // 칼라 U곡선

// ── 소형 유니폼 실루엣 ────────────────────────────────────────────────────────
// x: 3~47 (44 wide), y: 4~51 (47 tall) / viewBox -3 -3 56 62
// 몸통 body: y=25~51 (26 tall), center=38
const JERSEY_SM =
  'M 18,4' +
  ' Q 11,6 3,11' +
  ' L 3,20' +
  ' Q 3,24 11,25' +
  ' L 12,47' +
  ' Q 12,51 17,51' +
  ' L 33,51' +
  ' Q 38,51 38,47' +
  ' L 39,25' +
  ' Q 47,24 47,20' +
  ' L 47,11' +
  ' Q 39,6 32,4' +
  ' Q 25,13 18,4 Z';

let _seq = 0;

function digitCount(score: number): 1 | 2 | 3 {
  const d = String(score).length;
  return d >= 3 ? 3 : d === 2 ? 2 : 1;
}

// ── 숫자 위치·크기 테이블 ────────────────────────────────────────────────────
// dominantBaseline="middle" 사용 → y = 텍스트 시각 중심 (baseline 추정 불필요)
// 대형 body center=64.5 → target y≈61 (살짝 위)
// 소형 body center=38   → target y≈35 (살짝 위)
// Android APK 확인 후 y값 수동 튜닝 가능
const SCORE_TEXT = {
  hero: {
    1: { fontSize: 44, y: 61 },
    2: { fontSize: 38, y: 60 },
    3: { fontSize: 32, y: 59 },
  },
  detail: {
    1: { fontSize: 44, y: 61 },
    2: { fontSize: 38, y: 60 },
    3: { fontSize: 32, y: 59 },
  },
  compact: {
    1: { fontSize: 20, y: 36 },
    2: { fontSize: 16, y: 35 },
    3: { fontSize: 13, y: 34 },
  },
} as const;

// ── 대형 배지 (hero / detail) ─────────────────────────────────────────────────
function LargeJersey({ score, tc, cid, w, h, variant }: {
  score: number; tc: string; cid: string; w: number; h: number;
  variant: 'hero' | 'detail';
}) {
  const dc = digitCount(score);
  const { fontSize, y } = SCORE_TEXT[variant][dc];
  const STRIPES = [31, 39, 47, 55, 63, 71];

  return (
    <Svg width={w} height={h} viewBox="-4 -4 104 100">
      <Defs>
        <ClipPath id={cid}><Path d={JERSEY} /></ClipPath>
      </Defs>

      {/* 은은한 드롭 쉐도우 — 웜그레이 */}
      <Path d={JERSEY} fill="rgba(60,40,20,0.14)" translateX={2} translateY={3} />

      {/* 클립 내부 레이어 */}
      <G clipPath={`url(#${cid})`}>
        <Path d={JERSEY} fill={tc} />
        {/* 크림 파이핑 (칼라·소매·몸통 외형 동시 처리) */}
        <Path d={JERSEY} fill="none" stroke={CREAM} strokeWidth={6} strokeLinejoin="round" />
        {/* 핀스트라이프 — y1=10으로 위로 올려서 전체 몸통에 걸치게 (clip이 알아서 자름) */}
        {STRIPES.map((x) => (
          <Line key={x} x1={x} y1={10} x2={x} y2={87}
            stroke={CREAM} strokeWidth={0.5} opacity={0.08} />
        ))}
        {/* 중앙 버튼 라인 */}
        <Line x1={50} y1={22} x2={50} y2={86}
          stroke={CREAM} strokeWidth={0.7} opacity={0.11} />
      </G>

      {/* 극히 얇은 외곽선 — 형태 구분 최소한만 */}
      <Path d={JERSEY} fill="none"
        stroke={BORDER_COLOR} strokeWidth={2.5} strokeLinejoin="round" opacity={0.32} />

      {/* 소매 끝단 파이핑 */}
      <Path d="M 9,26 L 19,29" fill="none"
        stroke={CREAM} strokeWidth={1.8} strokeLinecap="round" opacity={0.60} />
      <Path d="M 81,29 L 91,26" fill="none"
        stroke={CREAM} strokeWidth={1.8} strokeLinecap="round" opacity={0.60} />

      {/* 등번호 — dominantBaseline="middle"로 y=시각 중심 */}
      <SvgText
        x={50} y={y}
        fontSize={fontSize} fontWeight="900"
        fill="none"
        stroke="rgba(0,0,0,0.26)" strokeWidth={4} strokeLinejoin="round"
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
function CompactJersey({ score, tc, cid }: { score: number; tc: string; cid: string }) {
  const dc = digitCount(score);
  const { fontSize, y } = SCORE_TEXT.compact[dc];

  return (
    <Svg width={48} height={53} viewBox="-3 -3 56 62">
      <Defs>
        <ClipPath id={cid}><Path d={JERSEY_SM} /></ClipPath>
      </Defs>

      <Path d={JERSEY_SM} fill="rgba(60,40,20,0.12)" translateX={1} translateY={2} />
      <G clipPath={`url(#${cid})`}>
        <Path d={JERSEY_SM} fill={tc} />
        <Path d={JERSEY_SM} fill="none" stroke={CREAM} strokeWidth={4} strokeLinejoin="round" />
      </G>
      <Path d={JERSEY_SM} fill="none"
        stroke={BORDER_COLOR} strokeWidth={1.5} strokeLinejoin="round" opacity={0.28} />

      {/* 소매 트림 */}
      <Path d="M 4,17 L 10,18" fill="none"
        stroke={CREAM} strokeWidth={1} strokeLinecap="round" opacity={0.56} />
      <Path d="M 40,18 L 46,17" fill="none"
        stroke={CREAM} strokeWidth={1} strokeLinecap="round" opacity={0.56} />

      {/* 숫자 */}
      <SvgText
        x={25} y={y}
        fontSize={fontSize} fontWeight="900"
        fill="none"
        stroke="rgba(0,0,0,0.25)" strokeWidth={3} strokeLinejoin="round"
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
export default function JerseyScoreBadge({ score, variant = 'hero', homeTeamColor, teamColor }: Props) {
  const [cid] = useState<string>(() => `jsb_${++_seq}`);
  const tc = badgeColor(homeTeamColor ?? teamColor ?? colors.accent);

  if (variant === 'compact') {
    return <CompactJersey score={score} tc={tc} cid={cid} />;
  }

  // hero: 88×85 / detail: 110×106  (viewBox 104:100 = 1.04 비율)
  const [w, h] = variant === 'detail' ? [110, 106] : [88, 85];
  return <LargeJersey score={score} tc={tc} cid={cid} w={w} h={h} variant={variant} />;
}
