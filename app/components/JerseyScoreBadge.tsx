// 아크릴 유니폼 배지 스타일 꿀잼지수 (오늘야구각 전용 디자인)
// hero=추천카드 대형, compact=리스트 소형, detail=상세화면 대형
import { useState } from 'react';
import Svg, { Path, Defs, ClipPath, G, Text as SvgText, Line } from 'react-native-svg';
import { colors } from '../theme';

interface Props {
  score: number;
  variant?: 'hero' | 'compact' | 'detail';
  teamColor?: string;
}

// 외곽선: 짙은 다크 브라운 (pure black보다 부드럽게)
const BORDER = '#211810';
// 크림 파이핑
const CREAM = '#F5EDDA';

// 유니폼 실루엣 — 라운드 칼라, 귀여운 짧은 소매
// 논리 좌표: 0 0 100 115 / 뷰박스: -6 -6 112 127 (stroke 6px 여백)
const JERSEY =
  `M 32,6 L 0,20 L 0,44 L 22,47 L 22,115 L 78,115 L 78,47 L 100,44 L 100,20 L 68,6 Q 50,28 32,6 Z`;

// compact 소형 유니폼
// 논리 좌표: 0 0 50 58 / 뷰박스: -4 -4 58 66 (stroke 4px 여백)
const JERSEY_SM =
  `M 16,3 L 0,10 L 0,22 L 11,24 L 11,58 L 39,58 L 39,24 L 50,22 L 50,10 L 34,3 Q 25,14 16,3 Z`;

let _seq = 0;

function numFs(score: number, base: number): number {
  const d = String(score).length;
  if (d >= 3) return base - 14;
  if (d === 2) return base - 5;
  return base;
}

function LargeJersey({ score, tc, cid, w, h, showLabel }: {
  score: number; tc: string; cid: string; w: number; h: number; showLabel: boolean;
}) {
  const fs = numFs(score, 50);
  // 숫자 y: 아래에서 적당한 여백, 3자리면 조금 위로
  const numY = String(score).length >= 3 ? 105 : 108;

  return (
    <Svg width={w} height={h} viewBox="-6 -6 112 127">
      <Defs>
        <ClipPath id={cid}><Path d={JERSEY} /></ClipPath>
      </Defs>

      {/* 드롭 쉐도우 (가볍게) */}
      <Path d={JERSEY} fill="rgba(0,0,0,0.15)" translateX={3} translateY={4} />

      {/* 외곽 테두리 — 이전보다 25% 얇게 */}
      <Path d={JERSEY} fill="none" stroke={BORDER} strokeWidth={10} strokeLinejoin="round" />

      {/* 클립 내부: 팀 컬러 + 크림 파이핑 */}
      <G clipPath={`url(#${cid})`}>
        <Path d={JERSEY} fill={tc} />
        <Path d={JERSEY} fill="none" stroke={CREAM} strokeWidth={7} strokeLinejoin="round" />
      </G>

      {/* 중앙 버튼 라인 (아주 은은하게) */}
      <Line
        x1={50} y1={52} x2={50} y2={112}
        stroke={CREAM} strokeWidth={0.8} opacity={0.18}
      />

      {/* 소매 끝단 트림 */}
      <Path d="M 1,38 L 21,42" fill="none" stroke={CREAM} strokeWidth={2} strokeLinecap="round" opacity={0.75} />
      <Path d="M 79,42 L 99,38" fill="none" stroke={CREAM} strokeWidth={2} strokeLinecap="round" opacity={0.75} />

      {/* "꿀잼" 라벨 — hero/detail만, 작고 단정하게 */}
      {showLabel && (
        <SvgText
          x={50} y={58}
          fontSize={9}
          fontWeight="bold"
          fill={CREAM}
          textAnchor="middle"
          letterSpacing={2}
          opacity={0.80}
        >꿀잼</SvgText>
      )}

      {/* 등번호 — 평면 패치 스타일 (얇은 아웃라인 1겹만) */}
      <SvgText
        x={50} y={numY}
        fontSize={fs}
        fontWeight="900"
        fill="none"
        stroke="rgba(0,0,0,0.30)"
        strokeWidth={3}
        strokeLinejoin="round"
        textAnchor="middle"
      >{score}</SvgText>
      <SvgText
        x={50} y={numY}
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
    <Svg width={48} height={55} viewBox="-4 -4 58 66">
      <Defs>
        <ClipPath id={cid}><Path d={JERSEY_SM} /></ClipPath>
      </Defs>

      {/* 그림자 (더 얇게) */}
      <Path d={JERSEY_SM} fill="rgba(0,0,0,0.12)" translateX={2} translateY={2} />

      {/* 외곽선 — compact는 더 얇게 */}
      <Path d={JERSEY_SM} fill="none" stroke={BORDER} strokeWidth={7} strokeLinejoin="round" />

      {/* 팀 컬러 + 파이핑 */}
      <G clipPath={`url(#${cid})`}>
        <Path d={JERSEY_SM} fill={tc} />
        <Path d={JERSEY_SM} fill="none" stroke={CREAM} strokeWidth={4} strokeLinejoin="round" />
      </G>

      {/* 소매 트림 */}
      <Path d="M 1,19 L 10,21" fill="none" stroke={CREAM} strokeWidth={1.2} strokeLinecap="round" opacity={0.7} />
      <Path d="M 40,21 L 49,19" fill="none" stroke={CREAM} strokeWidth={1.2} strokeLinecap="round" opacity={0.7} />

      {/* 숫자만 — 평면 스타일 */}
      <SvgText
        x={25} y={47}
        fontSize={fs}
        fontWeight="900"
        fill="none"
        stroke="rgba(0,0,0,0.28)"
        strokeWidth={2}
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

  // detail은 가장 크게, hero는 10~15% 작게
  const [w, h] = variant === 'detail' ? [120, 136] : [88, 99];
  return <LargeJersey score={score} tc={tc} cid={cid} w={w} h={h} showLabel={true} />;
}
