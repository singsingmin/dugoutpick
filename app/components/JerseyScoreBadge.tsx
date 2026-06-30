// 오늘야구각 전용 유니폼 배지 — 꿀잼지수 시그니처 UI
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

const BORDER = '#211810';  // 짙은 다크 브라운 (pure black보다 부드러움)
const CREAM = '#F5EDDA';   // 크림 (숫자·파이핑·디테일 공통)

// ─── 유니폼 실루엣 ───────────────────────────────────────────────────────────
// 개선된 귀여운 비율: 어깨 좁힘(x=6→94), 소매 짧게(y=40), 밑단 살짝 테이퍼(23/77)
// 논리 좌표: x 6~94, y 6~112  /  뷰박스: -5 -5 110 122 (stroke 5px 여백)
const JERSEY =
  `M 34,6 L 6,18 L 6,40 L 22,43 L 23,112 L 77,112 L 78,43 L 94,40 L 94,18 L 66,6 Q 50,24 34,6 Z`;

// compact 소형 — 동일 비율 축소
// 논리 좌표: x 3~47, y 4~55  /  뷰박스: -4 -4 56 64 (stroke 4px 여백)
const JERSEY_SM =
  `M 17,4 L 3,10 L 3,21 L 11,23 L 12,55 L 38,55 L 39,23 L 47,21 L 47,10 L 33,4 Q 25,13 17,4 Z`;

let _seq = 0;

// 자릿수별 폰트 크기 — compact는 별도 고정값
function numFs(score: number, base: number, compact = false): number {
  const d = String(score).length;
  if (compact) {
    if (d >= 3) return 12;
    if (d === 2) return 17;
    return 22;
  }
  if (d >= 3) return base - 14;
  if (d === 2) return base - 6;
  return base;
}

// 폰트 크기에 맞춰 숫자 베이스라인 계산 → 시각적 중심이 bodyCenter보다 살짝 아래
function numY(fs: number, bodyCenter: number): number {
  return Math.round(bodyCenter + 0.38 * fs);
}

// ─── 대형 배지 (hero / detail) ────────────────────────────────────────────────
function LargeJersey({ score, tc, cid, w, h }: {
  score: number; tc: string; cid: string; w: number; h: number;
}) {
  const fs = numFs(score, 50);
  // body y=43~112, center=77.5 → 살짝 아래 79 기준
  const scoreY = numY(fs, 79);
  // 핀스트라이프: body x=22~78 사이 7개 선
  const STRIPES = [29, 37, 45, 53, 61, 69, 77];

  return (
    <Svg width={w} height={h} viewBox="-5 -5 110 122">
      <Defs>
        <ClipPath id={cid}><Path d={JERSEY} /></ClipPath>
      </Defs>

      {/* 드롭 쉐도우 */}
      <Path d={JERSEY} fill="rgba(0,0,0,0.13)" translateX={3} translateY={4} />

      {/* 다크 외곽 테두리 */}
      <Path d={JERSEY} fill="none" stroke={BORDER} strokeWidth={10} strokeLinejoin="round" />

      {/* 클립 내부 레이어 */}
      <G clipPath={`url(#${cid})`}>
        {/* 팀 컬러 본체 */}
        <Path d={JERSEY} fill={tc} />
        {/* 크림 파이핑 (칼라·소매·외곽 자동 처리) */}
        <Path d={JERSEY} fill="none" stroke={CREAM} strokeWidth={7} strokeLinejoin="round" />
        {/* 핀스트라이프 (아주 은은하게) */}
        {STRIPES.map((x) => (
          <Line key={x} x1={x} y1={43} x2={x} y2={112}
            stroke={CREAM} strokeWidth={0.6} opacity={0.10} />
        ))}
        {/* 중앙 버튼 라인 */}
        <Line x1={50} y1={49} x2={50} y2={109}
          stroke={CREAM} strokeWidth={0.8} opacity={0.14} />
        {/* 가슴 포인트 마크 (작은 다이아몬드) */}
        <Path d="M 50,47 L 53,51 L 50,55 L 47,51 Z" fill={CREAM} opacity={0.20} />
      </G>

      {/* 소매 끝단 트림 */}
      <Path d="M 7,32 L 21,35" fill="none" stroke={CREAM} strokeWidth={2} strokeLinecap="round" opacity={0.68} />
      <Path d="M 79,35 L 93,32" fill="none" stroke={CREAM} strokeWidth={2} strokeLinecap="round" opacity={0.68} />

      {/* 등번호 — 평면 패치 스타일, 얇은 아웃라인 1겹 */}
      <SvgText
        x={50} y={scoreY}
        fontSize={fs} fontWeight="900"
        fill="none"
        stroke="rgba(0,0,0,0.28)" strokeWidth={3} strokeLinejoin="round"
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

// ─── 소형 배지 (compact / list) ───────────────────────────────────────────────
function CompactJersey({ score, tc, cid }: { score: number; tc: string; cid: string }) {
  const fs = numFs(score, 0, true);
  // body y=23~55, center=39 → 살짝 아래 41 기준
  const scoreY = numY(fs, 41);

  return (
    <Svg width={48} height={55} viewBox="-4 -4 56 64">
      <Defs>
        <ClipPath id={cid}><Path d={JERSEY_SM} /></ClipPath>
      </Defs>

      <Path d={JERSEY_SM} fill="rgba(0,0,0,0.11)" translateX={2} translateY={2} />
      <Path d={JERSEY_SM} fill="none" stroke={BORDER} strokeWidth={7} strokeLinejoin="round" />
      <G clipPath={`url(#${cid})`}>
        <Path d={JERSEY_SM} fill={tc} />
        <Path d={JERSEY_SM} fill="none" stroke={CREAM} strokeWidth={4} strokeLinejoin="round" />
      </G>

      {/* 소매 트림 */}
      <Path d="M 3,17 L 10,19" fill="none" stroke={CREAM} strokeWidth={1.2} strokeLinecap="round" opacity={0.62} />
      <Path d="M 40,19 L 47,17" fill="none" stroke={CREAM} strokeWidth={1.2} strokeLinecap="round" opacity={0.62} />

      {/* 숫자만 — 텍스트 없음 */}
      <SvgText
        x={25} y={scoreY}
        fontSize={fs} fontWeight="900"
        fill="none"
        stroke="rgba(0,0,0,0.24)" strokeWidth={2} strokeLinejoin="round"
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
  const tc = homeTeamColor ?? teamColor ?? colors.accent;

  if (variant === 'compact') {
    return <CompactJersey score={score} tc={tc} cid={cid} />;
  }

  const [w, h] = variant === 'detail' ? [110, 122] : [88, 98];
  return <LargeJersey score={score} tc={tc} cid={cid} w={w} h={h} />;
}
