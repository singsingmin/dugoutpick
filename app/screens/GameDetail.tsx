// Phase 1 stub — 실제 상세(꿀잼/이유/관전포인트/선발)는 Phase 4.
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, fontSize } from '../theme';

export default function GameDetail() {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>경기 상세</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.pixel, fontSize: fontSize.title, color: colors.text },
});
