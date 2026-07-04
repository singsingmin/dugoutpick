// 계정 연결 유도 넛지 (Phase 3 Stage 4) — phase3-account-design.md §6.
// 닫기 가능 인라인 배너 + CTA(설정으로 이동). 자동 이동 X(문서 결정: 강매감 방지).
// 노출 조건: 미연결 + (첫 스킨 구매 or 7일 연속 출석) + 미닫힘. 연결되면 자동 사라짐.
import { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/Auth';
import { useScoreSkin } from '../context/ScoreSkin';
import PixelText from './PixelText';
import PixelButton from './PixelButton';
import { colors, spacing, border } from '../theme';

const DISMISS_KEY = 'dugout.nudge.protect.dismissed';

export default function ProtectNudge() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isProtected } = useAuth();
  const { transactions, attendanceStreak } = useScoreSkin();
  const [dismissed, setDismissed] = useState(true);   // 로드 전엔 숨김(깜빡임 방지)

  useEffect(() => {
    AsyncStorage.getItem(DISMISS_KEY).then((v) => setDismissed(v === '1')).catch(() => {});
  }, []);

  const hasPurchased = transactions.some((t) => t.reason === 'skin_purchase');
  const eligible = !isProtected && (hasPurchased || attendanceStreak >= 7);
  if (dismissed || !eligible) return null;

  const dismiss = () => { setDismissed(true); void AsyncStorage.setItem(DISMISS_KEY, '1'); };

  return (
    <View style={styles.banner}>
      <View style={styles.textCol}>
        <PixelText variant="body" color={colors.text}>🔒 야구공·스킨, 안전하게 지키세요</PixelText>
        <PixelText variant="caption" color={colors.textDim} style={styles.sub}>
          지금 연결 안 하면 앱을 지웠을 때 다 사라져요
        </PixelText>
        <PixelButton
          label="구글 계정 연결하기"
          accentColor={colors.good}
          onPress={() => navigation.navigate('Settings')}
          style={styles.cta}
        />
      </View>
      <Pressable onPress={dismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
        <PixelText variant="body" color={colors.textDim}>✕</PixelText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.good,
    borderWidth: border.width,
    borderRadius: border.radius,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  textCol: { flex: 1 },
  sub: { marginTop: spacing.xs },
  cta: { marginTop: spacing.sm, alignSelf: 'flex-start', paddingHorizontal: spacing.lg },
});
