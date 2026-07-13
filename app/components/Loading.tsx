// 공용 로딩 표시 — 앱 전역 로딩 상태를 하나의 스피너로 통일(UX 폴리시 2026-07).
// 전체화면: <Loading style={{ flex: 1 }} /> · 인라인(패널/섹션): <Loading />
import { View, ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing } from '../theme';

export default function Loading({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.wrap, style]}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl },
});
