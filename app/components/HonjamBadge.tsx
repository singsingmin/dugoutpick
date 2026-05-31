// 꿀잼지수 배지 — 점수대별 색(theme.honjamColor). 8비트 강조. (ADR-005/009)
import { View, StyleSheet } from 'react-native';
import PixelText from './PixelText';
import { border, colors, honjamColor, spacing } from '../theme';

interface Props {
  score: number;
  size?: 'sm' | 'lg';
}

export default function HonjamBadge({ score, size = 'sm' }: Props) {
  const color = honjamColor(score);
  const lg = size === 'lg';
  return (
    <View style={[styles.box, { borderColor: color }, lg ? styles.lg : styles.sm]}>
      <PixelText variant={lg ? 'score' : 'title'} color={color}>
        {score}
      </PixelText>
      <PixelText variant="caption" color={colors.textDim}>
        꿀잼지수
      </PixelText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.bg,
    borderWidth: border.width,
    borderRadius: border.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, minWidth: 56 },
  lg: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl, minWidth: 120 },
});
