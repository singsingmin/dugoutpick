// 꿀잼지수 스킨 선택 — 썸네일 갤러리형. 카테고리 탭 + 3열 그리드 + 현재적용 바 + 탭 즉시적용.
import { useEffect, useRef, useState } from 'react';
import { View, Image, ScrollView, Pressable, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTeamTheme } from '../context/TeamTheme';
import { useScoreSkin } from '../context/ScoreSkin';
import {
  SCORE_SKIN_LIST,
  type ScoreSkinId,
  type ScoreSkinConfig,
  type ScoreSkinCategory,
} from '../utils/scoreSkinConfig';
import JerseyScoreBadge from '../components/JerseyScoreBadge';
import ScoreboardScoreBadge, { type ScoreboardVariant } from '../components/ScoreboardScoreBadge';
import PixelText from '../components/PixelText';
import ScreenHeader from '../components/ScreenHeader';
import { border, colors, spacing } from '../theme';

const PREVIEW_SCORE = 75;

// 3열 그리드 셀 폭(화면폭 - 좌우패딩 - 셀 간격 2개) / 3.
const SCREEN_W = Dimensions.get('window').width;
const GRID_GAP = spacing.sm;
const CELL_W = Math.floor((SCREEN_W - spacing.md * 2 - GRID_GAP * 2) / 3);

type TabKey = 'all' | ScoreSkinCategory;
const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'uniform', label: '유니폼' },
  { key: 'stadium', label: '야구장' },
  { key: 'special', label: '스페셜' },
];

// 그리드/바 공용 썸네일 — kind별로 compact 렌더(전 스킨 시각 footprint 통일).
function SkinThumb({ config, teamColor }: { config: ScoreSkinConfig; teamColor: string }) {
  if (config.kind === 'scoreboard') {
    return <ScoreboardScoreBadge score={PREVIEW_SCORE} variant={'compact' as ScoreboardVariant} teamColor={teamColor} />;
  }
  return (
    <JerseyScoreBadge
      score={PREVIEW_SCORE}
      variant="compact"
      teamColor={teamColor}
      uniformPreset={config.uniformPreset}
      showLabel={false}
    />
  );
}

export default function SkinSelect() {
  const navigation = useNavigation();
  const { accent } = useTeamTheme();
  const { skinId, setSkin } = useScoreSkin();
  const [tab, setTab] = useState<TabKey>('all');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const selectedConfig = SCORE_SKIN_LIST.find((s) => s.id === skinId) ?? SCORE_SKIN_LIST[0];
  const visible = tab === 'all' ? SCORE_SKIN_LIST : SCORE_SKIN_LIST.filter((s) => s.category === tab);

  const handleSelect = async (s: ScoreSkinConfig) => {
    await setSkin(s.id);
    setToast(`${s.label} 적용됨`);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1500);
  };

  return (
    <View style={styles.root}>
      <Image source={require('../assets/stadium-bg.png')} style={styles.bgImage} resizeMode="cover" />
      <View style={styles.bgOverlay} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="꿀잼지수 스킨" leftIcon="back" onLeftPress={() => navigation.goBack()} />

        {/* 현재 적용 바 (작게) */}
        <View style={styles.currentBar}>
          <View style={styles.currentThumb}>
            <SkinThumb config={selectedConfig} teamColor={accent} />
          </View>
          <View style={styles.currentText}>
            <PixelText variant="caption" color={colors.textDim}>현재 적용</PixelText>
            <PixelText variant="body" color={colors.text}>{selectedConfig.label}</PixelText>
          </View>
        </View>

        {/* 카테고리 탭 */}
        <View style={styles.tabs}>
          {TABS.map((t) => {
            const on = t.key === tab;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[styles.tab, on ? { backgroundColor: accent, borderColor: accent } : null]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <PixelText variant="caption" color={on ? '#fff' : colors.text}>{t.label}</PixelText>
              </Pressable>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {visible.length === 0 ? (
            <View style={styles.empty}>
              <PixelText variant="body" color={colors.textDim}>준비 중인 스킨이에요</PixelText>
            </View>
          ) : (
            <View style={styles.grid}>
              {visible.map((s) => {
                const selected = s.id === skinId;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => handleSelect(s)}
                    accessibilityRole="button"
                    accessibilityLabel={s.label}
                    accessibilityState={{ selected }}
                    style={[
                      styles.cell,
                      { width: CELL_W },
                      selected
                        ? { borderColor: accent, borderWidth: 2 }
                        : { borderColor: 'rgba(45,36,20,0.16)', borderWidth: 1 },
                    ]}
                  >
                    <View style={styles.thumbBox}>
                      <SkinThumb config={s} teamColor={accent} />
                    </View>
                    {selected && (
                      <View style={[styles.check, { backgroundColor: accent }]}>
                        <PixelText variant="caption" color="#fff" style={styles.checkMark}>✓</PixelText>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* 적용 토스트 */}
      {toast && (
        <View style={styles.toastWrap} pointerEvents="none">
          <View style={styles.toast}>
            <PixelText variant="caption" color="#fff">{toast}</PixelText>
          </View>
        </View>
      )}
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

  currentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 92,
    marginHorizontal: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255,252,245,0.92)',
    borderRadius: border.radius,
    borderWidth: 1,
    borderColor: 'rgba(45,36,20,0.12)',
  },
  currentThumb: { width: 72, alignItems: 'center', justifyContent: 'center' },
  currentText: { gap: 2 },

  tabs: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.md, marginTop: spacing.md },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(45,36,20,0.18)',
    backgroundColor: 'rgba(255,252,245,0.85)',
  },

  content: { padding: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  cell: {
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,252,245,0.92)',
    borderRadius: border.radius,
  },
  thumbBox: { alignItems: 'center', justifyContent: 'center' },
  check: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { fontSize: 11, lineHeight: 13 },

  empty: { alignItems: 'center', paddingVertical: spacing.xl },

  toastWrap: { position: 'absolute', left: 0, right: 0, bottom: 40, alignItems: 'center' },
  toast: {
    backgroundColor: 'rgba(30,24,12,0.92)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
});
