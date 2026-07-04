// 라커룸 — 사용자 활동/꾸미기/보상 허브. 실제 앱 설정은 우상단 톱니 → Settings.
import { View, ScrollView, Image, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/Auth';
import PixelText from '../components/PixelText';
import PixelButton from '../components/PixelButton';
import ScreenHeader from '../components/ScreenHeader';
import SectionLabel from '../components/SectionLabel';
import AppIcon from '../components/AppIcon';
import { colors, spacing, border } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LockerRoom() {
  const navigation = useNavigation<Nav>();
  const { isProtected } = useAuth();
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
          <View style={styles.section}>
            <SectionLabel icon="star" label="계정" />
            <Pressable
              style={styles.accountCard}
              onPress={() => navigation.navigate('AccountProtect')}
              accessibilityRole="button"
              accessibilityLabel="계정 보호 열기"
            >
              <AppIcon name={isProtected ? 'star' : 'flag'} size={22} />
              <View style={styles.accountText}>
                <PixelText variant="body" color={colors.text}>
                  {isProtected ? '계정 보호됨' : '계정 보호하기'}
                </PixelText>
                <PixelText variant="caption" color={colors.textDim}>
                  {isProtected ? 'Google 연결됨 · 복구 가능' : '지금 연결 안 하면 앱 삭제 시 사라져요'}
                </PixelText>
              </View>
              <View style={[styles.badge, { backgroundColor: isProtected ? colors.good : colors.bad }]}>
                <PixelText variant="caption" color={colors.onGreen}>
                  {isProtected ? '보호됨' : '미보호'}
                </PixelText>
              </View>
            </Pressable>
          </View>

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
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: border.width,
    borderRadius: border.radius,
    padding: spacing.md,
  },
  accountText: { flex: 1 },
  badge: { borderRadius: border.radius, paddingVertical: 2, paddingHorizontal: spacing.sm },
});
