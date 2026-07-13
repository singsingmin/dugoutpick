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
  fetchWeeklyLeaderboard, fetchWeeklyHitrateLeaderboard,
  type PredictionStats,
} from '../services/predictions';
import { getCheerTeam } from '../data/team';
import { loadTeams } from '../data/load';
import { titleDisplay } from '../utils/titleConfig';
import PixelText from '../components/PixelText';
import Panel from '../components/Panel';
import ScreenHeader from '../components/ScreenHeader';
import SectionLabel from '../components/SectionLabel';
import LeaderboardTable, { type LbRow } from '../components/LeaderboardTable';
import Loading from '../components/Loading';
import { useTeamTheme } from '../context/TeamTheme';
import { colors, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Period = 'week' | 'month';

const TEAMS = loadTeams().teams;
// 적중률 최소 참여: 월간 5회(0015) / 주간 3회(0024) — 서버 기본값과 동일하게 유지.
const MIN_HITRATE = { week: 3, month: 5 } as const;

const lbSub = (hits: number, part: number, streak: number) => `적중 ${hits}/${part} · 최고 ${streak}연속`;

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
  const [period, setPeriod] = useState<Period>('week');
  const [stats, setStats] = useState<PredictionStats | null>(null);
  const [pointsRows, setPointsRows] = useState<LbRow[]>([]);
  const [hitrateRows, setHitrateRows] = useState<LbRow[]>([]);
  const [teamRows, setTeamRows] = useState<LbRow[]>([]); // 주간 '내 응원팀 랭킹'
  const [cheerTeam, setCheerTeam] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoaded(false);
      (async () => {
        const [s, ct] = await Promise.all([fetchPredictionStats(), getCheerTeam()]);
        if (!active) return;
        setStats(s); setCheerTeam(ct);
        if (period === 'week') {
          const [p, h, t] = await Promise.all([fetchWeeklyLeaderboard(20), fetchWeeklyHitrateLeaderboard(20), fetchWeeklyLeaderboard(20, true)]);
          if (!active) return;
          setPointsRows(p.map((r) => ({ rank: r.rank, nickname: r.nickname, isMe: r.isMe, right: `${r.weeklyPoints}점`, sub: lbSub(r.hits, r.participations, r.bestStreak) })));
          setHitrateRows(h.map((r) => ({ rank: r.rank, nickname: r.nickname, isMe: r.isMe, right: `${r.hitRate}%`, sub: lbSub(r.hits, r.participations, r.bestStreak) })));
          setTeamRows(t.map((r) => ({ rank: r.rank, nickname: r.nickname, isMe: r.isMe, right: `${r.weeklyPoints}점`, sub: lbSub(r.hits, r.participations, r.bestStreak) })));
        } else {
          const [p, h] = await Promise.all([fetchMonthlyLeaderboard(20), fetchMonthlyHitrateLeaderboard(20)]);
          if (!active) return;
          setPointsRows(p.map((r) => ({ rank: r.rank, nickname: r.nickname, isMe: r.isMe, right: `${r.monthlyPoints}점`, sub: lbSub(r.hits, r.participations, r.bestStreak) })));
          setHitrateRows(h.map((r) => ({ rank: r.rank, nickname: r.nickname, isMe: r.isMe, right: `${r.hitRate}%`, sub: lbSub(r.hits, r.participations, r.bestStreak) })));
          setTeamRows([]);
        }
        setLoaded(true);
      })().catch(() => { if (active) setLoaded(true); });
      return () => { active = false; };
    }, [period])
  );

  const myNickname = stats?.nickname ?? null;
  const equippedTitle = stats?.equippedTitle ? titleDisplay(stats.equippedTitle).label : null;
  const isWeek = period === 'week';
  const teamName = TEAMS.find((t) => t.code === cheerTeam)?.name ?? null;
  const pointsTitle = isWeek ? '이번 주 예측왕' : '이번 달 포인트 랭킹';
  const hitrateTitle = isWeek ? '이번 주 적중률 랭킹' : '이번 달 적중률 랭킹';
  const periodWord = isWeek ? '이번 주' : '이번 달';

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
                <Loading />
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

          {/* 주간/월간 토글 */}
          <View style={styles.toggleRow}>
            {(['week', 'month'] as Period[]).map((p) => (
              <Pressable
                key={p}
                onPress={() => setPeriod(p)}
                style={[styles.toggleBtn, period === p && { backgroundColor: accent, borderColor: accent }]}
              >
                <PixelText variant="caption" color={period === p ? colors.onGreen : colors.textDim}>
                  {p === 'week' ? '주간' : '월간'}
                </PixelText>
              </Pressable>
            ))}
          </View>

          {/* 포인트 랭킹 — 상위 N + 내 순위 고정, 전체는 별도 화면 */}
          <View style={styles.section}>
            <SectionLabel icon="chart" label={pointsTitle} />
            {pointsRows.length === 0 ? (
              <Panel><PixelText variant="body" color={colors.textDim}>{periodWord} 참여 기록이 없어요</PixelText></Panel>
            ) : (
              <>
                <LeaderboardTable rows={pointsRows.slice(0, TOP_N)} accent={accent} myRowPinned={myPinned(pointsRows)} />
                {pointsRows.length > TOP_N && (
                  <Pressable style={styles.moreLink} onPress={() => navigation.navigate('FullLeaderboard', { board: 'points', period })}>
                    <PixelText variant="caption" color={accent}>전체 랭킹 보기 ›</PixelText>
                  </Pressable>
                )}
                <PixelText variant="caption" color={colors.textDim} style={styles.tiebreakNote}>
                  동점 시 적중 수 → 적중률 → 최고 연속 순, 모두 같으면 공동 순위
                </PixelText>
              </>
            )}
          </View>

          {/* 적중률 랭킹 */}
          <View style={styles.section}>
            <SectionLabel icon="star" label={hitrateTitle} />
            {hitrateRows.length === 0 ? (
              <Panel><PixelText variant="body" color={colors.textDim}>{periodWord} {MIN_HITRATE[period]}회 이상 참여한 사람만 집계돼요</PixelText></Panel>
            ) : (
              <>
                <LeaderboardTable rows={hitrateRows.slice(0, TOP_N)} accent={accent} myRowPinned={myPinned(hitrateRows)} />
                {hitrateRows.length > TOP_N && (
                  <Pressable style={styles.moreLink} onPress={() => navigation.navigate('FullLeaderboard', { board: 'hitrate', period })}>
                    <PixelText variant="caption" color={accent}>전체 랭킹 보기 ›</PixelText>
                  </Pressable>
                )}
                <PixelText variant="caption" color={colors.textDim} style={styles.tiebreakNote}>
                  적중률 동점 시 적중 수 → 최고 연속 순, 모두 같으면 공동 순위
                </PixelText>
              </>
            )}
          </View>

          {/* 내 응원팀 주간 랭킹 (주간 전용) */}
          {isWeek && (
            <View style={styles.section}>
              <SectionLabel icon="flag" label={teamName ? `${teamName} 팬 랭킹` : '내 응원팀 랭킹'} />
              {!cheerTeam ? (
                <Panel><PixelText variant="body" color={colors.textDim}>응원팀을 정하면 같은 팀 팬들끼리 랭킹이 보여요</PixelText></Panel>
              ) : teamRows.length === 0 ? (
                <Panel><PixelText variant="body" color={colors.textDim}>{teamName} 팬 중 이번 주 참여 기록이 없어요</PixelText></Panel>
              ) : (
                <LeaderboardTable rows={teamRows.slice(0, TOP_N)} accent={accent} myRowPinned={myPinned(teamRows)} />
              )}
            </View>
          )}

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

  toggleRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  toggleBtn: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: 999, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
