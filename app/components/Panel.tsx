// 8비트 박스. 각진 두꺼운 테두리 + surface 배경. (ADR-009)
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import type { PropsWithChildren } from 'react';
import { colors, border, spacing } from '../theme';

interface Props {
  style?: StyleProp<ViewStyle>;
  accentColor?: string; // 테두리색 오버라이드 (팀색/꿀잼색 액센트)
}

export default function Panel({ children, style, accentColor }: PropsWithChildren<Props>) {
  return (
    <View style={[styles.panel, accentColor ? { borderColor: accentColor } : null, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: border.width,
    borderRadius: border.radius,
    padding: spacing.md,
  },
});
