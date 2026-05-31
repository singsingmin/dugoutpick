// Phase 1 stub — 실제 피드(다음경기/순위/최근결과)는 Phase 5.
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, fontSize } from '../theme';

export default function MyTeam() {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>내 팀</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.pixel, fontSize: fontSize.title, color: colors.text },
});
