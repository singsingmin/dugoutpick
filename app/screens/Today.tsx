// Phase 1 stub — 실제 추천/리스트는 Phase 4.
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, fontSize } from '../theme';

export default function Today() {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>오늘경기</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.pixel, fontSize: fontSize.title, color: colors.text },
});
