// 스플래시/랜딩: 픽셀 로고 + 야구공 + 말풍선. 기존 응원팀 있으면 자동 진입, 없으면 '시작하기'→온보딩.
import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import PixelText from '../components/PixelText';
import Panel from '../components/Panel';
import PixelButton from '../components/PixelButton';
import { getCheerTeam } from '../data/team';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export default function Splash({ navigation }: Props) {
  const [showStart, setShowStart] = useState(false);

  useEffect(() => {
    let active = true;
    getCheerTeam().then((team) => {
      if (!active) return;
      if (team) setTimeout(() => active && navigation.replace('Tabs'), 700); // 재방문자는 바로 진입
      else setShowStart(true); // 신규: 랜딩 노출
    });
    return () => {
      active = false;
    };
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.logoRow}>
        <PixelText variant="hero" color={colors.text}>오늘</PixelText>
        <PixelText variant="hero" color={colors.bad}>야구</PixelText>
        <PixelText variant="hero" color={colors.text}>각</PixelText>
      </View>

      <PixelText style={styles.ball}>⚾</PixelText>

      <Panel style={styles.bubble}>
        <PixelText variant="body">오늘 KBO, 볼 각인가?</PixelText>
      </Panel>

      {showStart && (
        <PixelButton label="시작하기 ▶" onPress={() => navigation.replace('Onboarding')} style={styles.cta} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.lg },
  logoRow: { flexDirection: 'row' },
  ball: { fontSize: 72 },
  bubble: { alignItems: 'center' },
  cta: { alignSelf: 'stretch', marginTop: spacing.sm },
});
