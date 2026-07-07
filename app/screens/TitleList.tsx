// 보유 칭호 목록 + 장착/해제 (Phase 4 Stage 6). 설계: docs/stage6-cosmetics-design.md §6-2.
import { useCallback, useState } from 'react';
import { View, Image, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/Auth';
import { useTeamTheme } from '../context/TeamTheme';
import { fetchOwnedTitles, equipTitle, type OwnedTitle } from '../services/cosmetics';
import { fetchPredictionStats } from '../services/predictions';
import { titleDisplay } from '../utils/titleConfig';
import PixelText from '../components/PixelText';
import Panel from '../components/Panel';
import ScreenHeader from '../components/ScreenHeader';
import { border, colors, spacing } from '../theme';

export default function TitleList() {
  const navigation = useNavigation();
  const { userId } = useAuth();
  const { accent } = useTeamTheme();
  const [titles, setTitles] = useState<OwnedTitle[]>([]);
  const [equipped, setEquipped] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([fetchOwnedTitles(), fetchPredictionStats()])
        .then(([t, s]) => { if (!active) return; setTitles(t); setEquipped(s?.equippedTitle ?? null); setLoaded(true); })
        .catch(() => setLoaded(true));
      return () => { active = false; };
    }, [])
  );

  const toggleEquip = async (titleId: string) => {
    if (!userId || busyId) return;
    const next = equipped === titleId ? null : titleId;
    setBusyId(titleId);
    try {
      await equipTitle(next);
      setEquipped(next);
    } catch {
      // 실패 — 조용히 무시(장착은 민감 쓰기 아님, 다음 진입 때 실제 상태로 갱신)
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.root}>
      <Image source={require('../assets/stadium-bg.webp')} style={styles.bgImage} resizeMode="cover" />
      <View style={styles.bgOverlay} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="내 칭호" leftIcon="back" onLeftPress={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.content}>
          {!loaded ? (
            <PixelText variant="caption" color={colors.textDim}>불러오는 중...</PixelText>
          ) : titles.length === 0 ? (
            <PixelText variant="body" color={colors.textDim}>아직 보유한 칭호가 없어요</PixelText>
          ) : (
            titles.map((t) => {
              const display = titleDisplay(t.titleId);
              const isEquipped = equipped === t.titleId;
              return (
                <Panel key={t.titleId} style={[styles.row, isEquipped && { borderColor: accent }]}>
                  <View style={styles.rowText}>
                    <PixelText variant="body" color={colors.text}>{display.label}</PixelText>
                    {display.description && (
                      <PixelText variant="caption" color={colors.textDim}>{display.description}</PixelText>
                    )}
                  </View>
                  <Pressable
                    style={[styles.equipBtn, isEquipped && { backgroundColor: accent }]}
                    disabled={busyId === t.titleId}
                    onPress={() => toggleEquip(t.titleId)}
                  >
                    <PixelText variant="caption" color={isEquipped ? colors.onGreen : colors.text}>
                      {isEquipped ? '장착중' : '장착'}
                    </PixelText>
                  </Pressable>
                </Panel>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bgImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  bgOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(243,233,206,0.35)' },
  safe: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { flex: 1, gap: 2 },
  equipBtn: {
    borderRadius: border.radius, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: colors.surfaceAlt,
  },
});
