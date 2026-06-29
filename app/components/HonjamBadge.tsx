// 꿀잼지수 배지. 대형(추천/상세)=등번호 유니폼 컨셉(팀 컬러 스플릿), 소형(리스트)=그린 테두리 박스. (ADR-005/009)
import { View, StyleSheet } from 'react-native';
import PixelText from './PixelText';
import { border, colors, spacing } from '../theme';

interface Props {
  score: number;
  size?: 'sm' | 'lg';
  awayColor?: string;
  homeColor?: string;
}

export default function HonjamBadge({ score, size = 'sm', awayColor, homeColor }: Props) {
  if (size === 'lg') {
    const ac = awayColor ?? colors.gold;
    const hc = homeColor ?? colors.gold;
    return (
      <View style={styles.jerseyWrap}>
        {/* 좌(어웨이)/우(홈) 컬러 스플릿 배경 */}
        <View style={StyleSheet.absoluteFillObject}>
          <View style={styles.splitRow}>
            <View style={[styles.half, { backgroundColor: ac }]} />
            <View style={[styles.half, { backgroundColor: hc }]} />
          </View>
        </View>
        {/* 중앙 구분선 */}
        <View style={styles.splitDivider} />
        {/* 텍스트 */}
        <PixelText variant="caption" color="rgba(255,255,255,0.80)" style={styles.jerseyLabel}>HONJAM</PixelText>
        <PixelText variant="score" color="#FFFFFF" style={styles.jerseyNum}>{score}</PixelText>
      </View>
    );
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
  jerseyWrap: {
    width: 116,
    paddingVertical: spacing.sm,
    borderRadius: border.radius,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  splitRow: { flex: 1, flexDirection: 'row' },
  half: { flex: 1 },
  splitDivider: {
    position: 'absolute',
    top: 0, bottom: 0,
    left: '50%',
    width: 1.5,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  jerseyLabel: { letterSpacing: 1, zIndex: 1 },
  jerseyNum: {
    zIndex: 1,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});
