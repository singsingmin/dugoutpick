// 꿀잼지수 배지. 대형=야구 유니폼 실루엣(어웨이|홈 스플릿), 소형=그린 점수 박스. (ADR-005/009)
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Line, Text as SvgText, Defs, ClipPath, G, Use } from 'react-native-svg';
import PixelText from './PixelText';
import { border, colors, spacing } from '../theme';

interface Props {
  score: number;
  size?: 'sm' | 'lg';
  awayColor?: string;
  homeColor?: string;
}

// 유니폼 SVG path (160×172 뷰박스)
const JERSEY_PATH = `
  M 80,8
  C 72,8 65,14 60,22
  L 12,22
  C 4,22 0,28 0,36
  L 0,68
  L 30,68
  L 30,172
  L 130,172
  L 130,68
  L 160,68
  L 160,36
  C 160,28 156,22 148,22
  L 100,22
  C 95,14 88,8 80,8 Z
`;

function JerseyLg({ score, awayColor, homeColor }: { score: number; awayColor: string; homeColor: string }) {
  const W = 120, H = 129; // 렌더 크기 (뷰박스 160×172 비율 유지)
  return (
    <Svg width={W} height={H} viewBox="0 0 160 172">
      <Defs>
        <ClipPath id="jerseyClip">
          <Path d={JERSEY_PATH} />
        </ClipPath>
      </Defs>

      {/* 그림자 */}
      <Path d={JERSEY_PATH} fill="rgba(0,0,0,0.18)" translateX={3} translateY={4} />

      {/* 어웨이(좌) 배경 */}
      <Path d={JERSEY_PATH} fill={awayColor} stroke="white" strokeWidth={4} />

      {/* 홈(우) 절반 오버레이 */}
      <Rect x={80} y={0} width={80} height={172} fill={homeColor} clipPath="url(#jerseyClip)" />

      {/* 중앙 분리선 */}
      <Line x1={80} y1={0} x2={80} y2={172} stroke="rgba(255,255,255,0.40)" strokeWidth={1.5} />

      {/* 칼라 트림 */}
      <Path
        d="M 60,22 C 65,36 72,42 80,44 C 88,42 95,36 100,22"
        fill="none" stroke="white" strokeWidth={3} strokeLinecap="round"
      />

      {/* 소매 트림 */}
      <Line x1={0} y1={68} x2={30} y2={68} stroke="white" strokeWidth={2.5} />
      <Line x1={130} y1={68} x2={160} y2={68} stroke="white" strokeWidth={2.5} />

      {/* 팀 이름 자리 — "꿀잼" */}
      <SvgText
        x={80} y={84}
        fontSize={13} fontWeight="bold"
        fill="white" textAnchor="middle"
        letterSpacing={2}
      >꿀잼</SvgText>

      {/* 등번호 — 외곽선 먼저, 흰 숫자 위에 */}
      <SvgText
        x={80} y={150}
        fontSize={68} fontWeight="900"
        fill="none" stroke="rgba(0,0,0,0.7)" strokeWidth={6} strokeLinejoin="round"
        textAnchor="middle"
      >{score}</SvgText>
      <SvgText
        x={80} y={150}
        fontSize={68} fontWeight="900"
        fill="white" textAnchor="middle"
      >{score}</SvgText>
    </Svg>
  );
}

export default function HonjamBadge({ score, size = 'sm', awayColor, homeColor }: Props) {
  if (size === 'lg') {
    const ac = awayColor ?? '#555555';
    const hc = homeColor ?? '#333333';
    return <JerseyLg score={score} awayColor={ac} homeColor={hc} />;
  }
  return (
    <View style={[styles.box, styles.sm, { backgroundColor: colors.surface }]}>
      <PixelText variant="title" color={colors.accent}>{score}</PixelText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: border.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: { paddingVertical: 2, paddingHorizontal: spacing.sm, minWidth: 52 },
});
