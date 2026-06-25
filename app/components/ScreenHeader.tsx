// 탭 화면용 그린 헤더 바 (목업: 야구공 아이콘 + 타이틀 + 달력 아이콘 등).
import { View, Pressable, StyleSheet } from 'react-native';
import PixelText from './PixelText';
import { border, colors, spacing } from '../theme';

interface Props {
  title: string;
  leftIcon?: string;
  rightIcon?: string;
  rightLabel?: string;  // 이모지 대신 표시할 텍스트 (예: 날짜 "6/25")
  onRightPress?: () => void;
}

export default function ScreenHeader({ title, leftIcon, rightIcon, rightLabel, onRightPress }: Props) {
  const rightContent = (
    <PixelText variant="body" color={colors.onGreen} style={styles.side}>
      {rightLabel ?? rightIcon ?? ''}
    </PixelText>
  );

  return (
    <View style={styles.bar}>
      <PixelText variant="body" color={colors.onGreen} style={styles.side}>{leftIcon ?? ''}</PixelText>
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
    backgroundColor: colors.accent,
    borderBottomColor: colors.border,
    borderBottomWidth: border.width,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  side: { width: 24, textAlign: 'center', fontSize: 16 },
});
