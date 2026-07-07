// 예측 리그 — 내 기록 + 월간 랭킹(포인트 메인·적중률 보조). (Phase 4 Stage 5)
// 설계: docs/prediction-league-design.md §6·7. 참여 자체는 오늘경기 탭 "오늘의 예측" 카드에서.
import { useCallback, useState } from 'react';
import { View, Image, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  fetchPredictionStats, fetchMonthlyLeaderboard, fetchMonthlyHitrateLeaderboard,
  type PredictionStats, type PointsLeaderboardRow, type HitRateLeaderboardRow,
} from '../services/predictions';
import PixelText from '../components/PixelText';
import Panel from '../components/Panel';
import ScreenHeader from '../components/ScreenHeader';
import SectionLabel from '../components/SectionLabel';
import { useTeamTheme } from '../context/TeamTheme';
import { border, colors, spacing } from '../theme';

function Row({ rank, nickname, mine, right, sub }: { rank: number; nickname: string; mine: boolean; right: string; sub?: string }) {
  return (
    <View style={[styles.row, mine && styles.rowMine]}>
      <PixelText variant="caption" color={colors.textDim} style={styles.rankCol}>{rank}</PixelText>
      <View style={styles.nameCol}>
        <PixelText variant="body" color={mine ? colors.accent : colors.text} numberOfLines={1}>{nickname}</PixelText>
        {sub && <PixelText variant="caption" color={colors.textDim}>{sub}</PixelText>}
      </View>
      <PixelText variant="body" color={colors.text}>{right}</PixelText>
    </View>
  );
}

export default function PredictionLeague() {
  const navigation = useNavigation();
  const { accent } = useTeamTheme();
  const [stats, setStats] = useState<PredictionStats | null>(null);
  const [points, setPoints] = useState<PointsLeaderboardRow[]>([]);
  const [hitrate, setHitrate] = useState<HitRateLeaderboardRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([fetchPredictionStats(), fetchMonthlyLeaderboard(20), fetchMonthlyHitrateLeaderboard(20)])
        .then(([s, p, h]) => { if (!active) return; setStats(s); setPoints(p); setHitrate(h); setLoaded(true); })
        .catch(() => { if (active) setLoaded(true); });
      return () => { active = false; };
    }, [])
  );

  const myNickname = stats?.nickname ?? null;

  return (
    <View style={styles.root}>
      <Image source={require('../assets/stadium-bg.webp')} style={styles.bgImage} resizeMode="cover" />
      <View style={styles.bgOverlay} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="예측 리그" leftIcon="back" onLeftPress={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.content}>
          {/* 내 기록 */}
          <View style={styles.section}>
            <SectionLabel icon="sparkles" label="내 기록" />
            <Panel>
              {!loaded ? (
                <PixelText variant="caption" color={colors.textDim}>불러오는 중...</PixelText>
              ) : !myNickname ? (
                <PixelText variant="body" color={colors.textDim}>아직 리그에 참여 안 했어요 — 오늘경기 탭 "오늘의 예측"에서 시작해보세요</PixelText>
              ) : (
                <>
                  <PixelText variant="title" color={accent}>{myNickname}</PixelText>
                  <View style={styles.statRow}>
                    <View style={styles.statCell}>
                      <PixelText variant="caption" color={colors.textDim}>통산 적중</PixelText>
                      <PixelText variant="body" color={colors.text}>{stats!.totalHits}/{stats!.totalPredictions}</PixelText>
                    </View>
                    <View style={styles.statCell}>
                      <PixelText variant="caption" color={colors.textDim}>현재 연속</PixelText>
                      <PixelText variant="body" color={colors.text}>{stats!.currentStreak}</PixelText>
                    </View>
                    <View style={styles.statCell}>
                      <PixelText variant="caption" color={colors.textDim}>최고 연속</PixelText>
                      <PixelText variant="body" color={colors.text}>{stats!.bestStreak}</PixelText>
                    </View>
                  </View>
                </>
              )}
            </Panel>
          </View>

          {/* 이번달 포인트 랭킹 */}
          <View style={styles.section}>
            <SectionLabel icon="chart" label="이번달 포인트 랭킹" />
            <Panel>
              {points.length === 0 ? (
                <PixelText variant="body" color={colors.textDim}>이번달 참여 기록이 없어요</PixelText>
              ) : (
                points.map((r, i) => (
                  <Row key={r.nickname} rank={i + 1} nickname={r.nickname} mine={r.nickname === myNickname}
                    right={`${r.monthlyPoints}점`} sub={`적중 ${r.hits}/${r.participations}`} />
                ))
              )}
            </Panel>
          </View>

          {/* 이번달 적중률 랭킹 */}
          <View style={styles.section}>
            <SectionLabel icon="star" label="이번달 적중률 랭킹" />
            <PixelText variant="caption" color={colors.textDim} style={styles.hint}>최소 참여 횟수를 채운 사람만 집계돼요</PixelText>
            <Panel>
              {hitrate.length === 0 ? (
                <PixelText variant="body" color={colors.textDim}>아직 조건을 채운 사람이 없어요</PixelText>
              ) : (
                hitrate.map((r, i) => (
                  <Row key={r.nickname} rank={i + 1} nickname={r.nickname} mine={r.nickname === myNickname}
                    right={`${r.hitRate}%`} sub={`${r.hits}/${r.participations}`} />
                ))
              )}
            </Panel>
          </View>
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
  content: { padding: spacing.md },
  section: { marginBottom: spacing.lg },
  hint: { marginBottom: spacing.xs },

  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  statCell: { alignItems: 'center', gap: 2 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.surfaceAlt,
  },
  rowMine: { backgroundColor: colors.surfaceAlt, borderRadius: border.radius },
  rankCol: { width: 24, textAlign: 'center' },
  nameCol: { flex: 1 },
});
