// 라커룸 — 사용자 활동/꾸미기/보상 허브. 실제 앱 설정은 우상단 톱니 → Settings.
// Stage 6: 장착한 라커룸 배경을 화면 전체 배경으로 적용(docs/stage6-cosmetics-design.md §6-1).
import { useCallback, useState } from 'react';
import { View, ScrollView, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { fetchPredictionStats } from '../services/predictions';
import { findBackground } from '../utils/lockerBackgroundConfig';
import PixelButton from '../components/PixelButton';
import ScreenHeader from '../components/ScreenHeader';
import SectionLabel from '../components/SectionLabel';
import ProtectNudge from '../components/ProtectNudge';
import { colors, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LockerRoom() {
  const navigation = useNavigation<Nav>();
  const [equippedBackgroundId, setEquippedBackgroundId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchPredictionStats()
        .then((s) => { if (active) setEquippedBackgroundId(s?.equippedBackground ?? null); })
        .catch(() => {});
      return () => { active = false; };
    }, [])
  );

  const equipped = findBackground(equippedBackgroundId);

  return (
    <View style={styles.root}>
      {equipped ? (
        <Image source={equipped.backgroundImage} style={styles.bgImage} resizeMode="cover" />
      ) : (
        <Image source={require('../assets/stadium-bg.webp')} style={styles.bgImage} resizeMode="cover" />
      )}
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

          <View style={styles.section}>
            <SectionLabel label="라커룸 배경" />
            <PixelButton label="배경 꾸미기" onPress={() => navigation.navigate('BackgroundShop')} />
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
