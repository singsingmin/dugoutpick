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

// ── 대형 유니폼 실루엣 (뒷면 백넘버, 자연스러운 대각 소매) ──────────────────
// body: x=26~74 (48 wide), y=45~89 (44 tall), center=67 / viewBox -4 -4 104 100
// 소매: 어깨→외곽 끝(~63°) → 커프(~35°) → 겨드랑이 순서로 자연스럽게 하향
const JERSEY =
  'M 38,6' +
  ' Q 22,7 10,14' +      // 왼쪽 어깨 사선 (목→어깨 접합점)
  ' L 2,30' +            // 왼쪽 소매 외곽 (대각 하향 ~63°)
  ' L 16,40' +           // 왼쪽 소매 커프 (내측으로 ~35°)
  ' Q 18,44 26,45' +     // 왼쪽 겨드랑이 곡선
  ' L 26,84' +           // 왼쪽 몸통
  ' Q 26,89 32,89' +     // 왼쪽 밑단 모서리
  ' L 68,89' +           // 밑단
  ' Q 74,89 74,84' +     // 오른쪽 밑단 모서리
  ' L 74,45' +           // 오른쪽 몸통
  ' Q 82,44 84,40' +     // 오른쪽 겨드랑이 곡선
  ' L 98,30' +           // 오른쪽 소매 커프 (대칭)
  ' L 90,14' +           // 오른쪽 소매 외곽 (어깨 접합점으로)
  ' Q 78,7 62,6' +       // 오른쪽 어깨 사선
  ' Q 50,13 38,6 Z';     // 뒷목 칼라 (얕은 U)

// ── 소형 유니폼 실루엣 (뒷면 백넘버, 자연스러운 대각 소매) ──────────────────
// body: x=14~36 (22 wide), y=27~51 (24 tall), center=39 / viewBox -3 -3 56 62
const JERSEY_SM =
  'M 18,4' +
  ' Q 11,5 6,8' +        // 왼쪽 어깨 사선
  ' L 0,18' +            // 왼쪽 소매 외곽 (대각 하향)
  ' L 8,23' +            // 왼쪽 소매 커프
  ' Q 10,26 14,27' +     // 왼쪽 겨드랑이
  ' L 14,46' +           // 왼쪽 몸통
  ' Q 14,51 18,51' +     // 왼쪽 밑단 모서리
  ' L 32,51' +           // 밑단
  ' Q 36,51 36,46' +     // 오른쪽 밑단 모서리
  ' L 36,27' +           // 오른쪽 몸통
  ' Q 40,26 42,23' +     // 오른쪽 겨드랑이
  ' L 50,18' +           // 오른쪽 소매 커프 (대칭)
  ' L 44,8' +            // 오른쪽 소매 외곽
  ' Q 39,5 32,4' +       // 오른쪽 어깨 사선
  ' Q 25,10 18,4 Z';     // 뒷목 칼라

let _seq = 0;

function digitCount(score: number): 1 | 2 | 3 {
  const d = String(score).length;
  return d >= 3 ? 3 : d === 2 ? 2 : 1;
}

// ── 숫자 위치·크기 테이블 ────────────────────────────────────────────────────
// dominantBaseline="middle" → y = 시각 중심
// 대형 body center=67 (y=45~89) → target y≈65 (살짝 위)
// 소형 body center=39 (y=27~51) → target y≈38 (살짝 위)
const SCORE_TEXT = {
  hero: {
    1: { fontSize: 44, y: 65 },
    2: { fontSize: 38, y: 64 },
    3: { fontSize: 32, y: 63 },
  },
  detail: {
    1: { fontSize: 44, y: 65 },
    2: { fontSize: 38, y: 64 },
    3: { fontSize: 32, y: 63 },
  },
  compact: {
    1: { fontSize: 20, y: 38 },
    2: { fontSize: 16, y: 37 },
    3: { fontSize: 13, y: 36 },
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
        {/* 핀스트라이프 */}
        {STRIPES.map((x) => (
          <Line key={x} x1={x} y1={10} x2={x} y2={87}
            stroke={CREAM} strokeWidth={0.5} opacity={0.08} />
        ))}
        {/* 요크/패널 라인 — 어깨 아래 야구 유니폼 뒷면 패널 경계 */}
        <Path d="M 22,50 Q 50,47 78,50"
          fill="none" stroke={CREAM} strokeWidth={1.0} opacity={0.10} />
        {/* 네임패치 영역 힌트 — 텍스트 없이 위치만 암시 */}
        <Path d="M 34,56 Q 50,54 66,56"
          fill="none" stroke={CREAM} strokeWidth={0.7} opacity={0.07} />
      </G>

      {/* 극히 얇은 외곽선 — 형태 구분 최소한만 */}
      <Path d={JERSEY} fill="none"
        stroke={BORDER_COLOR} strokeWidth={2.5} strokeLinejoin="round" opacity={0.32} />

      {/* 소매 커프 파이핑 (커프 방향에 나란히 배치) */}
      <Path d="M 4,32 L 14,38" fill="none"
        stroke={CREAM} strokeWidth={1.8} strokeLinecap="round" opacity={0.60} />
      <Path d="M 86,38 L 96,32" fill="none"
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
      <Path d="M 1,19 L 7,22" fill="none"
        stroke={CREAM} strokeWidth={1} strokeLinecap="round" opacity={0.56} />
      <Path d="M 43,22 L 49,19" fill="none"
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
