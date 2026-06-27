// 내 팀 탭 (피드형): 오늘 경기 + 순위/승무패·최근폼·홈원정·상대전적 차트. (ADR-010)
import { useCallback, useState } from 'react';
import { View, ScrollView, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Game, Standing, RecentGame } from '../types';
import { loadGames, loadStandings, loadRecent, loadTeams } from '../data/load';
import { getCheerTeam } from '../data/team';
import PixelText from '../components/PixelText';
import Panel from '../components/Panel';
import TeamBadge from '../components/TeamBadge';
import GameCard from '../components/GameCard';
import ScreenHeader from '../components/ScreenHeader';
import SectionLabel from '../components/SectionLabel';
import AppIcon from '../components/AppIcon';
import { RankLadder, WLDBar, HomeAwayBars, H2HList, FormDots } from '../components/charts';
import { colors, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const TEAMS = loadTeams().teams;

export default function MyTeam() {
  const navigation = useNavigation<Nav>();
  const [code, setCode] = useState<string | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [standing, setStanding] = useState<Standing | null>(null);
  const [recent, setRecent] = useState<RecentGame[]>([]);
  const [cutStanding, setCutStanding] = useState<Standing | null>(null);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const c = await getCheerTeam();
        const [g, s, r] = await Promise.all([loadGames(), loadStandings(), loadRecent()]);
        if (!active) return;
        setCode(c);
        setGame(g.games.find((x) => x.away.code === c || x.home.code === c) ?? null);
        setStanding(s.standings.find((x) => x.code === c) ?? null);
        setCutStanding(s.standings.find((x) => x.rank === 5) ?? null);
        setRecent(c ? r.recent[c] ?? [] : []);
        setLoaded(true);
      })();
      return () => { active = false; };
    }, [])
  );

  const team = code ? TEAMS.find((t) => t.code === code) : undefined;
  const accent = team?.color ?? colors.accent;
  const gbToCut = (standing && cutStanding && standing.rank > 5)
    ? Math.max(0, standing.gamesBehind - cutStanding.gamesBehind)
    : 0;
  const poIsIn = standing && standing.rank <= 5;
  const poColor = poIsIn ? colors.good : colors.onGold;

  return (
    <View style={styles.root}>
      <Image source={require('../assets/stadium-bg.png')} style={styles.bgImage} resizeMode="cover" />
      <View style={styles.bgOverlay} />
      <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="내 팀" leftIcon="star" />
      {!loaded ? (
        <View style={styles.center} />
      ) : !code ? (
        <View style={styles.center}><PixelText variant="title" color={colors.textDim}>응원팀을 먼저 선택하세요</PixelText></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.teamHead}>
            <TeamBadge code={code} size="md" />
            <PixelText variant="title" color={accent}>{team?.fullName ?? code}</PixelText>
          </View>

          {/* 오늘 경기 */}
          <View style={styles.section}>
            <SectionLabel icon="baseball" label="오늘 경기" />
            {game ? (
              <GameCard game={game} variant="list" showRecap={false} onPress={() => navigation.navigate('GameDetail', { gameId: game.gameId })} />
            ) : (
              <Panel><PixelText variant="body" color={colors.textDim}>오늘 내 팀 경기가 없다</PixelText></Panel>
            )}
          </View>

          {/* 현재 순위 + 승무패 */}
          <View style={styles.section}>
            <SectionLabel icon="chart" label="현재 순위" />
            {standing ? (
              <Panel accentColor={team?.color}>
                <View style={styles.rankHead}>
                  <PixelText variant="hero" color={accent}>{standing.rank}위</PixelText>
                  <PixelText variant="caption" color={colors.textDim}>승률 {standing.winRate.toFixed(3)} · 게임차 {standing.gamesBehind} · {standing.games}경기</PixelText>
                </View>
                {standing && (
                  <View style={styles.poBadge}>
                    {poIsIn ? (
                      <PixelText variant="caption" color={poColor}>✅ 포스트시즌 진출권</PixelText>
                    ) : (
                      <View style={styles.poRow}>
                        <AppIcon name="autumn" size={22} />
                        <PixelText variant="caption" color={poColor}>5위까지 {gbToCut}GB</PixelText>
                      </View>
                    )}
                  </View>
                )}
                <RankLadder rank={standing.rank} color={accent} />
                <View style={styles.chartGap}>
                  <WLDBar win={standing.win} draw={standing.draw} loss={standing.loss} />
                </View>
              </Panel>
            ) : (
              <Panel><PixelText variant="body" color={colors.textDim}>순위 정보 없음</PixelText></Panel>
            )}
          </View>

          {/* 최근 흐름 */}
          <View style={styles.section}>
            <SectionLabel icon="fire" label="최근 흐름" />
            <Panel>
              {recent.length > 0 ? (
                <FormDots games={recent} />
              ) : (
                <PixelText variant="body" color={colors.textDim}>최근 경기 기록 없음</PixelText>
              )}
              {standing && (
                <PixelText variant="body" color={streakColor(standing.streak)} style={styles.statLine}>현재 {standing.streak}</PixelText>
              )}
            </Panel>
          </View>

          {/* 홈/원정 */}
          {standing && (
            <View style={styles.section}>
              <SectionLabel icon="home" label="홈 · 원정" />
              <Panel><HomeAwayBars home={standing.home} away={standing.away} /></Panel>
            </View>
          )}

          {/* 상대전적 */}
          {standing && standing.vs && Object.keys(standing.vs).length > 0 && (
            <View style={styles.section}>
              <SectionLabel icon="versus" label="상대 전적" />
              <Panel><H2HList vs={standing.vs} myColor={accent} /></Panel>
            </View>
          )}
        </ScrollView>
      )}
      </SafeAreaView>
    </View>
  );
}

function streakColor(streak: string): string {
  if (streak.includes('승')) return colors.good;
  if (streak.includes('패')) return colors.bad;
  return colors.text;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bgImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  bgOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(243,233,206,0.35)' },
  safe: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md },
  teamHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  poBadge: { marginBottom: spacing.sm },
  poRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  section: { marginBottom: spacing.lg },
  rankHead: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginBottom: spacing.sm, flexWrap: 'wrap' },
  chartGap: { marginTop: spacing.sm },
  statLine: { marginTop: spacing.sm },
});
