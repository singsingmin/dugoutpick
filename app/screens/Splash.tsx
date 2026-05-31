// 스플래시/랜딩: 항상 멈춰서 '시작하기'를 눌러야 진입. 화면을 꽉 채우는 구성(상/중/하).
import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import PixelText from '../components/PixelText';
import Panel from '../components/Panel';
import PixelButton from '../components/PixelButton';
import { getCheerTeam } from '../data/team';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

const Spark = ({ style }: { style?: object }) => (
  <PixelText style={[styles.spark, style]} color={colors.accent}>✦</PixelText>
);

export default function Splash({ navigation }: Props) {
  const [team, setTeam] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getCheerTeam().then((c) => active && setTeam(c));
    return () => { active = false; };
  }, []);

  // 항상 버튼으로만 진입: 응원팀 있으면 오늘경기, 없으면 온보딩
  const start = () => navigation.replace(team ? 'Tabs' : 'Onboarding');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* 상단: 로고 */}
        <View style={styles.top}>
          <View style={styles.sparkRow}>
            <Spark /><Spark style={styles.sparkBig} /><Spark />
          </View>
          <View style={styles.logoRow}>
            <PixelText style={styles.logo} color={colors.text}>오늘</PixelText>
            <PixelText style={styles.logo} color={colors.bad}>야구</PixelText>
            <PixelText style={styles.logo} color={colors.text}>각</PixelText>
          </View>
          <PixelText variant="body" color={colors.textDim}>KBO 꿀잼지수 가이드</PixelText>
        </View>

        {/* 중앙: 야구공 */}
        <View style={styles.mid}>
          <Spark style={styles.sparkL} />
          <Spark style={styles.sparkR} />
          <PixelText style={styles.ball}>⚾</PixelText>
        </View>

        {/* 하단: 말풍선 + 시작하기 */}
        <View style={styles.bottom}>
          <Panel style={styles.bubble} accentColor={colors.accent}>
            <PixelText variant="title" color={colors.text}>오늘 KBO, 볼 각인가?</PixelText>
          </Panel>
          <PixelButton label="시작하기 ▶" onPress={start} style={styles.cta} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  // 상단
  top: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  sparkRow: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.xs },
  logoRow: { flexDirection: 'row' },
  logo: { fontSize: 44 },
  // 중앙
  mid: { flex: 1, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', position: 'relative' },
  ball: { fontSize: 140 },
  spark: { fontSize: 18 },
  sparkBig: { fontSize: 26 },
  sparkL: { position: 'absolute', left: '12%', top: '18%', fontSize: 22 },
  sparkR: { position: 'absolute', right: '14%', top: '30%', fontSize: 16 },
  // 하단
  bottom: { alignSelf: 'stretch', alignItems: 'center', gap: spacing.lg },
  bubble: { alignItems: 'center', alignSelf: 'stretch' },
  cta: { alignSelf: 'stretch', paddingVertical: spacing.lg },
});
