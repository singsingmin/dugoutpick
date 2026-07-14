// 탭 화면용 헤더 바 (목업: 야구공 아이콘 + 타이틀 + 달력 아이콘 등). 내 팀 색 동적 반영.
import { View, Pressable, StyleSheet } from 'react-native';
import PixelText from './PixelText';
import AppIcon, { type AppIconName } from './AppIcon';
import { colors, spacing } from '../theme';
import { useTeamTheme } from '../context/TeamTheme';

// 아이콘 버튼의 스크린리더 기본 라벨(눈엔 안 보임, TalkBack이 읽음). 필요 시 콜사이트에서 override.
const ICON_A11Y: Partial<Record<AppIconName, string>> = {
  back: '뒤로 가기',
  calendar: '이번 주 일정 보기',
  chart: '랭킹 보기',
};

interface Props {
  title: string;
  leftIcon?: AppIconName;
  rightIcon?: AppIconName;
  rightLabel?: string;  // 아이콘 대신 표시할 텍스트 (예: 날짜 "6/25")
  onLeftPress?: () => void;
  onRightPress?: () => void;
  leftAccessibilityLabel?: string;   // 좌측 버튼 스크린리더 라벨(기본: 아이콘 맵 → '뒤로 가기')
  rightAccessibilityLabel?: string;  // 우측 버튼 스크린리더 라벨
}

export default function ScreenHeader({ title, leftIcon, rightIcon, rightLabel, onLeftPress, onRightPress, leftAccessibilityLabel, rightAccessibilityLabel }: Props) {
  const { accent } = useTeamTheme();
  const leftLabel = leftAccessibilityLabel ?? (leftIcon ? ICON_A11Y[leftIcon] : undefined) ?? '뒤로 가기';
  const rightLabelA11y = rightAccessibilityLabel ?? rightLabel ?? (rightIcon ? ICON_A11Y[rightIcon] : undefined) ?? '메뉴';

  const rightContent = (
    <View style={styles.side}>
      {rightLabel
        ? <PixelText variant="body" color={colors.onGreen}>{rightLabel}</PixelText>
        : rightIcon
          ? <AppIcon name={rightIcon} size={30} color={colors.onGreen} />
          : null}
    </View>
  );
  const leftContent = (
    <View style={styles.side}>
      {leftIcon && <AppIcon name={leftIcon} size={30} color={colors.onGreen} />}
    </View>
  );

  return (
    <View style={[styles.bar, { backgroundColor: accent }]}>
      {onLeftPress
        ? <Pressable onPress={onLeftPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={leftLabel}>{leftContent}</Pressable>
        : leftContent}
      <PixelText variant="title" color={colors.onGreen}>{title}</PixelText>
      {onRightPress
        ? <Pressable onPress={onRightPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={rightLabelA11y}>{rightContent}</Pressable>
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
  side: { width: 36, alignItems: 'center' },
});
