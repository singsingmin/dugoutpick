// Phase 1 stub — 실제 팀선택 그리드는 Phase 3.
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, fontSize } from '../theme';

export default function Onboarding() {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>온보딩 (팀 선택)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.pixel, fontSize: fontSize.title, color: colors.text },
});
