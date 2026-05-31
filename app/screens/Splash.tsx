// 스플래시: 픽셀 로고 표시 후 응원팀 유무로 분기 (flow.md).
import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import PixelText from '../components/PixelText';
import { getCheerTeam } from '../data/team';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export default function Splash({ navigation }: Props) {
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      const team = await getCheerTeam();
      if (!active) return;
      navigation.replace(team ? 'Tabs' : 'Onboarding');
    }, 800);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [navigation]);

  return (
    <View style={styles.container}>
      {/* 텍스트 기반 8비트 로고 (이미지 금지, ADR-009) */}
      <View style={styles.badge}>
        <PixelText variant="caption" color={colors.bg}>⚾ KBO</PixelText>
      </View>
      <PixelText variant="hero" color={colors.accent}>오늘야구각</PixelText>
      <PixelText variant="caption" color={colors.textDim}>오늘 뭐 볼까?</PixelText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  badge: { backgroundColor: colors.accent, paddingHorizontal: spacing.sm, paddingVertical: 2, marginBottom: spacing.xs },
});
