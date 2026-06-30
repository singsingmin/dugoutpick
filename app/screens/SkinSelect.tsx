// 꿀잼지수 스킨 선택 화면. 4종 프리셋, 상단 미리보기, 탭=즉시적용·화면유지.
import { View, Image, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTeamTheme } from '../context/TeamTheme';
import { useScoreSkin } from '../context/ScoreSkin';
import { SCORE_SKIN_LIST, type ScoreSkinId, type ScoreSkinConfig } from '../utils/scoreSkinConfig';
import JerseyScoreBadge from '../components/JerseyScoreBadge';
import ScoreboardScoreBadge from '../components/ScoreboardScoreBadge';
import PixelText from '../components/PixelText';
import ScreenHeader from '../components/ScreenHeader';
import { border, colors, spacing } from '../theme';

const PREVIEW_SCORE = 75;

function SkinPreviewBadge({
  config,
  teamColor,
  variant,
  showLabel,
}: {
  config: ScoreSkinConfig;
  teamColor: string;
  variant: 'hero' | 'compact' | 'detail';
  showLabel: boolean;
}) {
  if (config.kind === 'scoreboard') {
    return (
      <ScoreboardScoreBadge
        score={PREVIEW_SCORE}
        variant={variant}
        teamColor={teamColor}
        showLabel={showLabel}
      />
    );
  }
  return (
    <JerseyScoreBadge
      score={PREVIEW_SCORE}
      variant={variant}
      teamColor={teamColor}
      uniformPreset={config.uniformPreset}
      showLabel={showLabel}
    />
  );
}

export default function SkinSelect() {
  const navigation = useNavigation();
  const { accent } = useTeamTheme();
  const { skinId, setSkin } = useScoreSkin();

  const selectedConfig = SCORE_SKIN_LIST.find((s) => s.id === skinId) ?? SCORE_SKIN_LIST[0];

  const handleSelect = async (id: ScoreSkinId) => {
    await setSkin(id);
  };

  return (
    <View style={styles.root}>
      <Image source={require('../assets/stadium-bg.png')} style={styles.bgImage} resizeMode="cover" />
      <View style={styles.bgOverlay} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader
          title="꿀잼지수 스킨"
          leftIcon="back"
          onLeftPress={() => navigation.goBack()}
        />
        <ScrollView contentContainerStyle={styles.content}>
          {/* 상단 미리보기 */}
          <View style={styles.previewBox}>
            <PixelText variant="caption" color={colors.textDim} style={styles.previewLabel}>
              미리보기 · {selectedConfig.label}
            </PixelText>
            <SkinPreviewBadge
              config={selectedConfig}
              teamColor={accent}
              variant="detail"
              showLabel
            />
          </View>

          <PixelText variant="caption" color={colors.textDim} style={styles.hint}>
            탭하면 즉시 적용돼요
          </PixelText>

          {/* 4종 카드 그리드 */}
          <View style={styles.grid}>
            {SCORE_SKIN_LIST.map((s) => {
              const selected = s.id === skinId;
              return (
                <Pressable
                  key={s.id}
                  style={[
                    styles.card,
                    selected
                      ? { borderColor: accent, borderWidth: 2 }
                      : { borderColor: 'rgba(45,36,20,0.18)', borderWidth: 1 },
                  ]}
                  onPress={() => handleSelect(s.id)}
                >
                  <View style={[styles.badgeTag, selected && { backgroundColor: accent }]}>
                    <PixelText
                      variant="caption"
                      color={selected ? '#fff' : colors.textDim}
                      style={styles.badgeTagText}
                    >
                      {s.badgeLabel}
                    </PixelText>
                  </View>

                  <SkinPreviewBadge
                    config={s}
                    teamColor={accent}
                    variant="hero"
                    showLabel={false}
                  />

                  <PixelText
                    variant="body"
                    color={selected ? accent : colors.text}
                    style={styles.cardLabel}
                  >
                    {s.label}
                  </PixelText>

                  <PixelText
                    variant="caption"
                    color={colors.textDim}
                    style={styles.cardDesc}
                  >
                    {s.description}
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
  content: { padding: spacing.md, gap: spacing.md },
  previewBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,252,245,0.92)',
    borderRadius: border.radius,
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(45,36,20,0.12)',
    gap: spacing.md,
  },
  previewLabel: { textAlign: 'center' },
  hint: { textAlign: 'center' },
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
  cardLabel: { textAlign: 'center' },
  cardDesc: { textAlign: 'center', fontSize: 9 },
  inUse: { textAlign: 'center' },
});
