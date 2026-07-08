// 온보딩: 10팀 색상 그리드에서 응원팀 선택 → 저장 → Tabs. 설정의 '응원팀 변경'에서도 재사용.
import { useEffect, useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import PixelText from '../components/PixelText';
import PixelButton from '../components/PixelButton';
import ScreenHeader from '../components/ScreenHeader';
import { loadTeams } from '../data/load';
import { getCheerTeam, setCheerTeam } from '../data/team';
import { border, colors, spacing } from '../theme';
import { useTeamTheme } from '../context/TeamTheme';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const TEAMS = loadTeams().teams;

export default function Onboarding({ navigation }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const { refresh } = useTeamTheme();

  useEffect(() => {   // 진단(임시)
    const s = typeof performance !== 'undefined' && performance.now ? Math.round(performance.now()) : -1;
    console.log('[onboarding] mount · sincePageLoad≈', s, 'ms');
  }, []);

  useEffect(() => {
    getCheerTeam().then((code) => {
      if (code) setSelected(code);
    });
  }, []);

  const confirm = async () => {
    if (!selected) return;
    await setCheerTeam(selected);
    await refresh();
    navigation.replace('Tabs');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="응원팀 선택" leftIcon="star" />
      <View style={styles.body}>
        <PixelText variant="caption" color={colors.textDim} style={styles.sub}>
          응원팀을 골라라 — 한 팀을 선택하면 시작할 수 있다
        </PixelText>

        <ScrollView contentContainerStyle={styles.grid}>
          {TEAMS.map((t) => {
            const isSel = selected === t.code;
            return (
              <Pressable
                key={t.code}
                onPress={() => setSelected(t.code)}
                style={[
                  styles.cell,
                  isSel
                    ? { borderColor: t.color, backgroundColor: `${t.color}25` }
                    : { borderColor: colors.border },
                ]}
              >
                <View style={[styles.colorBlock, { backgroundColor: t.color }]}>
                  {isSel && (
                    <View style={styles.checkBadge}>
                      <PixelText variant="caption" color="#ffffff" style={styles.checkTxt}>✓</PixelText>
                    </View>
                  )}
                </View>
                <PixelText variant="body" color={isSel ? t.color : colors.text}>{t.name}</PixelText>
                <PixelText variant="caption" color={colors.textDim} numberOfLines={1}>{t.fullName}</PixelText>
              </Pressable>
            );
          })}
        </ScrollView>

        <PixelButton
          label={selected ? '이 팀으로 시작 ▶' : '팀을 선택하세요'}
          onPress={confirm}
          disabled={!selected}
          style={styles.cta}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, paddingHorizontal: spacing.md },
  sub: { textAlign: 'center', marginVertical: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm, paddingBottom: spacing.md },
  cell: {
    width: '48%',
    borderWidth: 1,     // 다크 테두리(얇게 통일)
    borderRadius: border.radius,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },
  colorBlock: { width: '100%', height: 40, borderRadius: border.radius },
  checkBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkTxt: { fontSize: 11 },
  cta: { marginVertical: spacing.md },
});
