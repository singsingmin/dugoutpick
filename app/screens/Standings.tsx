// 구단 순위 탭: 순위·팀·승·패·무·승률·게임차 + 최근10 폼닷·연속·승률 막대 + 가을야구 컷(5위). 내 팀 강조.
import { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { Standing, RecentGame } from '../types';
import { loadStandings, loadRecent, loadTeams } from '../data/load';
import { getCheerTeam } from '../data/team';
import PixelText from '../components/PixelText';
import ScreenHeader from '../components/ScreenHeader';
import { FormDots } from '../components/charts';
import { border, colors, spacing } from '../theme';

const TEAMS = loadTeams().teams;
const teamColor = (code: string | null) => TEAMS.find((t) => t.code === code)?.color ?? colors.text;

// KBO 포스트시즌 = 상위 5팀. 5위와 6위 사이가 '가을야구 마지노선'.
const PO_CUT = 5;

// 컬럼 정의: 폭/정렬을 헤더·데이터가 공유 → 행 간 정렬 보장 ('경기'는 정보가치 낮아 제외)
const COLS = {
  rank: { width: 28 },
  team: { flex: 1 },
  win: { width: 30 },
  loss: { width: 30 },
  draw: { width: 28 },
  wr: { width: 50 },
  gb: { width: 44 },
} as const;

function streakColor(streak: string): string {
  if (streak.includes('승')) return colors.good;
  if (streak.includes('패')) return colors.bad;
  return colors.textDim;
}

export default function Standings() {
  const [rows, setRows] = useState<Standing[]>([]);
  const [recent, setRecent] = useState<Record<string, RecentGame[]>>({});
  const [myCode, setMyCode] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [s, r, c] = await Promise.all([loadStandings(), loadRecent(), getCheerTeam()]);
        if (!active) return;
        setRows(s.standings);
        setRecent(r.recent);
        setMyCode(c);
        setLoaded(true);
      })();
      return () => { active = false; };
    }, [])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="구단 순위" leftIcon="📊" />
      {!loaded ? (
        <View style={styles.center} />
      ) : rows.length === 0 ? (
        <View style={styles.center}><PixelText variant="title" color={colors.textDim}>순위 정보가 없다</PixelText></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.table}>
            {/* 헤더 */}
            <View style={styles.headerRow}>
              <PixelText style={[styles.hCell, COLS.rank]} color={colors.onGreen}>순위</PixelText>
              <PixelText style={[styles.hCell, COLS.team, styles.teamAlign]} color={colors.onGreen}>팀</PixelText>
              <PixelText style={[styles.hCell, COLS.win]} color={colors.onGreen}>승</PixelText>
              <PixelText style={[styles.hCell, COLS.loss]} color={colors.onGreen}>패</PixelText>
              <PixelText style={[styles.hCell, COLS.draw]} color={colors.onGreen}>무</PixelText>
              <PixelText style={[styles.hCell, COLS.wr]} color={colors.onGreen}>승률</PixelText>
              <PixelText style={[styles.hCell, COLS.gb]} color={colors.onGreen}>게임차</PixelText>
            </View>
            {/* 데이터 */}
            {rows.map((s) => {
              const mine = s.code != null && s.code === myCode;
              const games = (s.code && recent[s.code]) || [];
              return (
                <View key={`${s.rank}-${s.name}`}>
                  <View style={[styles.block, mine && styles.blockMine, mine && { borderLeftColor: teamColor(s.code) }]}>
                    {/* 1줄: 숫자 표 */}
                    <View style={styles.row}>
                      <PixelText style={[styles.cell, COLS.rank, styles.rankText]} color={colors.text}>{s.rank}</PixelText>
                      <PixelText style={[styles.cell, COLS.team, styles.teamAlign]} color={teamColor(s.code)} numberOfLines={1}>{s.name}</PixelText>
                      <PixelText style={[styles.cell, COLS.win]} color={colors.text}>{s.win}</PixelText>
                      <PixelText style={[styles.cell, COLS.loss]} color={colors.text}>{s.loss}</PixelText>
                      <PixelText style={[styles.cell, COLS.draw]} color={colors.textDim}>{s.draw}</PixelText>
                      <PixelText style={[styles.cell, COLS.wr]} color={colors.text}>{s.winRate.toFixed(3)}</PixelText>
                      <PixelText style={[styles.cell, COLS.gb]} color={colors.textDim}>{s.gamesBehind === 0 ? '-' : s.gamesBehind}</PixelText>
                    </View>
                    {/* 2줄: 최근10 폼닷 + 연속 */}
                    <View style={styles.formRow}>
                      {games.length > 0 ? <FormDots games={games} compact /> : <View />}
                      <PixelText variant="caption" color={streakColor(s.streak)}>{s.streak}</PixelText>
                    </View>
                    {/* 승률 막대 */}
                    <View style={styles.wrTrack}>
                      <View style={[styles.wrFill, { width: `${Math.round(s.winRate * 100)}%`, backgroundColor: teamColor(s.code) }]} />
                    </View>
                  </View>
                  {/* 가을야구 마지노선 */}
                  {s.rank === PO_CUT && (
                    <View style={styles.cutRow}>
                      <View style={styles.cutLine} />
                      <PixelText variant="caption" color={colors.accent} style={styles.cutLabel}>가을야구 마지노선</PixelText>
                      <View style={styles.cutLine} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
          <View style={styles.legend}>
            <PixelText variant="caption" color={colors.textDim}>최근 10경기 ← 오래 · 최신 → · ■승 ■패 ■무</PixelText>
            {myCode && <PixelText variant="caption" color={colors.textDim}>★ 내 팀 강조</PixelText>}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md },
  table: { borderWidth: border.width, borderColor: colors.border, borderRadius: border.radius, backgroundColor: colors.surface, overflow: 'hidden' },
  headerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent, paddingVertical: 6, paddingHorizontal: spacing.sm },
  block: { paddingVertical: 7, paddingHorizontal: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, borderLeftWidth: 4, borderLeftColor: 'transparent' },
  blockMine: { backgroundColor: colors.surfaceAlt },
  row: { flexDirection: 'row', alignItems: 'center' },
  // 모든 셀 통일: 같은 폰트 크기 + 가운데 정렬 → 행 간 정렬 일치 (영문/한글 폭차 흡수)
  cell: { fontSize: 12, textAlign: 'center' },
  hCell: { fontSize: 10, textAlign: 'center' },
  rankText: { fontSize: 13 },
  teamAlign: { textAlign: 'left', paddingLeft: spacing.xs },
  formRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, minHeight: 11 },
  wrTrack: { height: 5, backgroundColor: colors.surfaceAlt, borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  wrFill: { height: '100%' },
  cutRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4, paddingHorizontal: spacing.sm, backgroundColor: colors.bg },
  cutLine: { flex: 1, height: 2, backgroundColor: colors.accent, opacity: 0.5 },
  cutLabel: { },
  legend: { marginTop: spacing.sm, gap: 2, alignItems: 'flex-end' },
});
