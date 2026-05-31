// 구단 순위 탭: 순위·팀·경기·승·패·무·승률·게임차. 내 응원팀 행 강조. (standings.json)
import { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { Standing } from '../types';
import { loadStandings, loadTeams } from '../data/load';
import { getCheerTeam } from '../data/team';
import PixelText from '../components/PixelText';
import ScreenHeader from '../components/ScreenHeader';
import { border, colors, spacing } from '../theme';

const TEAMS = loadTeams().teams;
const teamColor = (code: string | null) => TEAMS.find((t) => t.code === code)?.color ?? colors.text;

// 컬럼 정의: 폭/정렬을 헤더·데이터가 공유 → 행 간 정렬 보장
const COLS = {
  rank: { width: 30 },
  team: { flex: 1 },
  games: { width: 40 },
  win: { width: 32 },
  loss: { width: 32 },
  draw: { width: 30 },
  wr: { width: 54 },
  gb: { width: 44 },
} as const;

export default function Standings() {
  const [rows, setRows] = useState<Standing[]>([]);
  const [myCode, setMyCode] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [s, c] = await Promise.all([loadStandings(), getCheerTeam()]);
        if (!active) return;
        setRows(s.standings);
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
              <PixelText style={[styles.hCell, COLS.games]} color={colors.onGreen}>경기</PixelText>
              <PixelText style={[styles.hCell, COLS.win]} color={colors.onGreen}>승</PixelText>
              <PixelText style={[styles.hCell, COLS.loss]} color={colors.onGreen}>패</PixelText>
              <PixelText style={[styles.hCell, COLS.draw]} color={colors.onGreen}>무</PixelText>
              <PixelText style={[styles.hCell, COLS.wr]} color={colors.onGreen}>승률</PixelText>
              <PixelText style={[styles.hCell, COLS.gb]} color={colors.onGreen}>게임차</PixelText>
            </View>
            {/* 데이터 */}
            {rows.map((s) => {
              const mine = s.code != null && s.code === myCode;
              return (
                <View key={`${s.rank}-${s.name}`} style={[styles.row, mine && styles.rowMine, mine && { borderLeftColor: teamColor(s.code) }]}>
                  <PixelText style={[styles.cell, COLS.rank, styles.rankText]} color={colors.text}>{s.rank}</PixelText>
                  <PixelText style={[styles.cell, COLS.team, styles.teamAlign]} color={teamColor(s.code)} numberOfLines={1}>{s.name}</PixelText>
                  <PixelText style={[styles.cell, COLS.games]} color={colors.textDim}>{s.games}</PixelText>
                  <PixelText style={[styles.cell, COLS.win]} color={colors.text}>{s.win}</PixelText>
                  <PixelText style={[styles.cell, COLS.loss]} color={colors.text}>{s.loss}</PixelText>
                  <PixelText style={[styles.cell, COLS.draw]} color={colors.textDim}>{s.draw}</PixelText>
                  <PixelText style={[styles.cell, COLS.wr]} color={colors.text}>{s.winRate.toFixed(3)}</PixelText>
                  <PixelText style={[styles.cell, COLS.gb]} color={colors.textDim}>{s.gamesBehind === 0 ? '-' : s.gamesBehind}</PixelText>
                </View>
              );
            })}
          </View>
          {myCode && <PixelText variant="caption" color={colors.textDim} style={styles.hint}>★ 내 팀 강조 표시</PixelText>}
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
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, borderLeftWidth: 4, borderLeftColor: 'transparent' },
  rowMine: { backgroundColor: colors.surfaceAlt },
  // 모든 셀 통일: 같은 폰트 크기 + 가운데 정렬 → 행 간 정렬 일치 (영문/한글 폭차 흡수)
  cell: { fontSize: 12, textAlign: 'center' },
  hCell: { fontSize: 10, textAlign: 'center' },
  rankText: { fontSize: 13 },
  teamAlign: { textAlign: 'left', paddingLeft: spacing.xs },
  hint: { marginTop: spacing.sm, textAlign: 'right' },
});
