// 전체 랭킹 화면(방향 B) — 예측 리그 메인의 '전체 랭킹 보기'에서 진입.
// board 파라미터로 포인트/적중률 중 하나의 전체 목록을 순위표 톤으로 표시.
import { useCallback, useState } from 'react';
import { View, Image, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { fetchMonthlyLeaderboard, fetchMonthlyHitrateLeaderboard } from '../services/predictions';
import PixelText from '../components/PixelText';
import ScreenHeader from '../components/ScreenHeader';
import LeaderboardTable, { type LbRow } from '../components/LeaderboardTable';
import { useTeamTheme } from '../context/TeamTheme';
import { colors, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'FullLeaderboard'>;

// PredictionLeague와 동일한 적중률 최소 참여 안내 문구용.
const MIN_HITRATE_PARTICIPATION = 5;

export default function FullLeaderboard() {
  const navigation = useNavigation<Nav>();
  const board = useRoute<Rt>().params.board;
  const { accent } = useTeamTheme();
  const [rows, setRows] = useState<LbRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const p = board === 'points'
        ? fetchMonthlyLeaderboard(100).then((list) => list.map((r, i): LbRow => ({
            rank: i + 1, nickname: r.nickname, isMe: r.isMe,
            right: `${r.monthlyPoints}점`, sub: `적중 ${r.hits}/${r.participations}`,
          })))
        : fetchMonthlyHitrateLeaderboard(100).then((list) => list.map((r, i): LbRow => ({
            rank: i + 1, nickname: r.nickname, isMe: r.isMe,
            right: `${r.hitRate}%`, sub: `${r.hits}/${r.participations}`,
          })));
      p.then((rs) => { if (!active) return; setRows(rs); setLoaded(true); })
        .catch(() => { if (active) setLoaded(true); });
      return () => { active = false; };
    }, [board])
  );

  const title = board === 'points' ? '이번 달 포인트 랭킹' : '이번 달 적중률 랭킹';

  return (
    <View style={styles.root}>
      <Image source={require('../assets/stadium-bg.webp')} style={styles.bgImage} resizeMode="cover" />
      <View style={styles.bgOverlay} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title={title} leftIcon="back" onLeftPress={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.content}>
          {!loaded ? (
            <PixelText variant="caption" color={colors.textDim}>불러오는 중...</PixelText>
          ) : rows.length === 0 ? (
            <PixelText variant="body" color={colors.textDim}>
              {board === 'hitrate'
                ? `이번 달 ${MIN_HITRATE_PARTICIPATION}회 이상 참여한 사람만 집계돼요`
                : '이번 달 참여 기록이 없어요'}
            </PixelText>
          ) : (
            <LeaderboardTable rows={rows} accent={accent} />
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
});
