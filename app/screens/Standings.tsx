// 구단 순위 탭: 순위·팀·승·패·무·승률·게임차 + 최근10 폼닷·연속·승률 막대 + 가을야구 컷(5위). 내 팀 강조.
import { useCallback, useState } from 'react';
import { View, ScrollView, Image, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { Standing, RecentGame } from '../types';
import { loadStandings, loadRecent, loadTeams } from '../data/load';
import { getCheerTeam } from '../data/team';
import PixelText from '../components/PixelText';
import ScreenHeader from '../components/ScreenHeader';
import { FormDots } from '../components/charts';
import { border, colors, spacing } from '../theme';
import { useTeamTheme } from '../context/TeamTheme';

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

// 범례 항목: 색상 사각형 + 라벨 (폼닷 색과 일치)
function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSquare, { backgroundColor: color }]} />
      <PixelText variant="caption" color={colors.textDim}>{label}</PixelText>
    </View>
  );
}

export default function Standings() {
  const [rows, setRows] = useState<Standing[]>([]);
  const [recent, setRecent] = useState<Record<string, RecentGame[]>>({});
  const [myCode, setMyCode] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [belowExpanded, setBelowExpanded] = useState(false);
  const { accent } = useTeamTheme();

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

  // 가을야구 마지노선: PO 진출권(5위) 안에 드는 마지막 팀 뒤에 1줄만.
  // 공동 5위처럼 같은 순위가 둘이어도 줄이 두 번 그려지지 않도록 index 기준으로 처리.
  const poCutIndex = rows.reduce((acc, s, i) => (s.rank <= PO_CUT ? i : acc), -1);

  return (
    <View style={styles.root}>
      <Image source={require('../assets/stadium-bg.png')} style={styles.bgImage} resizeMode="cover" />
      <View style={styles.bgOverlay} />
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
            <View style={[styles.headerRow, { backgroundColor: accent }]}>
              <PixelText style={[styles.hCell, COLS.rank]} color={colors.onGreen}>순위</PixelText>
              <PixelText style={[styles.hCell, COLS.team, styles.teamAlign]} color={colors.onGreen}>팀</PixelText>
              <PixelText style={[styles.hCell, COLS.win]} color={colors.onGreen}>승</PixelText>
              <PixelText style={[styles.hCell, COLS.loss]} color={colors.onGreen}>패</PixelText>
              <PixelText style={[styles.hCell, COLS.draw]} color={colors.onGreen}>무</PixelText>
              <PixelText style={[styles.hCell, COLS.wr]} color={colors.onGreen}>승률</PixelText>
              <PixelText style={[styles.hCell, COLS.gb]} color={colors.onGreen}>게임차</PixelText>
            </View>
            {/* 데이터 */}
            {rows.map((s, i) => {
              const mine = s.code != null && s.code === myCode;
              const games = (s.code && recent[s.code]) || [];
              const isBelowCut = poCutIndex >= 0 && i > poCutIndex;
              return (
                <View key={`${s.rank}-${s.name}`}>
                  {/* 가을야구 마지노선 아래 팀은 접힌 상태에서 숨김 */}
                  {(!isBelowCut || belowExpanded) && (
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
                  )}
                  {/* 가을야구 마지노선 — 탭하면 아래 팀 펼치기/접기 */}
                  {i === poCutIndex && (
                    <Pressable style={styles.cutRow} onPress={() => setBelowExpanded(v => !v)}>
                      <View style={styles.cutLine} />
                      <View style={styles.cutLabel}>
                        <PixelText variant="caption" color={colors.onGold}>
                          🍂 가을야구 마지노선 {belowExpanded ? '▲' : '▼'}
                        </PixelText>
                      </View>
                      <View style={styles.cutLine} />
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
          <View style={styles.legend}>
            <View style={styles.legendRow}>
              <PixelText variant="caption" color={colors.textDim}>최근 10경기 ← 오래·최신 →</PixelText>
              <LegendItem color={colors.good} label="승" />
              <LegendItem color={colors.bad} label="패" />
              <LegendItem color={colors.textDim} label="무" />
            </View>
            {myCode && <PixelText variant="caption" color={colors.textDim}>★ 내 팀 강조</PixelText>}
          </View>
        </ScrollView>
      )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bgImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  bgOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(243,233,206,0.48)' },
  safe: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: border.radius, backgroundColor: colors.surface, overflow: 'hidden' },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: spacing.sm },
  block: { paddingVertical: 7, paddingHorizontal: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, borderLeftWidth: 4, borderLeftColor: 'transparent' },
  blockMine: { backgroundColor: colors.surfaceAlt },
  row: { flexDirection: 'row', alignItems: 'center' },
  // 모든 셀 통일: 같은 폰트 크기 + 가운데 정렬 → 행 간 정렬 일치 (영문/한글 폭차 흡수)
  cell: { fontSize: 12, textAlign: 'center' },
  hCell: { fontSize: 10, textAlign: 'center' },
  rankText: { fontSize: 13 },
  teamAlign: { textAlign: 'left', paddingLeft: spacing.xs },
  formRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, minHeight: 11 },
  wrTrack: { height: 5, backgroundColor: colors.track, borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  wrFill: { height: '100%' },
  cutRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, backgroundColor: colors.goldSoft },
  cutLine: { flex: 1, height: 3, backgroundColor: colors.gold, borderRadius: 2 },
  cutLabel: { backgroundColor: colors.gold, borderColor: colors.border, borderWidth: 2, borderRadius: border.radius, paddingVertical: 3, paddingHorizontal: spacing.sm },
  legend: { marginTop: spacing.sm, gap: 4, alignItems: 'flex-end' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'flex-end' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendSquare: { width: 9, height: 9, borderRadius: 1, borderWidth: 1, borderColor: colors.border },
});
