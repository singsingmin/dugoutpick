// 라커룸 — 사용자 활동/꾸미기/보상 허브. 실제 앱 설정은 우상단 톱니 → Settings.
// Stage 6: 장착한 라커룸 배경을 화면 전체 배경으로 적용(docs/stage6-cosmetics-design.md §6-1).
import { useCallback, useState } from 'react';
import { View, ScrollView, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { fetchPredictionStats } from '../services/predictions';
import { fetchOwnedBackgrounds, type OwnedBackground } from '../services/cosmetics';
import { findBackground, backgroundInstanceLabel } from '../utils/lockerBackgroundConfig';
import PixelText from '../components/PixelText';
import PixelButton from '../components/PixelButton';
import ScreenHeader from '../components/ScreenHeader';
import SectionLabel from '../components/SectionLabel';
import ProtectNudge from '../components/ProtectNudge';
import { colors, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LockerRoom() {
  const navigation = useNavigation<Nav>();
  const [equipped, setEquipped] = useState<OwnedBackground | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([fetchPredictionStats(), fetchOwnedBackgrounds()])
        .then(([s, owned]) => {
          if (!active) return;
          const id = s?.equippedOwnedBackgroundId ?? null;
          setEquipped(id == null ? null : (owned.find((o) => o.ownedBackgroundId === id) ?? null));
        })
        .catch(() => {});
      return () => { active = false; };
    }, [])
  );

  const bg = equipped ? findBackground(equipped.backgroundId) : undefined;
  const equippedLabel = equipped && bg
    ? backgroundInstanceLabel(equipped.backgroundId, equipped.periodType, equipped.periodLabel)
    : null;

  return (
    <View style={styles.root}>
      {bg ? (
        <Image source={bg.backgroundImage} style={styles.bgImage} resizeMode="cover" />
      ) : (
        <Image source={require('../assets/stadium-bg.webp')} style={styles.bgImage} resizeMode="cover" />
      )}
      {/* 크림 오버레이(흐림)는 기본 배경일 때만 — 커스텀 배경은 아트를 선명하게 보여줌 */}
      {!bg && <View style={styles.bgOverlay} />}
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader
          title="라커룸"
          leftIcon="lockerroom"
          rightIcon="settings"
          onRightPress={() => navigation.navigate('Settings')}
        />
        <ScrollView contentContainerStyle={styles.content}>
          <ProtectNudge />

          {equippedLabel && (
            <View style={styles.equippedPill}>
              <PixelText variant="caption" color="#fff">적용 중 · {equippedLabel}</PixelText>
            </View>
          )}

          <View style={styles.section}>
            <SectionLabel label="응원팀" />
            <PixelButton label="응원팀 변경" onPress={() => navigation.navigate('Onboarding')} />
          </View>

          <View style={styles.section}>
            <SectionLabel label="꾸미기" />
            <View style={styles.buttonRow}>
              <PixelButton style={styles.buttonHalf} label="꿀잼지수 스킨" onPress={() => navigation.navigate('SkinSelect')} />
              <PixelButton style={styles.buttonHalf} label="라커룸 배경" onPress={() => navigation.navigate('BackgroundShop')} />
            </View>
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
  equippedPill: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(30,24,12,0.72)',
    borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 4, marginBottom: spacing.md,
  },
  section: { marginBottom: spacing.lg },
  buttonRow: { flexDirection: 'row', gap: spacing.sm },
  buttonHalf: { flex: 1 },
});
