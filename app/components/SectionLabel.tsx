// 팀색 탭형 섹션 라벨 (목업: "★ 오늘의 추천 경기", "💬 오늘의 한 줄 예측" 등).
import { View, StyleSheet } from 'react-native';
import PixelText from './PixelText';
import AppIcon, { type AppIconName } from './AppIcon';
import { border, colors, spacing } from '../theme';
import { useTeamTheme } from '../context/TeamTheme';

interface Props {
  label: string;
  icon?: AppIconName;
}

export default function SectionLabel({ label, icon }: Props) {
  const { accent } = useTeamTheme();
  return (
    <View style={[styles.tab, { backgroundColor: accent }]}>
      <View style={styles.row}>
        {icon && <AppIcon name={icon} size={13} color={colors.onGreen} />}
        <PixelText variant="body" color={colors.onGreen}>{label}</PixelText>
      </View>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
