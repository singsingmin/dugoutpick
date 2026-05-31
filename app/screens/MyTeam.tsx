// 내 팀 탭 (피드형 세로 스크롤): ① 오늘 경기 ② 현재 순위 ③ 최근 흐름. (flow.md, ADR-010)
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
import ScreenHeader from '../components/ScreenHeader';
import SectionLabel from '../components/SectionLabel';
import { colors, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const TEAMS = loadTeams().teams;

export default function MyTeam() {
  const navigation = useNavigation<Nav>();
  const [code, setCode] = useState<string | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [standing, setStanding] = useState<Standing | null>(null);
  const [loaded, setLoaded] = useState(false);

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
      return () => { active = false; };
    }, [])
  );

  const team = code ? TEAMS.find((t) => t.code === code) : undefined;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="내 팀" leftIcon="★" />
      {!loaded ? (
        <View style={styles.center} />
      ) : !code ? (
        <View style={styles.center}><PixelText variant="title" color={colors.textDim}>응원팀을 먼저 선택하세요</PixelText></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.teamHead}>
            <TeamBadge code={code} size="md" />
            <PixelText variant="title" color={team?.color ?? colors.accent}>{team?.fullName ?? code}</PixelText>
          </View>

          <View style={styles.section}>
            <SectionLabel icon="⚾" label="오늘 경기" />
            {game ? (
              <GameCard game={game} variant="list" onPress={() => navigation.navigate('GameDetail', { gameId: game.gameId })} />
            ) : (
              <Panel><PixelText variant="body" color={colors.textDim}>오늘 내 팀 경기가 없다</PixelText></Panel>
            )}
          </View>

          <View style={styles.section}>
            <SectionLabel icon="📊" label="현재 순위" />
            {standing ? (
              <Panel accentColor={team?.color}>
                <PixelText variant="hero" color={team?.color ?? colors.text}>{standing.rank}위</PixelText>
                <PixelText variant="body" style={styles.statLine}>
                  {standing.win}승 {standing.draw}무 {standing.loss}패 · 승률 {standing.winRate.toFixed(3)}
                </PixelText>
                <PixelText variant="caption" color={colors.textDim}>게임차 {standing.gamesBehind} · {standing.games}경기</PixelText>
              </Panel>
            ) : (
              <Panel><PixelText variant="body" color={colors.textDim}>순위 정보 없음</PixelText></Panel>
            )}
          </View>

          <View style={styles.section}>
            <SectionLabel icon="🔥" label="최근 흐름" />
            {standing ? (
              <Panel>
                <PixelText variant="body">최근 10경기 {standing.last10}</PixelText>
                <PixelText variant="body" color={streakColor(standing.streak)} style={styles.statLine}>현재 {standing.streak}</PixelText>
                <PixelText variant="caption" color={colors.textDim}>홈 {standing.home} · 방문 {standing.away} (승-무-패)</PixelText>
              </Panel>
            ) : (
              <Panel><PixelText variant="body" color={colors.textDim}>기록 없음</PixelText></Panel>
            )}
          </View>
        </ScrollView>
      )}
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
  content: { padding: spacing.md },
  teamHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  section: { marginBottom: spacing.lg },
  statLine: { marginTop: spacing.xs },
});
