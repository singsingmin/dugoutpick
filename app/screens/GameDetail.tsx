// 경기 상세: 매치업 + 꿀잼지수(골드) + 한 줄 예측 + 선발 비교 + 관전포인트 TOP3. (flow.md, ADR-004/005)
import { useEffect, useState } from 'react';
import { View, ScrollView, Pressable, Share, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Game, TeamSide } from '../types';
import { loadGames } from '../data/load';
import PixelText from '../components/PixelText';
import Panel from '../components/Panel';
import TeamName from '../components/TeamName';
import TeamBadge from '../components/TeamBadge';
import HonjamBadge from '../components/HonjamBadge';
import SectionLabel from '../components/SectionLabel';
import { loadTeams } from '../data/load';
import { border, colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'GameDetail'>;
const TEAMS = loadTeams().teams;
const teamColor = (code: string) => TEAMS.find((t) => t.code === code)?.color ?? colors.text;

export default function GameDetail({ route, navigation }: Props) {
  const { gameId } = route.params;
  const [game, setGame] = useState<Game | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    loadGames()
      .then((d) => active && setGame(d.games.find((g) => g.gameId === gameId) ?? null))
      .finally(() => active && setLoaded(true));
    return () => { active = false; };
  }, [gameId]);

  useEffect(() => {
    if (!game) return;
    navigation.setOptions({
      title: `${game.away.name} vs ${game.home.name}`,
      headerRight: () => (
        <Pressable
          onPress={() => Share.share({ message: `오늘야구각 — ${game.away.name} vs ${game.home.name}${game.honjam ? ` 꿀잼지수 ${game.honjam.score}점` : ''}` })}
        >
          <PixelText color={colors.onGreen} style={styles.shareIcon}>↗</PixelText>
        </Pressable>
      ),
    });
  }, [game, navigation]);

  if (!loaded) return <View style={styles.container} />;
  if (!game) {
    return (
      <View style={styles.center}>
        <PixelText variant="title" color={colors.textDim}>경기를 찾을 수 없다</PixelText>
      </View>
    );
  }

  const final = game.status === 'FINAL';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 매치업 */}
      <View style={styles.matchup}>
        <View style={styles.teamCol}>
          <TeamName code={game.away.code} variant="hero" />
          <View style={[styles.underline, { borderColor: teamColor(game.away.code) }]} />
        </View>
        <PixelText variant="title" color={colors.textDim}>
          {final ? `${game.away.score ?? '-'} : ${game.home.score ?? '-'}` : 'VS'}
        </PixelText>
        <View style={styles.teamCol}>
          <TeamName code={game.home.code} variant="hero" />
          <View style={[styles.underline, { borderColor: teamColor(game.home.code) }]} />
        </View>
      </View>
      <PixelText variant="caption" color={colors.textDim} style={styles.meta}>
        {game.time} · {game.stadium}{game.status === 'CANCELED' ? ' · 취소' : ''}
      </PixelText>

      {/* 꿀잼지수 */}
      {game.honjam && (
        <View style={styles.honjamRow}>
          <PixelText color={colors.gold} style={styles.spark}>✦</PixelText>
          <HonjamBadge score={game.honjam.score} size="lg" />
          <PixelText color={colors.gold} style={styles.spark}>✦</PixelText>
        </View>
      )}

      {/* 한 줄 예측 */}
      {game.honjam && (
        <View style={styles.section}>
          <SectionLabel icon="💬" label="오늘의 한 줄 예측" />
          <Panel><PixelText variant="body">{game.honjam.reason}</PixelText></Panel>
        </View>
      )}

      {/* 선발투수 비교 */}
      <View style={styles.section}>
        <SectionLabel icon="⚾" label="선발투수 비교" />
        <Panel>
          <View style={styles.starterRow}>
            <PitcherCol side={game.away} />
            <PixelText variant="title" color={colors.textDim}>VS</PixelText>
            <PitcherCol side={game.home} />
          </View>
        </Panel>
      </View>

      {/* 관전 포인트 TOP 3 */}
      {game.honjam && game.honjam.points.length > 0 && (
        <View style={styles.section}>
          <SectionLabel icon="★" label="관전 포인트" />
          <Panel>
            {game.honjam.points.map((p, i) => (
              <View key={i} style={styles.pointRow}>
                <View style={styles.num}><PixelText variant="caption" color={colors.onGreen}>{i + 1}</PixelText></View>
                <PixelText variant="body" style={styles.pointText}>{p}</PixelText>
              </View>
            ))}
          </Panel>
        </View>
      )}
    </ScrollView>
  );
}

function PitcherCol({ side }: { side: TeamSide }) {
  const s = side.starter;
  // 승-패/ERA가 없어도 항상 같은 줄 수를 렌더해 좌우 컬럼 높이를 맞춘다(플레이스홀더 '-').
  const rec = s && s.w != null && s.l != null ? `${s.w}승 ${s.l}패` : '기록 -';
  const era = s && s.era != null ? `ERA ${s.era.toFixed(2)}` : 'ERA -';
  return (
    <View style={styles.pitcherCol}>
      <TeamBadge code={side.code} size="sm" />
      <PixelText variant="body" style={styles.pitcherName} numberOfLines={1}>{s ? s.name : '선발 미정'}</PixelText>
      <PixelText variant="caption" color={colors.textDim}>{rec}</PixelText>
      <PixelText variant="caption" color={colors.textDim}>{era}</PixelText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.sm },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  shareIcon: { fontSize: 16, paddingHorizontal: spacing.sm },
  matchup: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: spacing.md },
  teamCol: { alignItems: 'center', gap: spacing.xs },
  underline: { width: 48, borderBottomWidth: 2, borderStyle: 'dotted' },
  meta: { textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.sm },
  honjamRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, marginVertical: spacing.sm },
  spark: { fontSize: 18 },
  section: { marginTop: spacing.sm },
  starterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  pitcherCol: { alignItems: 'center', gap: spacing.xs, flex: 1 },
  pitcherName: { marginTop: spacing.xs },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: 3 },
  num: { backgroundColor: colors.accent, borderColor: colors.border, borderWidth: 2, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  pointText: { flex: 1 },
});
