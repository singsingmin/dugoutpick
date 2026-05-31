// 그린 탭형 섹션 라벨 (목업: "★ 오늘의 추천 경기", "💬 오늘의 한 줄 예측" 등).
import { View, StyleSheet } from 'react-native';
import PixelText from './PixelText';
import { border, colors, spacing } from '../theme';

interface Props {
  label: string;
  icon?: string;
}

export default function SectionLabel({ label, icon }: Props) {
  return (
    <View style={styles.tab}>
      <PixelText variant="body" color={colors.onGreen}>
        {icon ? `${icon} ` : ''}
        {label}
      </PixelText>
    </View>
  );
}

const styles = StyleSheet.create({
  tab: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderColor: colors.border,
    borderWidth: border.width,
    borderRadius: border.radius,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
});
