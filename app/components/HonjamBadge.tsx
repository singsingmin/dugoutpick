// 꿀잼지수 배지. 대형(추천/상세)=골드 박스, 소형(리스트)=그린 테두리 박스. (ADR-005/009)
import { View, StyleSheet } from 'react-native';
import PixelText from './PixelText';
import { border, colors, spacing } from '../theme';

interface Props {
  score: number;
  size?: 'sm' | 'lg';
}

export default function HonjamBadge({ score, size = 'sm' }: Props) {
  if (size === 'lg') {
    // 점수대별 숫자 색(골드 배경 위): 80+ 핫레드 / 60+ 딥오렌지 / 그 외 다크
    const numColor = score >= 80 ? '#C0392B' : score >= 60 ? '#9C5A00' : colors.onGold;
    return (
      <View style={[styles.box, styles.lg, { backgroundColor: colors.gold }]}>
        <PixelText variant="caption" color={colors.onGold}>꿀잼지수</PixelText>
        <PixelText variant="score" color={numColor}>{score}</PixelText>
      </View>
    );
  }
  return (
    <View style={[styles.box, styles.sm, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
      <PixelText variant="title" color={colors.accent}>{score}</PixelText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: border.width,
    borderRadius: border.radius,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: { paddingVertical: 2, paddingHorizontal: spacing.sm, minWidth: 52 },
  lg: { paddingVertical: spacing.sm, paddingHorizontal: spacing.xl, minWidth: 116 },
});
