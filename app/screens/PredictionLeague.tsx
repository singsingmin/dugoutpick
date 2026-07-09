// 예측 리그 — 내 기록 + 월간 랭킹(포인트 메인·적중률 보조). (Phase 4 Stage 5)
// 설계: docs/prediction-league-design.md §6·7. 참여 자체는 오늘경기 탭 "오늘의 예측" 카드에서.
import { useCallback, useState } from 'react';
import { View, Image, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import {
  fetchPredictionStats, fetchMonthlyLeaderboard, fetchMonthlyHitrateLeaderboard,
  type PredictionStats, type PointsLeaderboardRow, type HitRateLeaderboardRow,
} from '../services/predictions';
import { titleDisplay } from '../utils/titleConfig';
import PixelText from '../components/PixelText';
import Panel from '../components/Panel';
import ScreenHeader from '../components/ScreenHeader';
import SectionLabel from '../components/SectionLabel';
import LeaderboardTable, { type LbRow } from '../components/LeaderboardTable';
import { useTeamTheme } from '../context/TeamTheme';
import { colors, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// supabase/migrations/0006_prediction_league.sql get_monthly_hitrate_leaderboard의 p_min_participation 기본값과 동일하게 유지.
const MIN_HITRATE_PARTICIPATION = 5;

// 메인엔 상위 N명만 표시하고, 내가 그 밖이면 '내 순위'를 표 하단에 고정(방향 B). 전체는 별도 화면(FullLeaderboard).
const TOP_N = 5;

// 상위 N 밖에 있는 내 행만 반환(고정용). is_me 강조는 LeaderboardTable가 처리.
function myPinned(rows: LbRow[]): LbRow | null {
  const me = rows.find((r) => r.isMe);
  return me && me.rank > TOP_N ? me : null;
}

export default function PredictionLeague() {
  const navigation = useNavigation<Nav>();
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
  const equippedTitle = stats?.equippedTitle ? titleDisplay(stats.equippedTitle).label : null;

  const pointsRows: LbRow[] = points.map((r) => ({
    rank: r.rank, nickname: r.nickname, isMe: r.isMe,
    right: `${r.monthlyPoints}점`, sub: `적중 ${r.hits}/${r.participations} · 최고 ${r.bestStreak}연속`,
  }));
  const hitrateRows: LbRow[] = hitrate.map((r) => ({
    rank: r.rank, nickname: r.nickname, isMe: r.isMe,
    right: `${r.hitRate}%`, sub: `적중 ${r.hits}/${r.participations} · 최고 ${r.bestStreak}연속`,
  }));

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
                <View style={styles.emptyBlock}>
                  <PixelText variant="body" color={colors.textDim}>아직 리그에 참여 안 했어요</PixelText>
                  <PixelText variant="body" color={colors.textDim}>오늘경기 탭 '오늘의 예측'에서 시작해보세요</PixelText>
                </View>
              ) : (
                <>
                  <View style={styles.nameRow}>
                    <PixelText variant="title" color={accent}>{myNickname}</PixelText>
                    {equippedTitle && (
                      <View style={styles.titleChip}>
                        <PixelText variant="caption" color={colors.onGreen}>{equippedTitle}</PixelText>
                      </View>
                    )}
                  </View>
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
                  <View style={styles.linkRow}>
                    <Pressable onPress={() => navigation.navigate('TitleList')}>
                      <PixelText variant="caption" color={accent}>내 칭호 관리 ›</PixelText>
                    </Pressable>
                  </View>
                </>
              )}
            </Panel>
          </View>

          {/* 이번 달 포인트 랭킹 — 상위 N + 내 순위 고정, 전체는 별도 화면 */}
          <View style={styles.section}>
            <SectionLabel icon="chart" label="이번 달 포인트 랭킹" />
            {pointsRows.length === 0 ? (
              <Panel><PixelText variant="body" color={colors.textDim}>이번 달 참여 기록이 없어요</PixelText></Panel>
            ) : (
              <>
                <LeaderboardTable rows={pointsRows.slice(0, TOP_N)} accent={accent} myRowPinned={myPinned(pointsRows)} />
                {pointsRows.length > TOP_N && (
                  <Pressable style={styles.moreLink} onPress={() => navigation.navigate('FullLeaderboard', { board: 'points' })}>
                    <PixelText variant="caption" color={accent}>전체 랭킹 보기 ›</PixelText>
                  </Pressable>
                )}
                <PixelText variant="caption" color={colors.textDim} style={styles.tiebreakNote}>
                  동점 시 적중 수 → 적중률 → 최고 연속 순, 모두 같으면 공동 순위
                </PixelText>
              </>
            )}
          </View>

          {/* 이번 달 적중률 랭킹 */}
          <View style={styles.section}>
            <SectionLabel icon="star" label="이번 달 적중률 랭킹" />
            {hitrateRows.length === 0 ? (
              <Panel><PixelText variant="body" color={colors.textDim}>이번 달 {MIN_HITRATE_PARTICIPATION}회 이상 참여한 사람만 집계돼요</PixelText></Panel>
            ) : (
              <>
                <LeaderboardTable rows={hitrateRows.slice(0, TOP_N)} accent={accent} myRowPinned={myPinned(hitrateRows)} />
                {hitrateRows.length > TOP_N && (
                  <Pressable style={styles.moreLink} onPress={() => navigation.navigate('FullLeaderboard', { board: 'hitrate' })}>
                    <PixelText variant="caption" color={accent}>전체 랭킹 보기 ›</PixelText>
                  </Pressable>
                )}
                <PixelText variant="caption" color={colors.textDim} style={styles.tiebreakNote}>
                  적중률 동점 시 적중 수 → 최고 연속 순, 모두 같으면 공동 순위
                </PixelText>
              </>
            )}
          </View>

          <Pressable style={styles.hallLink} onPress={() => navigation.navigate('HallOfFame')}>
            <PixelText variant="body" color={accent}>명예의 전당 보기 ›</PixelText>
          </Pressable>
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
  emptyBlock: { gap: 2 },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  titleChip: { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  linkRow: { marginTop: spacing.sm },
  hallLink: { alignItems: 'center', paddingVertical: spacing.sm },

  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  statCell: { alignItems: 'center', gap: 2 },

  moreLink: { alignItems: 'flex-end', paddingTop: spacing.xs },
  tiebreakNote: { marginTop: spacing.xs },
});
