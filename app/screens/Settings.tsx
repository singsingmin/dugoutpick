// Phase 1 stub — 실제 설정(팀변경/갱신시각/버전)은 Phase 5.
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, fontSize } from '../theme';

export default function Settings() {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>설정</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.pixel, fontSize: fontSize.title, color: colors.text },
});
