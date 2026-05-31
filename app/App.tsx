import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSize } from './theme';

// Phase 0: 폰트 로드 + 임시 화면. 네비게이션은 Phase 1에서 연결.
export default function App() {
  const [loaded] = useFonts({
    Galmuri11: require('./assets/fonts/Galmuri11.ttf'),
  });

  if (!loaded) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>오늘야구각</Text>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontFamily: fonts.pixel,
    fontSize: fontSize.hero,
    color: colors.accent,
  },
});
