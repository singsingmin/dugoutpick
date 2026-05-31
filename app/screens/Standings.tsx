// 구단 순위 탭: 순위 · 팀 · 경기 · 승-패-무 · 승률 · 게임차. 내 응원팀 행 강조. (standings.json)
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
              <PixelText variant="caption" color={colors.onGreen} style={styles.cRank}>순위</PixelText>
              <PixelText variant="caption" color={colors.onGreen} style={styles.cTeam}>팀</PixelText>
              <PixelText variant="caption" color={colors.onGreen} style={styles.cNum}>경기</PixelText>
              <PixelText variant="caption" color={colors.onGreen} style={styles.cRec}>승-패-무</PixelText>
              <PixelText variant="caption" color={colors.onGreen} style={styles.cWr}>승률</PixelText>
              <PixelText variant="caption" color={colors.onGreen} style={styles.cGb}>게임차</PixelText>
            </View>
            {/* 데이터 행 */}
            {rows.map((s) => {
              const mine = s.code != null && s.code === myCode;
              return (
                <View key={`${s.rank}-${s.name}`} style={[styles.row, mine && styles.rowMine, mine && { borderLeftColor: teamColor(s.code) }]}>
                  <PixelText variant="body" color={colors.text} style={styles.cRank}>{s.rank}</PixelText>
                  <PixelText variant="body" color={teamColor(s.code)} style={styles.cTeam}>{s.name}</PixelText>
                  <PixelText variant="caption" color={colors.textDim} style={styles.cNum}>{s.games}</PixelText>
                  <PixelText variant="caption" color={colors.text} style={styles.cRec}>{s.win}-{s.loss}-{s.draw}</PixelText>
                  <PixelText variant="caption" color={colors.text} style={styles.cWr}>{s.winRate.toFixed(3)}</PixelText>
                  <PixelText variant="caption" color={colors.textDim} style={styles.cGb}>{s.gamesBehind === 0 ? '-' : s.gamesBehind}</PixelText>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, borderLeftWidth: 4, borderLeftColor: 'transparent' },
  rowMine: { backgroundColor: colors.surfaceAlt },
  // 컬럼 폭/정렬
  cRank: { width: 30, textAlign: 'center' },
  cTeam: { flex: 1, paddingLeft: spacing.xs },
  cNum: { width: 34, textAlign: 'right' },
  cRec: { width: 72, textAlign: 'right' },
  cWr: { width: 48, textAlign: 'right' },
  cGb: { width: 42, textAlign: 'right' },
  hint: { marginTop: spacing.sm, textAlign: 'right' },
});
