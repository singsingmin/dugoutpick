// 8비트 박스 버튼. (ADR-009)
import { Pressable, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import PixelText from './PixelText';
import { colors, border, spacing } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  accentColor?: string;
  selected?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function PixelButton({ label, onPress, accentColor, selected, disabled, style }: Props) {
  const borderColor = accentColor ?? colors.border;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        { borderColor, backgroundColor: selected ? colors.surfaceAlt : colors.surface },
        (pressed || selected) && { backgroundColor: colors.surfaceAlt },
        disabled && styles.disabled,
        style,
      ]}
    >
      <PixelText variant="body" color={selected ? colors.accent : colors.text}>
        {label}
      </PixelText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: border.width,
    borderRadius: border.radius,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
});
