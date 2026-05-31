// Phase 1 stub — 실제 로고/분기 로직은 Phase 3.
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, fontSize } from '../theme';

export default function Splash() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>오늘야구각</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  logo: { fontFamily: fonts.pixel, fontSize: fontSize.hero, color: colors.accent },
});
