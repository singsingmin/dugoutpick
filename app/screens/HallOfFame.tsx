// 명예의 전당 — 월간/시즌 수상 이력 (Phase 4 Stage 6). 설계: docs/stage6-cosmetics-design.md §6-2b.
// award_history_public 뷰만 조회 — user_id 컬럼 자체가 없어 구조적으로 비공개.
import { useCallback, useState } from 'react';
import { View, Image, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTeamTheme } from '../context/TeamTheme';
import { fetchAwardHistory, type AwardHistoryRow } from '../services/cosmetics';
import { awardTypeLabel, formatPeriod, titleDisplay } from '../utils/titleConfig';
import { backgroundInstanceLabel } from '../utils/lockerBackgroundConfig';
import PixelText from '../components/PixelText';
import Panel from '../components/Panel';
import ScreenHeader from '../components/ScreenHeader';
import Loading from '../components/Loading';
import { colors, spacing } from '../theme';

type Tab = 'monthly' | 'season';

function periodHeading(row: AwardHistoryRow): string {
  return row.periodType === 'monthly' ? formatPeriod('monthly', row.periodLabel) : formatPeriod('season', row.periodLabel);
}

export default function HallOfFame() {
  const navigation = useNavigation();
  const { accent } = useTeamTheme();
  const [tab, setTab] = useState<Tab>('monthly');
  const [rows, setRows] = useState<AwardHistoryRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoaded(false);
      fetchAwardHistory(tab)
        .then((r) => { if (active) { setRows(r); setLoaded(true); } })
        .catch(() => { if (active) setLoaded(true); });
      return () => { active = false; };
    }, [tab])
  );

  // 시기별 그룹핑(최신순 — fetchAwardHistory가 이미 awarded_at desc)
  const groups: { period: string; rows: AwardHistoryRow[] }[] = [];
  for (const r of rows) {
    const period = periodHeading(r);
    const last = groups[groups.length - 1];
    if (last && last.period === period) last.rows.push(r);
    else groups.push({ period, rows: [r] });
  }

  return (
    <View style={styles.root}>
      <Image source={require('../assets/stadium-bg.webp')} style={styles.bgImage} resizeMode="cover" />
      <View style={styles.bgOverlay} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="명예의 전당" leftIcon="back" onLeftPress={() => navigation.goBack()} />

        <View style={styles.tabs}>
          {(['monthly', 'season'] as Tab[]).map((t) => {
            const on = t === tab;
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={[styles.tab, on && { backgroundColor: accent, borderColor: accent }]}
              >
                <PixelText variant="caption" color={on ? '#fff' : colors.text}>{t === 'monthly' ? '월간' : '시즌'}</PixelText>
              </Pressable>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {!loaded ? (
            <Loading />
          ) : groups.length === 0 ? (
            <PixelText variant="body" color={colors.textDim}>아직 수상 기록이 없어요</PixelText>
          ) : (
            groups.map((g) => (
              <View key={g.period} style={styles.section}>
                <PixelText variant="title" color={colors.text} style={styles.periodTitle}>{g.period}</PixelText>
                <Panel>
                  {g.rows.map((r, i) => {
                    const reward = r.grantedTitleId ? titleDisplay(r.grantedTitleId).label
                      : r.grantedBackgroundId ? backgroundInstanceLabel(r.grantedBackgroundId, r.periodType, r.periodLabel)
                      : null;
                    return (
                      <View key={`${r.awardType}-${r.rank}-${i}`} style={styles.row}>
                        <PixelText variant="caption" color={colors.textDim} style={styles.rankCol}>
                          {r.awardType === 'top10' ? `${r.rank}위` : awardTypeLabel(r.awardType)}
                        </PixelText>
                        <View style={styles.nameCol}>
                          <PixelText variant="body" color={r.isUserDeleted ? colors.textDim : colors.text}>{r.displayName}</PixelText>
                          {reward && <PixelText variant="caption" color={colors.textDim}>{reward}</PixelText>}
                        </View>
                      </View>
                    );
                  })}
                </Panel>
              </View>
            ))
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
  tabs: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.md, marginTop: spacing.sm },
  tab: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  content: { padding: spacing.md },
  section: { marginBottom: spacing.lg },
  periodTitle: { marginBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.surfaceAlt },
  rankCol: { width: 56 },
  nameCol: { flex: 1, gap: 2 },
});
