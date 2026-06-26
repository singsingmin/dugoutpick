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
import PixelText from '../components/PixelText';
import MondayReport from '../components/MondayReport';
import TrackRecordBadge from '../components/TrackRecordBadge';
import WeeklyScheduleSheet from '../components/WeeklyScheduleSheet';
import { formatUpdatedAt, relativeFromNow, isKstMonday } from '../utils';
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
            if (hasLive && !intervalRef.current) {
              intervalRef.current = setInterval(refresh, 60_000);
            } else if (!hasLive && intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
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

  // 월요일: 배경 없이 기존 스타일 유지
  if (isKstMonday()) {
    return (
      <SafeAreaView style={styles.safeSolid} edges={['top']}>
        <ScreenHeader title="월요 리포트" leftIcon="📋" />
        <MondayReport />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      {/* 고정 배경 — SafeAreaView/ScrollView 바깥에 있어 스크롤에 영향받지 않음 */}
      <Image
        source={require('../assets/stadium-bg.png')}
        style={styles.bgImage}
        resizeMode="cover"
      />
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

  const recommended: Game | undefined = data.games.find(
    (g) => g.gameId === data.recommendedGameId && g.status !== 'LIVE'
  );
  const rest = data.games
    .filter((g) => g.status !== 'LIVE' && g.gameId !== recommended?.gameId)
    .sort((a, b) => (b.honjam?.score ?? -1) - (a.honjam?.score ?? -1));

  // ── 히어로 우선순위: LIVE top heat → 추천 → 오늘의 명경기 ──
  let heroGame: Game | null = null;
  let heroIcon = '⚾';
  let heroLabel = '오늘의 경기';

  if (liveGames.length > 0) {
    heroGame = liveGames[0];
    heroIcon = '🔴';
    heroLabel = '지금 볼 각';
  } else if (recommended) {
    heroGame = recommended;
    heroIcon = '★';
    heroLabel = '오늘의 추천';
  } else if (bestRecap) {
    heroGame = bestRecap;
    heroIcon = '🏁';
    heroLabel = '오늘의 명경기';
  }

  // ── 리스트: 히어로 제외한 나머지 ──
  const remainingLive = liveGames.filter((g) => g.gameId !== heroGame?.gameId);
  const listBestRecap = heroGame?.gameId === bestRecap?.gameId ? null : bestRecap;
  const listMyFinished = heroGame?.gameId === myFinished?.gameId ? null : myFinished;
  const listRecommended = heroGame?.gameId === recommended?.gameId ? null : recommended;
  const listRest = rest.filter((g) => g.gameId !== heroGame?.gameId);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <ScreenHeader
        title="오늘 경기"
        leftIcon="⚾"
        rightIcon="🗓"
        onRightPress={onCalendar}
      />

      {/* ── 히어로 섹션 ── */}
      <View style={styles.heroContent}>
        <View style={styles.dateRow}>
          <PixelText variant="caption" color={colors.text}>{data.dateText}</PixelText>
          <PixelText variant="caption" color={colors.textDim}>
            갱신 {formatUpdatedAt(data.updatedAt)} · {relativeFromNow(data.updatedAt)}
          </PixelText>
        </View>
        <PixelText variant="title" color={colors.text} style={styles.tagline}>
          오늘 KBO, 볼 각인가?
        </PixelText>
        {heroGame && (
          <View style={styles.heroCardWrap}>
            <SectionLabel icon={heroIcon} label={heroLabel} />
            <GameCard game={heroGame} variant="hero" onPress={() => open(heroGame!.gameId)} />
          </View>
        )}
        <TrackRecordBadge track={data.trackRecord} variant="today" />
      </View>

      {/* ── 리스트 섹션 ── */}
      <View style={styles.listSection}>
        {remainingLive.length > 0 && (
          <View style={styles.section}>
            <SectionLabel icon="🔴" label="지금 볼 각" />
            <PixelText variant="caption" color={colors.textDim} style={styles.liveHint}>
              ⚠ 라이브 점수는 갱신 시각 기준 — 실제보다 몇 분 늦을 수 있다
            </PixelText>
            {remainingLive.map((g) => (
              <LiveCard key={g.gameId} game={g} onPress={() => open(g.gameId)} />
            ))}
          </View>
        )}

        {(listBestRecap || listMyFinished) && (
          <View style={styles.section}>
            <SectionLabel icon="🏁" label="오늘의 결산" />
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
            <SectionLabel icon="★" label="오늘의 추천 경기" />
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
  // position/width/height 명시 — absoluteFillObject의 right/bottom 방식은 웹에서 img 자연 크기를 못 잡음
  bgImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  safe: { flex: 1, backgroundColor: 'transparent' },
  safeSolid: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // 히어로 섹션
  heroContent: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  dateRow: { gap: 2 },
  tagline: { marginTop: spacing.xs, marginBottom: spacing.xs },
  heroCardWrap: { gap: spacing.xs },

  // 리스트 섹션
  listSection: { padding: spacing.md, flex: 1 },
  section: { marginBottom: spacing.lg },
  liveHint: { marginBottom: spacing.sm },
  subLabel: { marginBottom: spacing.xs },
});
