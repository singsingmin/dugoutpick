// 경기 상세: 매치업 + 꿀잼지수(골드) + 한 줄 예측 + 선발 비교 + 관전포인트 TOP3. (flow.md, ADR-004/005)
import { useEffect, useState } from 'react';
import { View, ScrollView, Pressable, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Game, TeamSide } from '../types';
import { loadGames } from '../data/load';
import PixelText from '../components/PixelText';
import Panel from '../components/Panel';
import ScreenHeader from '../components/ScreenHeader';
import TeamName from '../components/TeamName';
import TeamBadge from '../components/TeamBadge';
import HonjamBadge from '../components/HonjamBadge';
import SectionLabel from '../components/SectionLabel';
import { loadTeams } from '../data/load';
import { border, colors, spacing } from '../theme';
import { useTeamTheme } from '../context/TeamTheme';
import FeedbackWidget from '../components/FeedbackWidget';
import LineupSheet from '../components/LineupSheet';

type Props = NativeStackScreenProps<RootStackParamList, 'GameDetail'>;
const TEAMS = loadTeams().teams;
const teamColor = (code: string) => TEAMS.find((t) => t.code === code)?.color ?? colors.text;

// 꿀잼지수 근거 표시용: 요소 라벨 + 가중치(공식과 일치)
const FACTOR_META: { key: string; label: string; weight: number }[] = [
  { key: 'close', label: '순위 근접도', weight: 30 },
  { key: 'quality', label: '상위권 매치', weight: 20 },
  { key: 'doom', label: '연패 탈출 멸망전', weight: 18 },
  { key: 'form', label: '연승·연패 강도', weight: 15 },
  { key: 'pitcher', label: '선발 매치업', weight: 15 },
  { key: 'offense', label: '타선 득점력', weight: 6 },
  { key: 'rivalry', label: '라이벌 매치', weight: 10 },
  { key: 'playoff', label: '가을야구 경쟁', weight: 10 },
  { key: 'park', label: '파크팩터', weight: 5 },
];

export default function GameDetail({ route, navigation }: Props) {
  const { gameId } = route.params;
  const { accent } = useTeamTheme();
  const [game, setGame] = useState<Game | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [lineupVisible, setLineupVisible] = useState(false);

  useEffect(() => {
    let active = true;
    loadGames()
      .then((d) => active && setGame(d.games.find((g) => g.gameId === gameId) ?? null))
      .finally(() => active && setLoaded(true));
    return () => { active = false; };
  }, [gameId]);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  if (!loaded) return <View style={styles.container} />;
  if (!game) {
    return (
      <View style={styles.center}>
        <PixelText variant="title" color={colors.textDim}>경기를 찾을 수 없다</PixelText>
      </View>
    );
  }

  const final = game.status === 'FINAL';
  const live = game.status === 'LIVE';

  const title = game ? `${game.away.name} vs ${game.home.name}` : '경기 상세';

  return (
    <View style={styles.root}>
      <Image source={require('../assets/stadium-bg.png')} style={styles.bgImage} resizeMode="cover" />
      <View style={styles.bgOverlay} />
      <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title={title}
        leftIcon="←"
        onLeftPress={() => navigation.goBack()}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* 매치업 */}
      <View style={styles.matchup}>
        <View style={styles.teamCol}>
          <TeamName code={game.away.code} variant="hero" />
          <View style={[styles.underline, { borderColor: teamColor(game.away.code) }]} />
        </View>
        <PixelText variant="title" color={live ? colors.bad : colors.textDim}>
          {final || live ? `${game.away.score ?? '-'} : ${game.home.score ?? '-'}` : 'VS'}
        </PixelText>
        <View style={styles.teamCol}>
          <TeamName code={game.home.code} variant="hero" />
          <View style={[styles.underline, { borderColor: teamColor(game.home.code) }]} />
        </View>
      </View>
      <PixelText variant="caption" color={live ? colors.bad : colors.textDim} style={styles.meta}>
        {live && game.live ? `🔴 LIVE · ${game.live.label}` : `${game.time} · ${game.stadium}${game.status === 'CANCELED' ? ' · 취소' : ''}`}
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
        <View style={styles.sectionHeader}>
          <SectionLabel icon="⚾" label="선발투수 비교" />
          {game.lineup && (
            <Pressable onPress={() => setLineupVisible(true)} style={[styles.lineupBtn, { backgroundColor: accent }]}>
              <PixelText variant="caption" color={colors.onGreen}>타순 ▼</PixelText>
            </Pressable>
          )}
        </View>
        <Panel>
          <View style={styles.starterRow}>
            <PitcherCol side={game.away} />
            <PixelText variant="title" color={colors.textDim}>VS</PixelText>
            <PitcherCol side={game.home} />
          </View>
        </Panel>
      </View>
      {game.lineup && (
        <LineupSheet visible={lineupVisible} onClose={() => setLineupVisible(false)} game={game} />
      )}

      {/* 관전 포인트 TOP 3 */}
      {game.honjam && game.honjam.points.length > 0 && (
        <View style={styles.section}>
          <SectionLabel icon="★" label="관전 포인트" />
          <Panel>
            {game.honjam.points.map((p, i) => (
              <View key={i} style={styles.pointRow}>
                <View style={[styles.num, { backgroundColor: accent }]}><PixelText variant="caption" color={colors.onGreen}>{i + 1}</PixelText></View>
                <PixelText variant="body" style={styles.pointText}>{p}</PixelText>
              </View>
            ))}
          </Panel>
        </View>
      )}

      {/* 꿀잼지수 근거 (요소별 강도) */}
      {game.honjam && (
        <View style={styles.section}>
          <SectionLabel icon="🔍" label="꿀잼지수 근거" />
          <Panel>
            {FACTOR_META
              .map((f) => ({ ...f, v: game.honjam!.factors[f.key] ?? 0 }))
              .filter((f) => f.v > 0) // 작용하지 않은 요소(빈 막대)는 숨김 — doom은 멸망전에만 등장
              .sort((a, b) => b.v * b.weight - a.v * a.weight)
              .map((f) => (
                <View key={f.key} style={styles.factorRow}>
                  <PixelText variant="caption" color={colors.textDim} style={styles.factorLabel}>{f.label}</PixelText>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${Math.round(f.v * 100)}%` }]} />
                  </View>
                </View>
              ))}
            <PixelText variant="caption" color={colors.textDim} style={styles.factorNote}>막대가 길수록 이 경기에서 강하게 작용한 요소</PixelText>
          </Panel>
        </View>
      )}

      {/* 경기 후 피드백 */}
      {game.status === 'FINAL' && game.honjam != null && (
        <FeedbackWidget
          gameId={game.gameId}
          predictedScore={game.honjam.score}
          matchLabel={`${game.away.name} vs ${game.home.name}`}
        />
      )}
      </ScrollView>
      </SafeAreaView>
    </View>
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
  root: { flex: 1, backgroundColor: colors.bg },
  bgImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  bgOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(255,255,255,0.38)' },
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.sm },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  matchup: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: spacing.md },
  teamCol: { alignItems: 'center', gap: spacing.xs },
  underline: { width: 48, borderBottomWidth: 2, borderStyle: 'dotted' },
  meta: { textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.sm },
  honjamRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, marginVertical: spacing.sm },
  spark: { fontSize: 18 },
  section: { marginTop: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lineupBtn: { borderWidth: border.width, borderColor: colors.border, borderRadius: border.radius, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  starterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  pitcherCol: { alignItems: 'center', gap: spacing.xs, flex: 1 },
  pitcherName: { marginTop: spacing.xs },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: 3 },
  num: { borderColor: colors.border, borderWidth: 2, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  pointText: { flex: 1 },
  factorRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 3, gap: spacing.sm },
  factorLabel: { width: 78 },
  barTrack: { flex: 1, height: 10, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.gold },
  factorNote: { marginTop: spacing.sm },
});
