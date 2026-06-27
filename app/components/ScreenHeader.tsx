// 탭 화면용 헤더 바 (목업: 야구공 아이콘 + 타이틀 + 달력 아이콘 등). 내 팀 색 동적 반영.
import { View, Pressable, StyleSheet } from 'react-native';
import PixelText from './PixelText';
import AppIcon, { type AppIconName } from './AppIcon';
import { colors, spacing } from '../theme';
import { useTeamTheme } from '../context/TeamTheme';

interface Props {
  title: string;
  leftIcon?: AppIconName;
  rightIcon?: AppIconName;
  rightLabel?: string;  // 아이콘 대신 표시할 텍스트 (예: 날짜 "6/25")
  onLeftPress?: () => void;
  onRightPress?: () => void;
}

export default function ScreenHeader({ title, leftIcon, rightIcon, rightLabel, onLeftPress, onRightPress }: Props) {
  const { accent } = useTeamTheme();

  const rightContent = (
    <View style={styles.side}>
      {rightLabel
        ? <PixelText variant="body" color={colors.onGreen}>{rightLabel}</PixelText>
        : rightIcon
          ? <AppIcon name={rightIcon} size={26} color={colors.onGreen} />
          : null}
    </View>
  );
  const leftContent = (
    <View style={styles.side}>
      {leftIcon && <AppIcon name={leftIcon} size={26} color={colors.onGreen} />}
    </View>
  );

  return (
    <View style={[styles.bar, { backgroundColor: accent }]}>
      {onLeftPress
        ? <Pressable onPress={onLeftPress} hitSlop={8}>{leftContent}</Pressable>
        : leftContent}
      <PixelText variant="title" color={colors.onGreen}>{title}</PixelText>
      {onRightPress
        ? <Pressable onPress={onRightPress} hitSlop={8}>{rightContent}</Pressable>
        : rightContent}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  side: { width: 32, alignItems: 'center' },
});
