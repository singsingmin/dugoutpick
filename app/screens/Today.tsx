// 오늘경기 탭: 야구장 고정 배경 전체 + 반투명 카드. (flow.md, ADR-004)
import { useCallback, useRef, useState } from 'react';
import { View, ScrollView, ActivityIndicator, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { GamesData, Game } from '../types';
import { loadGames } from '../data/load';
import { getCheerTeam } from '../data/team';
import GameCard from '../components/GameCard';
import LiveCard from '../components/LiveCard';
import ScreenHeader from '../components/ScreenHeader';
import SectionLabel from '../components/SectionLabel';
import type { AppIconName } from '../components/AppIcon';
import PixelText from '../components/PixelText';
import MondayReport from '../components/MondayReport';
import WeeklyScheduleSheet from '../components/WeeklyScheduleSheet';
import { isKstMonday, kstDatetime } from '../utils';
import { colors, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function Today() {
  const navigation = useNavigation<Nav>();
  const [data, setData] = useState<GamesData | null>(null);
  const [cheerTeam, setCheerTeam] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [weeklyVisible, setWeeklyVisible] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const refresh = () => {
        loadGames()
          .then((d) => {
            if (!active) return;
            setData(d);
            setFailed(false);
            const hasLive = d.games.some((g) => g.status === 'LIVE');
            // LIVE: 30s 갱신 / 비LIVE: 60s 베이스라인(SCHEDULED→LIVE 전환 감지)
            const targetMs = hasLive ? 30_000 : 60_000;
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = setInterval(refresh, targetMs);
          })
          .catch(() => {
            if (active) setFailed(true);
          });
      };

      refresh();
      getCheerTeam().then((c) => active && setCheerTeam(c));

      return () => {
        active = false;
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }, [])
  );

  const open = (gameId: string) => navigation.navigate('GameDetail', { gameId });

  if (isKstMonday()) {
    return (
      <View style={styles.root}>
        <Image source={require('../assets/stadium-bg.png')} style={styles.bgImage} resizeMode="cover" />
        <View style={styles.bgOverlay} />
        <SafeAreaView style={styles.safe} edges={['top']}>
          <ScreenHeader title="월요 리포트" leftIcon="clipboard" />
          <MondayReport />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* 고정 배경 — SafeAreaView/ScrollView 바깥에 있어 스크롤에 영향받지 않음 */}
      <Image source={require('../assets/stadium-bg.png')} style={styles.bgImage} resizeMode="cover" />
      {/* 흰색 오버레이 — 채도 낮춰 눈 부담 감소 */}
      <View style={styles.bgOverlay} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <WeeklyScheduleSheet visible={weeklyVisible} onClose={() => setWeeklyVisible(false)} />
        {failed ? (
          <Centered text="데이터를 불러오지 못했다" />
        ) : !data ? (
          <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
        ) : data.games.length === 0 ? (
          <Centered text="오늘은 경기가 없다" />
        ) : (
          <Body data={data} open={open} cheerTeam={cheerTeam} onCalendar={() => setWeeklyVisible(true)} />
        )}
      </SafeAreaView>
    </View>
  );
}

function Body({
  data, open, cheerTeam, onCalendar,
}: {
  data: GamesData;
  open: (id: string) => void;
  cheerTeam: string | null;
  onCalendar: () => void;
}) {
  const liveGames = data.games
    .filter((g) => g.status === 'LIVE')
    .sort((a, b) => (b.live?.heat ?? 0) - (a.live?.heat ?? 0));

  const finished = data.games.filter((g) => g.status === 'FINAL' && g.recap);
  const bestRecap = finished.length
    ? finished.slice().sort((a, b) => (b.recap?.actual ?? 0) - (a.recap?.actual ?? 0))[0]
    : null;
  const myFinished = cheerTeam
    ? finished.find((g) => g.away.code === cheerTeam || g.home.code === cheerTeam)
    : undefined;

  // 모든 경기 종료(FINAL/CANCELED) 시 결산 모드
  const allDone = data.games.length > 0 && data.games.every(
    (g) => g.status === 'FINAL' || g.status === 'CANCELED'
  );
  const recommended: Game | undefined = data.games.find(
    (g) => g.gameId === data.recommendedGameId && g.status === 'SCHEDULED'
  );
  // allDone 시 추천 경기도 rest에 포함 (별도 히어로 섹션 없이 다른경기로)
  const rest = data.games
    .filter((g) => g.status !== 'LIVE' && (allDone || g.gameId !== recommended?.gameId))
    .sort((a, b) => (b.honjam?.score ?? -1) - (a.honjam?.score ?? -1));

  // ── 히어로: 추천 경기(SCHEDULED)일 때만 표시
  let heroGame: Game | null = null;
  let heroIcon: AppIconName = 'star';
  let heroLabel = '오늘의 추천';

  if (!allDone && recommended) {
    heroGame = recommended;
  }

  // ── 리스트: 명경기는 항상 결산 섹션에 표시
  const listBestRecap = bestRecap ?? null;
  const listMyFinished = heroGame?.gameId === myFinished?.gameId ? null : myFinished;
  // allDone 시 추천 섹션 숨김 (rest에 이미 포함)
  const listRecommended = allDone ? null : (heroGame?.gameId === recommended?.gameId ? null : recommended);
  // 버그픽스: bestRecap·myFinished 중복 제거
  const listRest = rest.filter(
    (g) => g.gameId !== heroGame?.gameId
      && g.gameId !== listBestRecap?.gameId
      && g.gameId !== listMyFinished?.gameId
  );

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <ScreenHeader
        title="오늘 경기"
        leftIcon="baseball"
        rightIcon="calendar"
        onRightPress={onCalendar}
      />
      {/* ── 히어로 섹션 ── */}
      {!allDone && heroGame && (
        <View style={styles.heroContent}>
          <View style={styles.heroLabelRow}>
            <SectionLabel icon={heroIcon} label={heroLabel} />
            <View style={styles.heroMeta}>
              <PixelText variant="caption" color={colors.textDim}>갱신 {kstDatetime(data.updatedAt)}</PixelText>
            </View>
          </View>
          <GameCard game={heroGame} variant="hero" onPress={() => open(heroGame!.gameId)} />
        </View>
      )}
      {/* ── 리스트 섹션 ── */}
      <View style={styles.listSection}>
        {liveGames.length > 0 && (
          <View style={styles.section}>
            <View style={styles.heroLabelRow}>
              <SectionLabel icon="live" label="지금 볼 각" />
              <View style={styles.heroMeta}>
                <PixelText variant="caption" color={colors.textDim}>갱신 {kstDatetime(data.updatedAt)}</PixelText>
              </View>
            </View>
            <PixelText variant="caption" color={colors.textDim} style={styles.liveHint}>
              ⚠ 라이브 점수는 30초 간격 갱신 — 실제보다 몇 초 늦을 수 있다
            </PixelText>
            {liveGames.map((g) => (
              <LiveCard key={g.gameId} game={g} onPress={() => open(g.gameId)} />
            ))}
          </View>
        )}

        {(listBestRecap || listMyFinished) && (
          <View style={styles.section}>
            <SectionLabel icon="flag" label="오늘의 결산" />
            {listBestRecap && (
              <>
                <PixelText variant="caption" color={colors.accent} style={styles.subLabel}>오늘의 명경기</PixelText>
                <GameCard game={listBestRecap} variant="list" onPress={() => open(listBestRecap.gameId)} />
              </>
            )}
            {listMyFinished && listMyFinished.gameId !== listBestRecap?.gameId && (
              <>
                <PixelText variant="caption" color={colors.accent} style={styles.subLabel}>내 팀 결과</PixelText>
                <GameCard game={listMyFinished} variant="list" onPress={() => open(listMyFinished.gameId)} />
              </>
            )}
          </View>
        )}

        {listRecommended && (
          <View style={styles.section}>
            <SectionLabel icon="star" label="오늘의 추천 경기" />
            <GameCard game={listRecommended} variant="hero" onPress={() => open(listRecommended.gameId)} />
          </View>
        )}

        {listRest.length > 0 && (
          <View style={styles.section}>
            <SectionLabel label="다른 경기" />
            {listRest.map((g) => (
              <GameCard key={g.gameId} game={g} variant="list" onPress={() => open(g.gameId)} />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function Centered({ text }: { text: string }) {
  return (
    <View style={styles.center}>
      <PixelText variant="title" color={colors.text}>{text}</PixelText>
    </View>
  );
}

const styles = StyleSheet.create({
  // 야구장 고정 배경 구조
  root: { flex: 1, backgroundColor: colors.bg },
  bgImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  bgOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(243,233,206,0.35)' },
  safe: { flex: 1, backgroundColor: 'transparent' },
  safeSolid: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // 히어로 섹션
  heroContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },

  // 리스트 섹션
  dateMeta: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  heroLabelRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  heroMeta: { alignItems: 'flex-end' },
  listSection: { padding: spacing.md, flex: 1 },
  section: { marginBottom: spacing.lg },
  liveHint: { marginBottom: spacing.sm },
  subLabel: { marginBottom: spacing.xs },
});
