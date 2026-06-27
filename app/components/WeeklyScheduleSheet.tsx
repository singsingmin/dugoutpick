// 이번 주 경기 일정 바텀시트. Today 헤더 달력 버튼으로 열림.
// report.json의 thisWeek.team 데이터를 날짜별로 그룹화해 표시.
import { useEffect, useState } from 'react';
import { Modal, View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { loadReport, loadTeams } from '../data/load';
import { getCheerTeam } from '../data/team';
import type { ReportData } from '../types';
import PixelText from './PixelText';
import { border, colors, spacing } from '../theme';
import { shortDateDow } from '../utils';
import { useTeamTheme } from '../context/TeamTheme';

const TEAMS = loadTeams().teams;
const teamNameOf = (code: string) => TEAMS.find((t) => t.code === code)?.name ?? code;
const teamColorOf = (code: string) => TEAMS.find((t) => t.code === code)?.color ?? colors.text;

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface GameEntry { date: string; away: string; home: string; awayStarter?: string | null; homeStarter?: string | null; }

export default function WeeklyScheduleSheet({ visible, onClose }: Props) {
  const [report, setReport] = useState<ReportData | null>(null);
  const [cheerTeam, setCheerTeam] = useState<string | null>(null);
  const { accent } = useTeamTheme();

  useEffect(() => {
    getCheerTeam().then(setCheerTeam);
  }, []);

  useEffect(() => {
    if (!visible) return;
    loadReport().then(setReport).catch(() => {});
  }, [visible]);

  const grouped: { date: string; games: GameEntry[] }[] = [];
  if (report) {
    const seen = new Set<string>();
    const all: GameEntry[] = [];
    for (const games of Object.values(report.thisWeek.team)) {
      for (const g of games) {
        const key = `${g.date}-${g.away}-${g.home}`;
        if (!seen.has(key)) { seen.add(key); all.push(g); }
      }
    }
    all.sort((a, b) => a.date.localeCompare(b.date));
    const byDate = new Map<string, GameEntry[]>();
    for (const g of all) {
      const arr = byDate.get(g.date) ?? [];
      arr.push(g);
      byDate.set(g.date, arr);
    }
    for (const [date, games] of byDate) grouped.push({ date, games });
  }

  const range = report?.thisWeek.range;
  const rangeText = range ? `${shortDateDow(range[0])} ~ ${shortDateDow(range[1])}` : '';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <PixelText variant="title">이번 주 일정</PixelText>
              {rangeText ? <PixelText variant="caption" color={colors.textDim}>{rangeText}</PixelText> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <PixelText variant="body" color={colors.textDim}>✕</PixelText>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {grouped.length === 0 && (
              <PixelText variant="caption" color={colors.textDim} style={styles.empty}>
                {report ? '이번 주 일정이 없다' : '불러오는 중...'}
              </PixelText>
            )}
            {grouped.map(({ date, games }) => (
              <View key={date} style={styles.dateGroup}>
                <View style={styles.dateLabelRow}>
                  <PixelText variant="caption" color={colors.onGreen} style={[styles.dateLabel, { backgroundColor: accent }]}>
                    {shortDateDow(date)}
                  </PixelText>
                </View>
                {games.map((g, i) => {
                  const isMyTeam = !!cheerTeam && (g.away === cheerTeam || g.home === cheerTeam);
                  return (
                    <View key={i} style={[styles.gameRow, isMyTeam && styles.myTeamRow]}>
                      <View style={styles.gameRowInner}>
                        <View style={styles.teamRow}>
                          <PixelText variant="body" color={teamColorOf(g.away)} style={styles.teamNameText} numberOfLines={1}>{teamNameOf(g.away)}</PixelText>
                          <PixelText variant="caption" color={colors.textDim} style={styles.vs}>vs</PixelText>
                          <PixelText variant="body" color={teamColorOf(g.home)} style={styles.teamNameText} numberOfLines={1}>{teamNameOf(g.home)}</PixelText>
                        </View>
                        {(g.awayStarter || g.homeStarter) && (
                          <View style={styles.starterRow}>
                            <PixelText variant="caption" color={colors.textDim} style={styles.starterText} numberOfLines={1}>{g.awayStarter ?? '미정'}</PixelText>
                            <PixelText variant="caption" color={colors.textDim} style={styles.starterText} numberOfLines={1}>{g.homeStarter ?? '미정'}</PixelText>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    height: '75%',
    backgroundColor: '#FBF5E4',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.sm,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  scroll: { flex: 1 },
  empty: { textAlign: 'center', marginTop: spacing.lg },
  dateGroup: { marginBottom: spacing.md },
  dateLabelRow: { marginBottom: spacing.xs },
  dateLabel: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: border.radius,
  },
  gameRow: {
    paddingVertical: spacing.xs,
    borderBottomWidth: 1, borderBottomColor: colors.surfaceAlt,
    borderLeftWidth: 3, borderLeftColor: 'transparent',
  },
  myTeamRow: { backgroundColor: colors.goldSoft, borderLeftColor: colors.gold },
  gameRowInner: { paddingHorizontal: spacing.sm, gap: 2 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  starterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  teamNameText: { flex: 1, textAlign: 'center' },
  starterText: { flex: 1, textAlign: 'center' },
  vs: { width: 20, textAlign: 'center' },
});
