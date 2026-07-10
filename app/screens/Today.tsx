// 오늘경기 탭: 야구장 고정 배경 전체 + 반투명 카드. (flow.md, ADR-004)
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, ScrollView, ActivityIndicator, Image, StyleSheet, RefreshControl, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { GamesData, Game, DailyHoneyResult } from '../types';
import { loadGames, loadDailyHoney } from '../data/load';
import { getCheerTeam } from '../data/team';
import GameCard from '../components/GameCard';
import LiveCard from '../components/LiveCard';
import { getActiveWalkoff, inferWalkoffOnFinal } from '../utils/liveHeat';
import ScreenHeader from '../components/ScreenHeader';
import SectionLabel from '../components/SectionLabel';
import Panel from '../components/Panel';
import TeamName from '../components/TeamName';
import type { AppIconName } from '../components/AppIcon';
import PixelText from '../components/PixelText';
import MondayReport from '../components/MondayReport';
import WeeklyScheduleSheet from '../components/WeeklyScheduleSheet';
import PredictionCard from '../components/PredictionCard';
import RewardInboxModal from '../components/RewardInboxModal';
import { fetchUnseenRewardEvents, markRewardEventsSeen, type RewardEvent } from '../services/rewards';
import { useScoreSkin } from '../context/ScoreSkin';
import { isKstMonday, kstDatetime } from '../utils';
import { kstDateStr, prevDateStr } from '../utils/attendance';
import { colors, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function Today() {
  const navigation = useNavigation<Nav>();
  const [data, setData] = useState<GamesData | null>(null);
  const [cheerTeam, setCheerTeam] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [weeklyVisible, setWeeklyVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dailyHoney, setDailyHoney] = useState<DailyHoneyResult | null>(null);
  const { refreshAccount } = useScoreSkin();
  const [rewardEvents, setRewardEvents] = useState<RewardEvent[]>([]);

  const activeRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataRef = useRef<GamesData | null>(null);   // 현재 표시본(폴백 되돌림 방지 비교용)

  useEffect(() => {   // 진단(임시)
    const s = typeof performance !== 'undefined' && performance.now ? Math.round(performance.now()) : -1;
    console.log('[today] mount · sincePageLoad≈', s, 'ms');
  }, []);

  // 데이터 로드 + 상태별 폴링 재예약. 전 경기 종료(+highlight 없음)·경기 없는 날엔 폴링 중단.
  const load = useCallback((): Promise<void> => {
    return loadGames()
      .then((d) => {
        if (!activeRef.current) return;
        // 폴백(캐시/번들)로 updatedAt이 현재 표시본보다 과거로 뒤로 가지 않게: 더 오래되면 유지.
        const prev = dataRef.current;
        const chosen = prev && new Date(d.updatedAt).getTime() < new Date(prev.updatedAt).getTime() ? prev : d;
        dataRef.current = chosen;
        setData(chosen);
        setFailed(false);
        // FINAL 전환 끝내기 추론(LIVE 스냅샷 못 잡은 경우 walkoff highlight 등록).
        chosen.games.forEach((g) => inferWalkoffOnFinal(g));
        const hasLive = chosen.games.some((g) => g.status === 'LIVE');
        const anyWalkoff = chosen.games.some((g) => !!getActiveWalkoff(g.gameId));
        const allDone = chosen.games.length > 0 && chosen.games.every((g) => g.status === 'FINAL' || g.status === 'CANCELED');
        // 유지: LIVE거나 끝내기 highlight 활성이거나 아직 안 끝난 경기가 있을 때. 그 외(전경기 종료·경기 없음)는 중단.
        const keepPolling = hasLive || anyWalkoff || (chosen.games.length > 0 && !allDone);
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        if (keepPolling) {
          const targetMs = hasLive ? 30_000 : 60_000;   // LIVE 30s / 그 외 60s
          intervalRef.current = setInterval(() => { void load(); }, targetMs);
        }
      })
      .catch(() => { if (activeRef.current) setFailed(true); });
  }, []);

  // '어제의 명경기' — 하루 한 번이면 충분해 폴링 없이 마운트 시 1회만 로드.
  // away/home 필드 추가 이전 과거 기록(append-only freeze라 소급 안 됨)은 건너뜀.
  // 기록의 date가 실제 '어제(KST)'일 때만 채택 — 경기 공백기(예: 상·하반기 사이)에
  // 마지막 경기가 며칠 전이면 '어제의 명경기'로 표시되면 안 됨(YYYYMMDD 비교).
  useEffect(() => {
    let active = true;
    const yesterday = prevDateStr(kstDateStr()).replace(/-/g, '');
    loadDailyHoney()
      .then((d) => {
        if (!active) return;
        const last = [...d.results].reverse().find((r) => r.away && r.home) ?? null;
        setDailyHoney(last && last.date === yesterday ? last : null);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // foreground 복귀(탭 focus)마다 재fetch + 폴링 재개.
  useFocusEffect(
    useCallback(() => {
      activeRef.current = true;
      void load();
      getCheerTeam().then((c) => activeRef.current && setCheerTeam(c));
      return () => {
        activeRef.current = false;
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      };
    }, [load])
  );

  // 앱 백그라운드→foreground 복귀 시 즉시 재fetch. useFocusEffect는 탭 focus에만 발동하고
  // 앱 재진입(화면 유지)엔 발동하지 않으므로, 이게 없으면 다음 폴(최대 60초)까지 갱신이 밀린다.
  // Today가 현재 focus된 화면일 때만(activeRef) 재요청 — 다른 탭이면 스킵.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && activeRef.current) void load();
    });
    return () => sub.remove();
  }, [load]);

  // 수동 새로고침(pull-to-refresh)
  const onManualRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // 미확인 보상 알림(월간 밀스톤 등) — 앱/탭 진입 시 조회해 모달 표시(P1).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchUnseenRewardEvents().then((evs) => { if (active) setRewardEvents(evs); }).catch(() => {});
      return () => { active = false; };
    }, [])
  );

  const closeRewards = useCallback(async () => {
    const ids = rewardEvents.map((e) => e.id);
    setRewardEvents([]);
    try { await markRewardEventsSeen(ids); await refreshAccount(); } catch { /* 다음 진입 때 재시도 */ }
  }, [rewardEvents, refreshAccount]);

  const open = (gameId: string) => navigation.navigate('GameDetail', { gameId });

  if (isKstMonday()) {
    return (
      <View style={styles.root}>
        <Image source={require('../assets/stadium-bg.webp')} style={styles.bgImage} resizeMode="cover" />
        <View style={styles.bgOverlay} />
        <SafeAreaView style={styles.safe} edges={['top']}>
          <ScreenHeader title="월요 리포트" leftIcon="clipboard" />
          <MondayReport />
        </SafeAreaView>
        <RewardInboxModal events={rewardEvents} onClose={closeRewards} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* 고정 배경 — SafeAreaView/ScrollView 바깥에 있어 스크롤에 영향받지 않음 */}
      <Image source={require('../assets/stadium-bg.webp')} style={styles.bgImage} resizeMode="cover" />
      {/* 흰색 오버레이 — 채도 낮춰 눈 부담 감소 */}
      <View style={styles.bgOverlay} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <WeeklyScheduleSheet visible={weeklyVisible} onClose={() => setWeeklyVisible(false)} />
        {failed ? (
          <Centered text="데이터를 불러오지 못했다" />
        ) : !data ? (
          <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
        ) : data.games.length === 0 ? (
          <View style={styles.emptyTop}>
            <ScreenHeader title="오늘 경기" leftIcon="baseball" rightIcon="calendar" onRightPress={() => setWeeklyVisible(true)} />
            <PixelText variant="title" color={colors.text} style={styles.emptyTitle}>오늘 경기가 없어요</PixelText>
            {dailyHoney && (
              <View style={styles.emptyHoney}>
                <YesterdayHoneyCard honey={dailyHoney} />
              </View>
            )}
          </View>
        ) : (
          <Body data={data} open={open} cheerTeam={cheerTeam} onCalendar={() => setWeeklyVisible(true)} refreshing={refreshing} onRefresh={onManualRefresh} dailyHoney={dailyHoney} />
        )}
      </SafeAreaView>
      <RewardInboxModal events={rewardEvents} onClose={closeRewards} />
    </View>
  );
}

function Body({
  data, open, cheerTeam, onCalendar, refreshing, onRefresh, dailyHoney,
}: {
  data: GamesData;
  open: (id: string) => void;
  cheerTeam: string | null;
  onCalendar: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  dailyHoney: DailyHoneyResult | null;
}) {
  // LIVE + 끝내기 역전 highlight(FINAL 후 2분) 를 '지금 볼 각'에 표시.
  const liveGames = data.games
    .filter((g) => g.status === 'LIVE' || !!getActiveWalkoff(g.gameId))
    .sort((a, b) => (b.live?.heat ?? 0) - (a.live?.heat ?? 0));
  const liveIds = new Set(liveGames.map((g) => g.gameId));

  const finished = data.games.filter((g) => g.status === 'FINAL' && g.recap && !liveIds.has(g.gameId));
  const bestRecap = finished.length
    ? finished.slice().sort((a, b) => (b.recap?.actual ?? 0) - (a.recap?.actual ?? 0))[0]
    : null;
  // 내 팀 경기는 '오늘 끝난/취소된 경기'면 recap(파이프라인, 최대 5분 지연) 유무와 무관하게
  // 결산 섹션에 노출. FINAL뿐 아니라 CANCELED(우천취소 등)도 포함 — '다른 경기'로 밀리지 않게.
  const myDone = cheerTeam
    ? data.games.find(
        (g) =>
          (g.status === 'FINAL' || g.status === 'CANCELED') &&
          !liveIds.has(g.gameId) &&
          (g.away.code === cheerTeam || g.home.code === cheerTeam)
      )
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
    .filter((g) => !liveIds.has(g.gameId) && (allDone || g.gameId !== recommended?.gameId))
    .sort((a, b) => (b.honjam?.score ?? -1) - (a.honjam?.score ?? -1));

  // ── 히어로: 추천 경기(SCHEDULED)만. LIVE는 히어로로 승격하지 않고 '지금 볼 각' 리스트에 균일 표시.
  const heroIcon: AppIconName = 'star';
  const heroLabel = '오늘의 추천';
  const heroGame: Game | null = !allDone && recommended ? recommended : null;

  // ── 리스트: 명경기는 항상 결산 섹션에 표시
  const listBestRecap = bestRecap ?? null;
  const listMyDone = heroGame?.gameId === myDone?.gameId ? null : myDone;
  // allDone 시 추천 섹션 숨김 (rest에 이미 포함)
  const listRecommended = allDone ? null : (heroGame?.gameId === recommended?.gameId ? null : recommended);
  // LIVE는 히어로로 승격하지 않으므로 전부 '지금 볼 각' 리스트에 표시
  const listLiveGames = liveGames;
  // 버그픽스: bestRecap·myDone 중복 제거
  const listRest = rest.filter(
    (g) => g.gameId !== heroGame?.gameId
      && g.gameId !== listBestRecap?.gameId
      && g.gameId !== listMyDone?.gameId
  );

  // '어제의 명경기' — 오늘 아직 아무 경기도 시작/종료 안 한 조용한 시간대(대개 이른 아침)에만.
  // 오늘 콘텐츠(라이브·결산)가 하나라도 생기면 자동으로 사라짐.
  const showYesterdayHoney = !!dailyHoney && !allDone && liveGames.length === 0 && finished.length === 0;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
    >
      <ScreenHeader
        title="오늘 경기"
        leftIcon="baseball"
        rightIcon="calendar"
        onRightPress={onCalendar}
      />
      {/* 어제의 명경기 — 표시 기준은 그대로, 위치만 맨 위(오늘의 예측 위)로 */}
      {showYesterdayHoney && dailyHoney && (
        <View style={styles.heroContent}>
          <YesterdayHoneyCard honey={dailyHoney} />
        </View>
      )}
      <PredictionCard dateYmd={data.date} games={data.games} locked={allDone || liveGames.length > 0} />
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
        {listLiveGames.length > 0 && (
          <View style={styles.section}>
            <View style={styles.heroLabelRow}>
              <SectionLabel icon="live" label="지금 볼 각" />
              {/* 갱신 시각은 추천 히어로에 이미 있으면 중복 방지 — 히어로 없을 때만 여기 표시 */}
              {!heroGame && (
                <View style={styles.heroMeta}>
                  <PixelText variant="caption" color={colors.textDim}>갱신 {kstDatetime(data.updatedAt)}</PixelText>
                </View>
              )}
            </View>
            <PixelText variant="caption" color={colors.textDim} style={styles.liveHint}>
              ⚠ 라이브 점수는 30초 간격 갱신 — 실제보다 몇 초 늦을 수 있다
            </PixelText>
            {listLiveGames.map((g) => (
              <LiveCard key={g.gameId} game={g} onPress={() => open(g.gameId)} />
            ))}
          </View>
        )}

        {(listBestRecap || listMyDone) && (
          <View style={styles.section}>
            <SectionLabel icon="flag" label="오늘의 결산" />
            {listBestRecap && (
              <>
                <PixelText variant="caption" color={colors.accent} style={styles.subLabel}>오늘의 명경기</PixelText>
                <GameCard game={listBestRecap} variant="list" onPress={() => open(listBestRecap.gameId)} />
              </>
            )}
            {listMyDone && listMyDone.gameId !== listBestRecap?.gameId && (
              <>
                <PixelText variant="caption" color={colors.accent} style={styles.subLabel}>내 팀 결과</PixelText>
                <GameCard game={listMyDone} variant="list" onPress={() => open(listMyDone.gameId)} />
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

// '어제의 명경기' 티저 카드 — 오늘 콘텐츠가 아직 없는 조용한 시간대 채우기용. 상세화면 연결 없음(과거 경기라 오늘 데이터엔 없음).
function YesterdayHoneyCard({ honey }: { honey: DailyHoneyResult }) {
  if (!honey.away || !honey.home) return null; // 필드 추가 이전 과거 기록 방어
  // displayMode/displayTitle는 신규 필드 — 과거 동결 기록엔 없어 방어적으로 유도.
  // (특별 태그가 있거나 실제 꿀잼 >= 60이면 '명경기', 아니면 '요약')
  const hasSpecialTag = honey.decidingReasonTags.some((t) => !/^(recapScore|실제 꿀잼)\b/.test(t));
  const mode = honey.displayMode ?? ((hasSpecialTag || honey.recapScore >= 60) ? 'highlight' : 'summary');
  const title = honey.displayTitle ?? (mode === 'highlight' ? '어제의 명경기' : '어제 경기 요약');
  const hasScore = typeof honey.away.score === 'number' && typeof honey.home.score === 'number';
  return (
    <View style={styles.honeySection}>
      <SectionLabel icon="fire" label={title} />
      <Panel style={styles.honeyCard}>
        <View style={styles.honeyRow}>
          <TeamName code={honey.away.code} variant="body" />
          {hasScore
            ? <PixelText variant="body" color={colors.text}>{honey.away.score} : {honey.home.score}</PixelText>
            : <PixelText variant="caption" color={colors.textDim}>VS</PixelText>}
          <TeamName code={honey.home.code} variant="body" />
        </View>
        {mode === 'highlight' ? (
          <PixelText variant="caption" color={colors.accent} style={styles.honeyReason}>
            {/* 과거 파이프라인이 남긴 영어 폴백 태그(recapScore N)를 '실제 꿀잼 N'으로 표시 */}
            {honey.decidingReasonTags.map((t) => t.replace(/^recapScore\s+/, '실제 꿀잼 ')).join(' · ')}
          </PixelText>
        ) : (
          <PixelText variant="caption" color={colors.textDim} style={styles.honeyReason}>
            어제 가장 볼 만했던 경기였어요
          </PixelText>
        )}
      </Panel>
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
  emptyTop: { flex: 1 },   // 경기 없는 날 — 헤더 + 콘텐츠를 상단부터
  emptyTitle: { marginTop: spacing.xl, paddingHorizontal: spacing.md },   // 좌측 정렬(어제 명경기 카드와 같은 패딩)

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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.xs,
  },
  heroMeta: { alignItems: 'flex-end' },
  listSection: { padding: spacing.md, flex: 1 },
  section: { marginBottom: spacing.lg },
  liveHint: { marginBottom: spacing.sm },
  subLabel: { marginBottom: spacing.xs },

  // '어제의 명경기' 카드 — 오늘의 예측과 동일하게 왼쪽 정렬, 아래 간격은 좁게(heroContent+예측카드 패딩이 이미 있음)
  emptyHoney: { marginTop: spacing.lg, width: '100%', paddingHorizontal: spacing.md },
  honeySection: {},
  honeyCard: { gap: spacing.xs },
  honeyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: spacing.sm },
  honeyReason: {},
});
