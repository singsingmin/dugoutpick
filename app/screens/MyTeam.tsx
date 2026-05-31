// 내 팀 탭 (피드형 세로 스크롤): ① 다음/오늘 경기 ② 현재 순위 ③ 최근 결과. (flow.md, ADR-010)
import { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Game, Standing } from '../types';
import { loadGames, loadStandings, loadTeams } from '../data/load';
import { getCheerTeam } from '../data/team';
import PixelText from '../components/PixelText';
import Panel from '../components/Panel';
import TeamBadge from '../components/TeamBadge';
import GameCard from '../components/GameCard';
import { colors, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const TEAMS = loadTeams().teams;

export default function MyTeam() {
  const navigation = useNavigation<Nav>();
  const [code, setCode] = useState<string | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [standing, setStanding] = useState<Standing | null>(null);
  const [loaded, setLoaded] = useState(false);

  // 탭 포커스마다 응원팀 재조회(설정에서 변경했을 수 있음).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const c = await getCheerTeam();
        const [g, s] = await Promise.all([loadGames(), loadStandings()]);
        if (!active) return;
        setCode(c);
        setGame(g.games.find((x) => x.away.code === c || x.home.code === c) ?? null);
        setStanding(s.standings.find((x) => x.code === c) ?? null);
        setLoaded(true);
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  if (!loaded) return <View style={styles.safe} />;
  if (!code) {
    return (
      <View style={styles.center}>
        <PixelText variant="title" color={colors.textDim}>응원팀을 먼저 선택하세요</PixelText>
      </View>
    );
  }

  const team = TEAMS.find((t) => t.code === code);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* 헤더 */}
        <View style={styles.header}>
          <TeamBadge code={code} size="md" />
          <PixelText variant="title" color={team?.color ?? colors.accent}>
            {team?.fullName ?? code}
          </PixelText>
        </View>

        {/* ① 다음/오늘 경기 */}
        <PixelText variant="body" color={colors.accent} style={styles.label}>오늘 경기</PixelText>
        {game ? (
          <GameCard game={game} variant="list" onPress={() => navigation.navigate('GameDetail', { gameId: game.gameId })} />
        ) : (
          <Panel>
            <PixelText variant="body" color={colors.textDim}>오늘 내 팀 경기가 없다</PixelText>
          </Panel>
        )}

        {/* ② 현재 순위 */}
        <PixelText variant="body" color={colors.accent} style={styles.label}>현재 순위</PixelText>
        {standing ? (
          <Panel accentColor={team?.color}>
            <PixelText variant="hero" color={team?.color ?? colors.text}>{standing.rank}위</PixelText>
            <PixelText variant="body" style={styles.statLine}>
              {standing.win}승 {standing.draw}무 {standing.loss}패 · 승률 {standing.winRate.toFixed(3)}
            </PixelText>
            <PixelText variant="caption" color={colors.textDim}>
              게임차 {standing.gamesBehind} · {standing.games}경기
            </PixelText>
          </Panel>
        ) : (
          <Panel><PixelText variant="body" color={colors.textDim}>순위 정보 없음</PixelText></Panel>
        )}

        {/* ③ 최근 결과 */}
        <PixelText variant="body" color={colors.accent} style={styles.label}>최근 흐름</PixelText>
        {standing ? (
          <Panel>
            <PixelText variant="body">최근 10경기 {standing.last10}</PixelText>
            <PixelText variant="body" color={streakColor(standing.streak)} style={styles.statLine}>
              현재 {standing.streak}
            </PixelText>
            <PixelText variant="caption" color={colors.textDim}>
              홈 {standing.home} · 방문 {standing.away} (승-무-패)
            </PixelText>
          </Panel>
        ) : (
          <Panel><PixelText variant="body" color={colors.textDim}>기록 없음</PixelText></Panel>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function streakColor(streak: string): string {
  if (streak.includes('승')) return colors.good;
  if (streak.includes('패')) return colors.bad;
  return colors.text;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, gap: spacing.xs },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  label: { marginTop: spacing.md, marginBottom: spacing.xs },
  statLine: { marginTop: spacing.xs },
});
