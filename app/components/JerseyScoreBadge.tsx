// 오늘야구각 전용 유니폼 배지 — 귀여운 키링/아크릴 굿즈 배지 스타일
// hero=추천카드, compact=리스트, detail=상세화면
import { useState } from 'react';
import Svg, { Path, Defs, ClipPath, G, Text as SvgText, Line } from 'react-native-svg';
import { colors } from '../theme';

interface Props {
  score: number;
  variant?: 'hero' | 'compact' | 'detail';
  homeTeamColor?: string;
  teamColor?: string;  // 하위 호환
}

// 아크릴 키링 테두리: 따뜻한 실버/크림 (thick black 대신)
const BORDER = '#211810';
const CREAM = '#F5EDDA';

// ─── 유니폼 실루엣 v4 ─────────────────────────────────────────────────────────
// 목표: 짧고 넓은 귀여운 키링 비율 (≈정방형)
// 어깨 8→92 (84 wide), 소매 16→32 (짧음), 몸통 35→85 (50 tall)
// 전체: 84×80 ≈ 정방형  /  viewBox: -5 -5 110 100
const JERSEY =
  `M 35,5 L 8,16 L 8,32 L 22,35 L 23,85 L 77,85 L 78,35 L 92,32 L 92,16 L 65,5 Q 50,20 35,5 Z`;

// compact 소형 — 동일 비율 축소, 몸통 24→50 (26 tall)
// 전체: 44×47  /  viewBox: -4 -4 56 59
const JERSEY_SM =
  `M 17,3 L 3,10 L 3,22 L 11,24 L 12,50 L 38,50 L 39,24 L 47,22 L 47,10 L 33,3 Q 25,11 17,3 Z`;

let _seq = 0;

// 팀 컬러를 배지용으로 보정: 너무 밝은 색 → 살짝 어둡게
function badgeColor(hex: string): string {
  if (!hex || !hex.startsWith('#') || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  // 밝은 색(>120): 15% 어둡게 / 중간(>60): 5% 어둡게 / 어두운 색: 그대로
  const k = luma > 120 ? 0.85 : luma > 60 ? 0.95 : 1.0;
  const nr = Math.min(255, Math.round(r * k));
  const ng = Math.min(255, Math.round(g * k));
  const nb = Math.min(255, Math.round(b * k));
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

// 자릿수별 폰트 크기
function numFs(score: number, base: number, compact = false): number {
  const d = String(score).length;
  if (compact) {
    if (d >= 3) return 13;
    if (d === 2) return 18;
    return 23;
  }
  if (d >= 3) return base - 10;
  if (d === 2) return base - 6;
  return base;
}

// 숫자 베이스라인: 시각 중심이 target_y에 오도록
function numBaseY(fs: number, targetY: number): number {
  return Math.round(targetY + 0.38 * fs);
}

// ─── 대형 배지 (hero / detail) ────────────────────────────────────────────────
// body y=35~85 (50 tall), center=60, target=57 (살짝 위)
function LargeJersey({ score, tc, cid, w, h }: {
  score: number; tc: string; cid: string; w: number; h: number;
}) {
  const fs = numFs(score, 50);
  const scoreY = numBaseY(fs, 57);   // 살짝 위 (center=60, target=57)
  const STRIPES = [29, 37, 45, 53, 61, 69, 77];

  return (
    <Svg width={w} height={h} viewBox="-5 -5 110 100">
      <Defs>
        <ClipPath id={cid}><Path d={JERSEY} /></ClipPath>
      </Defs>

      {/* 부드러운 드롭 쉐도우 */}
      <Path d={JERSEY} fill="rgba(0,0,0,0.12)" translateX={2} translateY={3} />

      {/* 클립 내부 */}
      <G clipPath={`url(#${cid})`}>
        {/* 팀 컬러 본체 */}
        <Path d={JERSEY} fill={tc} />
        {/* 크림 파이핑 — 외형 구분 역할도 겸함 */}
        <Path d={JERSEY} fill="none" stroke={CREAM} strokeWidth={7} strokeLinejoin="round" />
        {/* 핀스트라이프 */}
        {STRIPES.map((x) => (
          <Line key={x} x1={x} y1={35} x2={x} y2={85}
            stroke={CREAM} strokeWidth={0.6} opacity={0.09} />
        ))}
        {/* 중앙 버튼 라인 */}
        <Line x1={50} y1={40} x2={50} y2={82}
          stroke={CREAM} strokeWidth={0.8} opacity={0.13} />
        {/* 가슴 포인트 마크 */}
        <Path d="M 50,40 L 53,44 L 50,48 L 47,44 Z" fill={CREAM} opacity={0.18} />
      </G>

      {/* 얇은 외곽 테두리 (두꺼운 검은 선 대신 아주 얇게) */}
      <Path d={JERSEY} fill="none"
        stroke={BORDER} strokeWidth={3} strokeLinejoin="round" opacity={0.40} />

      {/* 소매 끝단 파이핑 */}
      <Path d="M 9,26 L 21,29" fill="none"
        stroke={CREAM} strokeWidth={2} strokeLinecap="round" opacity={0.65} />
      <Path d="M 79,29 L 91,26" fill="none"
        stroke={CREAM} strokeWidth={2} strokeLinecap="round" opacity={0.65} />

      {/* 등번호 — 크림 fill + 아주 얇은 다크 아웃라인 1겹 */}
      <SvgText
        x={50} y={scoreY}
        fontSize={fs} fontWeight="900"
        fill="none"
        stroke="rgba(0,0,0,0.30)" strokeWidth={3.5} strokeLinejoin="round"
        textAnchor="middle"
      >{score}</SvgText>
      <SvgText
        x={50} y={scoreY}
        fontSize={fs} fontWeight="900"
        fill={CREAM} textAnchor="middle"
      >{score}</SvgText>
    </Svg>
  );
}

// ─── 소형 배지 (compact) ───────────────────────────────────────────────────────
// body y=24~50 (26 tall), center=37, target=35 (살짝 위)
function CompactJersey({ score, tc, cid }: { score: number; tc: string; cid: string }) {
  const fs = numFs(score, 0, true);
  const scoreY = numBaseY(fs, 35);   // 살짝 위 (center=37, target=35)

  return (
    <Svg width={48} height={51} viewBox="-4 -4 56 59">
      <Defs>
        <ClipPath id={cid}><Path d={JERSEY_SM} /></ClipPath>
      </Defs>

      <Path d={JERSEY_SM} fill="rgba(0,0,0,0.10)" translateX={1} translateY={2} />
      <G clipPath={`url(#${cid})`}>
        <Path d={JERSEY_SM} fill={tc} />
        <Path d={JERSEY_SM} fill="none" stroke={CREAM} strokeWidth={4} strokeLinejoin="round" />
      </G>
      {/* 외곽선: compact는 더 얇게 */}
      <Path d={JERSEY_SM} fill="none"
        stroke={BORDER} strokeWidth={2} strokeLinejoin="round" opacity={0.35} />

      {/* 소매 트림 */}
      <Path d="M 4,17 L 10,19" fill="none"
        stroke={CREAM} strokeWidth={1.2} strokeLinecap="round" opacity={0.60} />
      <Path d="M 40,19 L 46,17" fill="none"
        stroke={CREAM} strokeWidth={1.2} strokeLinecap="round" opacity={0.60} />

      {/* 숫자 */}
      <SvgText
        x={25} y={scoreY}
        fontSize={fs} fontWeight="900"
        fill="none"
        stroke="rgba(0,0,0,0.27)" strokeWidth={2.5} strokeLinejoin="round"
        textAnchor="middle"
      >{score}</SvgText>
      <SvgText
        x={25} y={scoreY}
        fontSize={fs} fontWeight="900"
        fill={CREAM} textAnchor="middle"
      >{score}</SvgText>
    </Svg>
  );
}

// ─── 공개 컴포넌트 ────────────────────────────────────────────────────────────
export default function JerseyScoreBadge({ score, variant = 'hero', homeTeamColor, teamColor }: Props) {
  const [cid] = useState<string>(() => `jsb_${++_seq}`);
  const rawColor = homeTeamColor ?? teamColor ?? colors.accent;
  const tc = badgeColor(rawColor);  // 배지용 컬러 보정

  if (variant === 'compact') {
    return <CompactJersey score={score} tc={tc} cid={cid} />;
  }

  // hero: 88×80 (정방형 근사), detail: 110×100
  const [w, h] = variant === 'detail' ? [110, 100] : [88, 80];
  return <LargeJersey score={score} tc={tc} cid={cid} w={w} h={h} />;
}
