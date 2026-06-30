// 오늘야구각 전용 유니폼 배지 v5 — 귀여운 키링/아크릴 굿즈 배지 스타일
// hero=추천카드  compact=리스트  detail=상세화면
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Path, Defs, ClipPath, G, Text as SvgText, Line } from 'react-native-svg';
import { colors } from '../theme';
import GguljamScoreLabel from './GguljamScoreLabel';

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

// ── 대형 유니폼 실루엣 (뒷면 백넘버) ─────────────────────────────────────────
// viewBox -4 -4 104 100
// 어깨 접합: x=18/82 (y=15), 소매 끝: x=12/88 (y=28), 커프: x=22/78 (y=36)
// 소매: 어깨에서 13↓ 6← (주로 하향), 커프: 10→ 8↓ (안쪽으로 수렴)
// body: x=32~68 (36 wide), y=44~86 (42 tall), center x=50 y=65
const JERSEY =
  'M 40,4' +
  ' Q 50,12 60,4' +      // 뒷목 칼라 U
  ' Q 74,4 82,15' +      // 오른쪽 어깨 (칼라→접합점, 완만한 곡선)
  ' L 88,28' +           // 오른쪽 소매 외곽 끝 (6→ 13↓ — 주로 하향)
  ' L 78,36' +           // 오른쪽 소매 커프 (10← 8↓ — 안쪽 수렴)
  ' Q 74,42 68,44' +     // 오른쪽 겨드랑이 곡선
  ' L 68,86' +           // 오른쪽 몸통
  ' Q 68,92 62,92' +     // 오른쪽 밑단 모서리
  ' L 38,92' +           // 밑단
  ' Q 32,92 32,86' +     // 왼쪽 밑단 모서리
  ' L 32,44' +           // 왼쪽 몸통
  ' Q 26,42 22,36' +     // 왼쪽 겨드랑이 곡선
  ' L 12,28' +           // 왼쪽 소매 커프
  ' L 18,15' +           // 왼쪽 소매 외곽 끝 (어깨 접합점으로)
  ' Q 26,4 40,4 Z';      // 왼쪽 어깨 (접합점→칼라)

// ── 소형 유니폼 실루엣 (뒷면 백넘버) ─────────────────────────────────────────
// viewBox -3 -3 56 62
// 어깨 접합: x=6/44 (y=10), 소매 끝: x=2/48 (y=19), 커프: x=10/40 (y=24)
// body: x=14~36 (22 wide), y=28~48 (20 tall), center x=25 y=38
const JERSEY_SM =
  'M 20,3' +
  ' Q 25,8 30,3' +       // 뒷목 칼라 U
  ' Q 38,3 44,10' +      // 오른쪽 어깨
  ' L 48,19' +           // 오른쪽 소매 외곽 끝 (4→ 9↓ — 주로 하향)
  ' L 40,24' +           // 오른쪽 소매 커프 (8← 5↓)
  ' Q 38,27 36,28' +     // 오른쪽 겨드랑이
  ' L 36,48' +           // 오른쪽 몸통
  ' Q 36,52 32,52' +     // 오른쪽 밑단 모서리
  ' L 18,52' +           // 밑단
  ' Q 14,52 14,48' +     // 왼쪽 밑단 모서리
  ' L 14,28' +           // 왼쪽 몸통
  ' Q 12,27 10,24' +     // 왼쪽 겨드랑이
  ' L 2,19' +            // 왼쪽 소매 커프
  ' L 6,10' +            // 왼쪽 소매 외곽 끝
  ' Q 12,3 20,3 Z';      // 왼쪽 어깨

let _seq = 0;

function digitCount(score: number): 1 | 2 | 3 {
  const d = String(score).length;
  return d >= 3 ? 3 : d === 2 ? 2 : 1;
}

// ── 숫자 위치·크기 테이블 ────────────────────────────────────────────────────
// dominantBaseline="middle" → y = 시각 중심
// 대형 body center=65 (y=44~86) → target y≈64 (살짝 위)
// 소형 body center=38 (y=28~48) → target y≈37 (살짝 위)
const SCORE_TEXT = {
  hero: {
    1: { fontSize: 44, y: 64 },
    2: { fontSize: 38, y: 63 },
    3: { fontSize: 30, y: 62 },
  },
  detail: {
    1: { fontSize: 44, y: 64 },
    2: { fontSize: 38, y: 63 },
    3: { fontSize: 30, y: 62 },
  },
  compact: {
    1: { fontSize: 20, y: 37 },
    2: { fontSize: 16, y: 36 },
    3: { fontSize: 13, y: 35 },
  },
} as const;

// ── 대형 배지 (hero / detail) ─────────────────────────────────────────────────
function LargeJersey({ score, tc, cid, w, h, variant }: {
  score: number; tc: string; cid: string; w: number; h: number;
  variant: 'hero' | 'detail';
}) {
  const dc = digitCount(score);
  const { fontSize, y } = SCORE_TEXT[variant][dc];
  const STRIPES = [36, 43, 50, 57, 64];

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
        {/* 핀스트라이프 */}
        {STRIPES.map((x) => (
          <Line key={x} x1={x} y1={14} x2={x} y2={90}
            stroke={CREAM} strokeWidth={0.5} opacity={0.08} />
        ))}
        {/* 요크/패널 라인 */}
        <Path d="M 30,54 Q 50,51 70,54"
          fill="none" stroke={CREAM} strokeWidth={1.0} opacity={0.10} />
        {/* 네임패치 영역 힌트 */}
        <Path d="M 36,62 Q 50,60 64,62"
          fill="none" stroke={CREAM} strokeWidth={0.7} opacity={0.07} />
      </G>

      {/* 극히 얇은 외곽선 — 형태 구분 최소한만 */}
      <Path d={JERSEY} fill="none"
        stroke={BORDER_COLOR} strokeWidth={2.5} strokeLinejoin="round" opacity={0.32} />

      {/* 소매 커프 파이핑 (커프 안쪽 방향에 나란히) */}
      <Path d="M 14,29 L 22,37" fill="none"
        stroke={CREAM} strokeWidth={1.8} strokeLinecap="round" opacity={0.60} />
      <Path d="M 78,37 L 86,29" fill="none"
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

      {/* 소매 커프 트림 */}
      <Path d="M 4,20 L 10,25" fill="none"
        stroke={CREAM} strokeWidth={1} strokeLinecap="round" opacity={0.56} />
      <Path d="M 40,25 L 46,20" fill="none"
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
  return (
    <View style={{ alignItems: 'center', gap: 5 }}>
      <GguljamScoreLabel variant={variant} />
      <LargeJersey score={score} tc={tc} cid={cid} w={w} h={h} variant={variant} />
    </View>
  );
}
