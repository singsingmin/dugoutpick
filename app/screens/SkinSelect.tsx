// 유니폼 스킨 선택 화면. 3종 프리셋을 팀 컬러 미리보기로 표시.
import { View, Image, ScrollView, Pressable, StyleSheet } from 'react-native';
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
    <View style={styles.root}>
      <Image source={require('../assets/stadium-bg.png')} style={styles.bgImage} resizeMode="cover" />
      <View style={styles.bgOverlay} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader
          title="유니폼 스킨"
          leftIcon="back"
          onLeftPress={() => navigation.goBack()}
        />
        <ScrollView contentContainerStyle={styles.content}>
          <PixelText variant="caption" color={colors.textDim} style={styles.hint}>
            원하는 스킨을 선택하세요
          </PixelText>
          <View style={styles.grid}>
            {PRESETS.map((p) => {
              const selected = p.id === preset;
              return (
                <Pressable
                  key={p.id}
                  style={[
                    styles.card,
                    selected
                      ? { borderColor: accent, borderWidth: 2 }
                      : { borderColor: 'rgba(45,36,20,0.18)', borderWidth: 1 },
                  ]}
                  onPress={() => handleSelect(p.id)}
                >
                  {/* badgeLabel 태그 */}
                  <View style={[styles.badgeTag, selected && { backgroundColor: accent }]}>
                    <PixelText
                      variant="caption"
                      color={selected ? '#fff' : colors.textDim}
                      style={styles.badgeTagText}
                    >
                      {p.badgeLabel}
                    </PixelText>
                  </View>

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
                    {p.label}
                  </PixelText>

                  {selected && (
                    <PixelText variant="caption" color={accent} style={styles.inUse}>
                      사용 중
                    </PixelText>
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bgImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  bgOverlay: {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(243,233,206,0.35)',
  },
  safe: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing.md },
  hint: { textAlign: 'center', marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: {
    width: '47%',
    alignItems: 'center',
    backgroundColor: 'rgba(255,252,245,0.92)',
    borderRadius: border.radius,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  badgeTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(45,36,20,0.10)',
  },
  badgeTagText: { fontSize: 10 },
  label: { textAlign: 'center' },
  inUse: { textAlign: 'center' },
});
