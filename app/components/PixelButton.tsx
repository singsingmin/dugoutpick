// 8비트 박스 버튼. 그린 채움 + 다크 테두리 + 크림 텍스트 (목업 CTA). (ADR-009)
import { Pressable, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import PixelText from './PixelText';
import { colors, border, spacing } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  accentColor?: string; // 배경색 오버라이드 (기본: 그린)
  selected?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function PixelButton({ label, onPress, accentColor, selected, disabled, style }: Props) {
  const bg = accentColor ?? colors.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg },
        (pressed || selected) && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <PixelText variant="body" color={colors.onGreen}>{label}</PixelText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: border.radius,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.4 },
});
