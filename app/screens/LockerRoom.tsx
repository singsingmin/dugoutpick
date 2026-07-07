// 라커룸 — 사용자 활동/꾸미기/보상 허브. 실제 앱 설정은 우상단 톱니 → Settings.
import { View, ScrollView, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import PixelButton from '../components/PixelButton';
import ScreenHeader from '../components/ScreenHeader';
import SectionLabel from '../components/SectionLabel';
import ProtectNudge from '../components/ProtectNudge';
import { colors, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LockerRoom() {
  const navigation = useNavigation<Nav>();
  return (
    <View style={styles.root}>
      <Image source={require('../assets/stadium-bg.webp')} style={styles.bgImage} resizeMode="cover" />
      <View style={styles.bgOverlay} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader
          title="라커룸"
          leftIcon="lockerroom"
          rightIcon="settings"
          onRightPress={() => navigation.navigate('Settings')}
        />
        <ScrollView contentContainerStyle={styles.content}>
          <ProtectNudge />

          <View style={styles.section}>
            <SectionLabel label="응원팀" />
            <PixelButton label="응원팀 변경" onPress={() => navigation.navigate('Onboarding')} />
          </View>

          <View style={styles.section}>
            <SectionLabel label="꾸미기" />
            <PixelButton label="꿀잼지수 스킨" onPress={() => navigation.navigate('SkinSelect')} />
          </View>

          <View style={styles.section}>
            <SectionLabel label="야구공" />
            <PixelButton label="야구공 센터" onPress={() => navigation.navigate('BaseballCenter')} />
          </View>

          <View style={styles.section}>
            <SectionLabel label="예측 리그" />
            <PixelButton label="내 기록 · 랭킹 보기" onPress={() => navigation.navigate('PredictionLeague')} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bgImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  bgOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(243,233,206,0.35)' },
  safe: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing.md },
  section: { marginBottom: spacing.lg },
});
