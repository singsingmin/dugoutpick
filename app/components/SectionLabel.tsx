// 팀색 탭형 섹션 라벨 (목업: "★ 오늘의 추천 경기", "💬 오늘의 한 줄 예측" 등).
import { View, StyleSheet } from 'react-native';
import PixelText from './PixelText';
import { border, colors, spacing } from '../theme';
import { useTeamTheme } from '../context/TeamTheme';

interface Props {
  label: string;
  icon?: string;
}

export default function SectionLabel({ label, icon }: Props) {
  const { accent } = useTeamTheme();
  return (
    <View style={[styles.tab, { backgroundColor: accent }]}>
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
    borderRadius: border.radius,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
});
