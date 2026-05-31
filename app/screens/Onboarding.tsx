// 온보딩: 10팀 색상 그리드에서 응원팀 선택 → 저장 → Tabs. 설정의 '응원팀 변경'에서도 재사용.
import { useEffect, useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import PixelText from '../components/PixelText';
import PixelButton from '../components/PixelButton';
import { loadTeams } from '../data/load';
import { getCheerTeam, setCheerTeam } from '../data/team';
import { border, colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const TEAMS = loadTeams().teams;

export default function Onboarding({ navigation }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  // 이미 저장된 응원팀이 있으면 미리 선택 표시(설정에서 재진입 대응).
  useEffect(() => {
    getCheerTeam().then((code) => {
      if (code) setSelected(code);
    });
  }, []);

  const confirm = async () => {
    if (!selected) return;
    await setCheerTeam(selected);
    navigation.replace('Tabs');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <PixelText variant="title" color={colors.accent} style={styles.header}>
        응원팀을 골라라
      </PixelText>
      <PixelText variant="caption" color={colors.textDim} style={styles.sub}>
        한 팀을 선택하면 시작할 수 있다
      </PixelText>

      <ScrollView contentContainerStyle={styles.grid}>
        {TEAMS.map((t) => {
          const isSel = selected === t.code;
          return (
            <Pressable
              key={t.code}
              onPress={() => setSelected(t.code)}
              style={[styles.cell, { borderColor: isSel ? colors.accent : colors.border }]}
            >
              <View style={[styles.colorBlock, { backgroundColor: t.color }]} />
              <PixelText variant="body" color={isSel ? colors.accent : colors.text}>
                {t.name}
              </PixelText>
              <PixelText variant="caption" color={colors.textDim} numberOfLines={1}>
                {t.fullName}
              </PixelText>
            </Pressable>
          );
        })}
      </ScrollView>

      <PixelButton
        label={selected ? '이 팀으로 시작' : '팀을 선택하세요'}
        onPress={confirm}
        disabled={!selected}
        accentColor={colors.accent}
        style={styles.cta}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.md },
  header: { marginTop: spacing.md, textAlign: 'center' },
  sub: { textAlign: 'center', marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm, paddingBottom: spacing.md },
  cell: {
    width: '48%',
    borderWidth: border.width,
    borderRadius: border.radius,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },
  colorBlock: { width: '100%', height: 40, borderRadius: border.radius },
  cta: { marginVertical: spacing.md },
});
