// 아크릴 유니폼 배지 스타일 꿀잼지수 (오늘야구각 전용 디자인)
// hero=추천카드 대형, compact=리스트 소형, detail=상세화면 대형
import { useState } from 'react';
import Svg, { Path, Defs, ClipPath, G, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme';

interface Props {
  score: number;
  variant?: 'hero' | 'compact' | 'detail';
  teamColor?: string;
}

const BORDER = '#1C1610';   // 키링 외곽선 — 짙은 다크
const CREAM = '#F5EDDA';    // 크림 파이핑

// 유니폼 실루엣 — viewBox "-7 -7 114 129" (stroke 7px 여백 포함)
// 라운드 칼라 (Q 곡선), 귀여운 짧은 소매
const JERSEY =
  `M 32,6 L 0,20 L 0,44 L 22,47 L 22,115 L 78,115 L 78,47 L 100,44 L 100,20 L 68,6 Q 50,28 32,6 Z`;

// compact 소형 유니폼 — viewBox "-5 -5 60 68" (stroke 5px 여백)
const JERSEY_SM =
  `M 16,3 L 0,10 L 0,22 L 11,24 L 11,58 L 39,58 L 39,24 L 50,22 L 50,10 L 34,3 Q 25,14 16,3 Z`;

let _seq = 0;

function numFs(score: number, base: number): number {
  const d = String(score).length;
  if (d >= 3) return base - 14;
  if (d === 2) return base - 6;
  return base;
}

function LargeJersey({ score, tc, cid, w, h }: {
  score: number; tc: string; cid: string; w: number; h: number;
}) {
  const fs = numFs(score, 52);
  return (
    <Svg width={w} height={h} viewBox="-7 -7 114 129">
      <Defs>
        <ClipPath id={cid}><Path d={JERSEY} /></ClipPath>
      </Defs>

      {/* 드롭 쉐도우 */}
      <Path d={JERSEY} fill="rgba(0,0,0,0.25)" translateX={4} translateY={6} />

      {/* 다크 외곽 테두리 — 아크릴 배지 느낌 */}
      <Path d={JERSEY} fill="none" stroke={BORDER} strokeWidth={14} strokeLinejoin="round" />

      {/* 클립 내부: 팀 컬러 본체 + 크림 파이핑 */}
      <G clipPath={`url(#${cid})`}>
        <Path d={JERSEY} fill={tc} />
        <Path d={JERSEY} fill="none" stroke={CREAM} strokeWidth={9} strokeLinejoin="round" />
      </G>

      {/* 소매 끝단 화이트 트림 */}
      <Path d="M 0,37 L 22,41" fill="none" stroke={CREAM} strokeWidth={2.5} strokeLinecap="round" opacity={0.8} />
      <Path d="M 78,41 L 100,37" fill="none" stroke={CREAM} strokeWidth={2.5} strokeLinecap="round" opacity={0.8} />

      {/* "꿀잼" 라벨 */}
      <SvgText
        x={50} y={60}
        fontSize={10}
        fontWeight="bold"
        fill={CREAM}
        textAnchor="middle"
        letterSpacing={4}
        opacity={0.88}
      >꿀잼</SvgText>

      {/* 등번호 — 다크 외곽선 + 크림 */}
      <SvgText
        x={50} y={108}
        fontSize={fs}
        fontWeight="900"
        fill="none"
        stroke="rgba(0,0,0,0.5)"
        strokeWidth={6}
        strokeLinejoin="round"
        textAnchor="middle"
      >{score}</SvgText>
      <SvgText
        x={50} y={108}
        fontSize={fs}
        fontWeight="900"
        fill={CREAM}
        textAnchor="middle"
      >{score}</SvgText>
    </Svg>
  );
}

function CompactJersey({ score, tc, cid }: { score: number; tc: string; cid: string }) {
  const fs = numFs(score, 22);
  return (
    <Svg width={52} height={59} viewBox="-5 -5 60 68">
      <Defs>
        <ClipPath id={cid}><Path d={JERSEY_SM} /></ClipPath>
      </Defs>

      <Path d={JERSEY_SM} fill="rgba(0,0,0,0.22)" translateX={2} translateY={3} />
      <Path d={JERSEY_SM} fill="none" stroke={BORDER} strokeWidth={10} strokeLinejoin="round" />
      <G clipPath={`url(#${cid})`}>
        <Path d={JERSEY_SM} fill={tc} />
        <Path d={JERSEY_SM} fill="none" stroke={CREAM} strokeWidth={6} strokeLinejoin="round" />
      </G>

      {/* 소매 끝단 트림 */}
      <Path d="M 0,19 L 11,21" fill="none" stroke={CREAM} strokeWidth={1.5} strokeLinecap="round" opacity={0.8} />
      <Path d="M 39,21 L 50,19" fill="none" stroke={CREAM} strokeWidth={1.5} strokeLinecap="round" opacity={0.8} />

      <SvgText
        x={25} y={47}
        fontSize={fs}
        fontWeight="900"
        fill="none"
        stroke="rgba(0,0,0,0.45)"
        strokeWidth={3}
        strokeLinejoin="round"
        textAnchor="middle"
      >{score}</SvgText>
      <SvgText
        x={25} y={47}
        fontSize={fs}
        fontWeight="900"
        fill={CREAM}
        textAnchor="middle"
      >{score}</SvgText>
    </Svg>
  );
}

export default function JerseyScoreBadge({ score, variant = 'hero', teamColor }: Props) {
  const [cid] = useState<string>(() => `jsb_${++_seq}`);
  const tc = teamColor ?? colors.accent;

  if (variant === 'compact') {
    return <CompactJersey score={score} tc={tc} cid={cid} />;
  }

  const [w, h] = variant === 'detail' ? [120, 136] : [100, 113];
  return <LargeJersey score={score} tc={tc} cid={cid} w={w} h={h} />;
}
