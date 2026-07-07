// 설정 목록의 내비게이션 행 — 아이콘(선택) + 라벨 + 오른쪽 값(선택) + › . 탭하면 이동.
import { Pressable, StyleSheet } from 'react-native';
import PixelText from './PixelText';
import AppIcon, { type AppIconName } from './AppIcon';
import { colors, spacing } from '../theme';

export default function SettingsRow({ label, icon, value, onPress, last }: {
  label: string;
  icon?: AppIconName;
  value?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      style={[styles.row, !last && styles.divider]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      {icon && <AppIcon name={icon} size={22} />}
      <PixelText variant="body" color={colors.text} style={styles.label}>{label}</PixelText>
      {value && <PixelText variant="caption" color={colors.textDim}>{value}</PixelText>}
      {onPress && <PixelText variant="body" color={colors.textDim} style={styles.chev}>›</PixelText>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.surfaceAlt },
  label: { flex: 1 },
  chev: { marginLeft: spacing.xs, fontSize: 20 },
});
