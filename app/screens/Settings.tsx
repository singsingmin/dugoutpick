// 설정 탭 (최소): 응원팀 변경 / 데이터 갱신시각 / 앱 정보. (flow.md)
import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { loadGames } from '../data/load';
import PixelText from '../components/PixelText';
import Panel from '../components/Panel';
import PixelButton from '../components/PixelButton';
import { colors, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const APP_VERSION = '1.0.0';

export default function Settings() {
  const navigation = useNavigation<Nav>();
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadGames().then((d) => active && setUpdatedAt(d.updatedAt)).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <PixelText variant="title" color={colors.accent}>설정</PixelText>

        <PixelText variant="caption" color={colors.textDim} style={styles.label}>응원팀</PixelText>
        <PixelButton label="응원팀 변경" onPress={() => navigation.navigate('Onboarding')} accentColor={colors.accent} />

        <PixelText variant="caption" color={colors.textDim} style={styles.label}>데이터</PixelText>
        <Panel>
          <PixelText variant="body">갱신 시각</PixelText>
          <PixelText variant="caption" color={colors.textDim} style={styles.value}>
            {updatedAt ? formatUpdatedAt(updatedAt) : '-'}
          </PixelText>
        </Panel>

        <PixelText variant="caption" color={colors.textDim} style={styles.label}>앱 정보</PixelText>
        <Panel>
          <PixelText variant="body">오늘야구각</PixelText>
          <PixelText variant="caption" color={colors.textDim} style={styles.value}>버전 {APP_VERSION}</PixelText>
          <PixelText variant="caption" color={colors.textDim}>KBO 경기 꿀잼지수 · 데이터 출처: KBO</PixelText>
        </Panel>
      </ScrollView>
    </SafeAreaView>
  );
}

// ISO 문자열을 "YYYY-MM-DD HH:MM" (UTC)로 간단 포맷 (Hermes Intl 의존 회피).
function formatUpdatedAt(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return iso;
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]} (UTC)`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.sm },
  label: { marginTop: spacing.md },
  value: { marginTop: spacing.xs },
});
