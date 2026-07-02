// 설정 탭 (최소): 응원팀 변경 / 데이터 갱신시각 / 앱 정보. (flow.md)
import { useEffect, useState } from 'react';
import { View, ScrollView, Image, StyleSheet } from 'react-native';
import type { TrackRecord } from '../types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useTeamTheme } from '../context/TeamTheme';
import { useScoreSkin } from '../context/ScoreSkin';
import { loadGames } from '../data/load';
import PixelText from '../components/PixelText';
import Panel from '../components/Panel';
import PixelButton from '../components/PixelButton';
import ScreenHeader from '../components/ScreenHeader';
import SectionLabel from '../components/SectionLabel';
import TrackRecordBadge from '../components/TrackRecordBadge';
import { formatUpdatedAt } from '../utils';
import { colors, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const APP_VERSION = '1.0.0';

export default function Settings() {
  const navigation = useNavigation<Nav>();
  const { accent } = useTeamTheme();
  const { baseballBalance, addBaseballs, resetProgress } = useScoreSkin();
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [trackRecord, setTrackRecord] = useState<TrackRecord | null>(null);

  useEffect(() => {
    let active = true;
    loadGames().then((d) => {
      if (!active) return;
      setUpdatedAt(d.updatedAt);
      setTrackRecord(d.trackRecord ?? null);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <View style={styles.root}>
      <Image source={require('../assets/stadium-bg.webp')} style={styles.bgImage} resizeMode="cover" />
      <View style={styles.bgOverlay} />
      <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="설정" leftIcon="settings" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <SectionLabel label="응원팀" />
          <PixelButton label="응원팀 변경" onPress={() => navigation.navigate('Onboarding')} />
        </View>

        <View style={styles.section}>
          <SectionLabel label="꾸미기" />
          <PixelButton label="꿀잼지수 스킨" onPress={() => navigation.navigate('SkinSelect')} />
        </View>

        <View style={styles.section}>
          <SectionLabel label="데이터" />
          <Panel>
            <PixelText variant="body">갱신 시각</PixelText>
            <PixelText variant="caption" color={colors.textDim} style={styles.value}>
              {updatedAt ? formatUpdatedAt(updatedAt) : '-'}
            </PixelText>
          </Panel>
        </View>

        <View style={styles.section}>
          <SectionLabel label="꿀잼지수 적중률" />
          <TrackRecordBadge track={trackRecord} variant="settings" />
        </View>

        {/* 개발/테스트용 — dev 빌드에서만 노출(출시 빌드 미노출) */}
        {__DEV__ && (
          <View style={styles.section}>
            <SectionLabel label="야구공 (테스트)" />
            <Panel>
              <PixelText variant="body">현재 잔액: {baseballBalance}</PixelText>
              <View style={styles.debugRow}>
                <PixelButton label="야구공 +100" onPress={() => { void addBaseballs(100); }} style={styles.debugBtn} />
                <PixelButton label="초기화" accentColor={colors.bad} onPress={() => { void resetProgress(); }} style={styles.debugBtn} />
              </View>
            </Panel>
          </View>
        )}

        <View style={styles.section}>
          <SectionLabel label="앱 정보" />
          <Panel>
            <PixelText variant="body">오늘야구각</PixelText>
            <PixelText variant="caption" color={colors.textDim} style={styles.value}>버전 {APP_VERSION}</PixelText>
            <PixelText variant="caption" color={colors.textDim}>KBO 경기 꿀잼지수 · 데이터 출처: KBO</PixelText>
          </Panel>
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
  value: { marginTop: spacing.xs },
  debugRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  debugBtn: { flex: 1 },
});
