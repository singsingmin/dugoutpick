// 유니폼 스킨 선택 화면. 5종 프리셋을 팀 컬러 미리보기로 표시.
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTeamTheme } from '../context/TeamTheme';
import { useUniformPreset } from '../context/UniformPreset';
import { UNIFORM_PRESETS, type UniformPresetId } from '../utils/uniformResolver';
import JerseyScoreBadge from '../components/JerseyScoreBadge';
import PixelText from '../components/PixelText';
import ScreenHeader from '../components/ScreenHeader';
import { border, colors, spacing } from '../theme';

const PRESETS = Object.values(UNIFORM_PRESETS) as (typeof UNIFORM_PRESETS)[UniformPresetId][];

export default function SkinSelect() {
  const navigation = useNavigation();
  const { accent } = useTeamTheme();
  const { preset, setPreset } = useUniformPreset();

  const handleSelect = async (id: UniformPresetId) => {
    await setPreset(id);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader
        title="유니폼 스킨"
        leftIcon="back"
        onLeftPress={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <PixelText variant="caption" color={colors.textDim} style={styles.hint}>
          탭해서 스킨 선택
        </PixelText>
        <View style={styles.grid}>
          {PRESETS.map((p) => {
            const selected = p.id === preset;
            return (
              <Pressable
                key={p.id}
                style={[styles.card, selected && { borderColor: accent, borderWidth: 2 }]}
                onPress={() => handleSelect(p.id)}
              >
                <JerseyScoreBadge
                  score={75}
                  variant="hero"
                  homeTeamColor={accent}
                  uniformPreset={p.id}
                  showLabel={false}
                />
                <PixelText
                  variant="body"
                  color={selected ? accent : colors.text}
                  style={styles.label}
                >
                  {selected ? '✓ ' : ''}{p.label}
                </PixelText>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md },
  hint: { textAlign: 'center', marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: {
    width: '47%',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: border.radius,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  label: { textAlign: 'center' },
});
