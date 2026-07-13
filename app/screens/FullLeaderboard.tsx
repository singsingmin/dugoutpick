// 전체 랭킹 화면(방향 B) — 예측 리그 메인의 '전체 랭킹 보기'에서 진입.
// board 파라미터로 포인트/적중률 중 하나의 전체 목록을 순위표 톤으로 표시.
import { useCallback, useState } from 'react';
import { View, Image, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { fetchMonthlyLeaderboard, fetchMonthlyHitrateLeaderboard, fetchWeeklyLeaderboard, fetchWeeklyHitrateLeaderboard } from '../services/predictions';
import PixelText from '../components/PixelText';
import ScreenHeader from '../components/ScreenHeader';
import LeaderboardTable, { type LbRow } from '../components/LeaderboardTable';
import Loading from '../components/Loading';
import { useTeamTheme } from '../context/TeamTheme';
import { colors, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'FullLeaderboard'>;

// PredictionLeague와 동일한 적중률 최소 참여 안내 문구용.
const MIN_HITRATE_PARTICIPATION = 5;

export default function FullLeaderboard() {
  const navigation = useNavigation<Nav>();
  const params = useRoute<Rt>().params;
  const board = params.board;
  const period = params.period ?? 'month';
  const isWeek = period === 'week';
  const { accent } = useTeamTheme();
  const [rows, setRows] = useState<LbRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const sub = (hits: number, part: number, streak: number) => `적중 ${hits}/${part} · 최고 ${streak}연속`;
      const p = board === 'points'
        ? (isWeek ? fetchWeeklyLeaderboard(100) : fetchMonthlyLeaderboard(100)).then((list) => list.map((r): LbRow => ({
            rank: r.rank, nickname: r.nickname, isMe: r.isMe,
            right: `${'weeklyPoints' in r ? r.weeklyPoints : r.monthlyPoints}점`, sub: sub(r.hits, r.participations, r.bestStreak),
          })))
        : (isWeek ? fetchWeeklyHitrateLeaderboard(100) : fetchMonthlyHitrateLeaderboard(100)).then((list) => list.map((r): LbRow => ({
            rank: r.rank, nickname: r.nickname, isMe: r.isMe,
            right: `${r.hitRate}%`, sub: sub(r.hits, r.participations, r.bestStreak),
          })));
      p.then((rs) => { if (!active) return; setRows(rs); setLoaded(true); })
        .catch(() => { if (active) setLoaded(true); });
      return () => { active = false; };
    }, [board, isWeek])
  );

  const periodWord = isWeek ? '이번 주' : '이번 달';
  const title = board === 'points' ? `${periodWord} 포인트 랭킹` : `${periodWord} 적중률 랭킹`;

  return (
    <View style={styles.root}>
      <Image source={require('../assets/stadium-bg.webp')} style={styles.bgImage} resizeMode="cover" />
      <View style={styles.bgOverlay} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title={title} leftIcon="back" onLeftPress={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.content}>
          {!loaded ? (
            <Loading />
          ) : rows.length === 0 ? (
            <PixelText variant="body" color={colors.textDim}>
              {board === 'hitrate'
                ? `${periodWord} ${isWeek ? 3 : MIN_HITRATE_PARTICIPATION}회 이상 참여한 사람만 집계돼요`
                : `${periodWord} 참여 기록이 없어요`}
            </PixelText>
          ) : (
            <>
              <LeaderboardTable rows={rows} accent={accent} />
              <PixelText variant="caption" color={colors.textDim} style={styles.tiebreakNote}>
                {board === 'points'
                  ? '동점 시 적중 수 → 적중률 → 최고 연속 순, 모두 같으면 공동 순위'
                  : '적중률 동점 시 적중 수 → 최고 연속 순, 모두 같으면 공동 순위'}
              </PixelText>
            </>
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
  content: { padding: spacing.md },
  tiebreakNote: { marginTop: spacing.sm },
});
