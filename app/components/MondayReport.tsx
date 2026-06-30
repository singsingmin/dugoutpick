// 월요 리포트: 지난주 리뷰(10팀 주간 성적표, 내 팀 최상단+순위순) + 이번주 예측(주목 경기 + 내 팀 일정).
import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import type { ReportData } from '../types';
import { loadReport, loadTeams } from '../data/load';
import { getCheerTeam } from '../data/team';
import PixelText from './PixelText';
import Panel from './Panel';
import TeamName from './TeamName';
import ScoreSkinRenderer from './ScoreSkinRenderer';
import SectionLabel from './SectionLabel';
import { shortDateDow, dateRangeDow, teamColorLight } from '../utils';
import { colors, spacing } from '../theme';

const TEAMS = loadTeams().teams;
const teamName = (code: string) => TEAMS.find((t) => t.code === code)?.name ?? code;
const getTeamColor = (code: string) => TEAMS.find((t) => t.code === code)?.color ?? '#888888';

export default function MondayReport() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [cheer, setCheer] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [r, c] = await Promise.all([loadReport(), getCheerTeam()]);
      if (!active) return;
      setReport(r);
      setCheer(c);
    })();
    return () => { active = false; };
  }, []);

  if (!report) return <View style={styles.center} />;

  // 지난주 팀 성적: 현재 순위 오름차순(내 팀은 행 강조로 구분)
  const teamRows = Object.entries(report.lastWeek.team)
    .map(([code, r]) => ({ code, ...r }))
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const myThis = cheer ? report.thisWeek.team[cheer] : undefined;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <PixelText variant="title" color={colors.text} style={styles.intro}>오늘은 경기가 없어요{'\n'}한 주를 정리해볼까요?</PixelText>

      {/* 지난주 리뷰 — 팀별 주간 성적표 */}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <SectionLabel icon="flag" label="지난주 성적" />
          <PixelText variant="caption" color={colors.textDim}>승 / 무 / 패</PixelText>
        </View>
        <Panel>
          {teamRows.map((r) => {
            const mine = r.code === cheer;
            return (
              <View key={r.code} style={[styles.teamBlock, mine && styles.teamRowMine, mine && { backgroundColor: teamColorLight(getTeamColor(r.code)) }]}>
                <View style={styles.teamRow}>
                  <PixelText variant="caption" color={colors.textDim} style={styles.rankCol}>{r.rank ? `${r.rank}위` : '-'}</PixelText>
                  <View style={styles.nameCol}><TeamName code={r.code} variant="body" /></View>
                  {mine && <PixelText variant="caption" color={colors.accent} style={styles.meTag}>내 팀</PixelText>}
                  <PixelText variant="body" color={mine ? colors.text : colors.textDim} style={styles.recCol} numberOfLines={1}>{r.w}/{r.d}/{r.l}</PixelText>
                </View>
                {r.note ? (
                  <PixelText variant="caption" color={mine ? colors.accent : colors.textDim} style={styles.noteLine}>{r.note}</PixelText>
                ) : null}
              </View>
            );
          })}
        </Panel>
      </View>

      {/* 이번주 예측 */}
      <View style={styles.section}>
        <SectionLabel icon="sparkles" label="이번주 예측" />

        {myThis && cheer && (
          <Panel accentColor={colors.accent} style={styles.myTeam}>
            <View style={styles.row}>
              <TeamName code={cheer} variant="body" />
              <PixelText variant="caption" color={colors.textDim}>이번주 {myThis.length}경기</PixelText>
            </View>
            {myThis.map((m, i) => {
              const opp = m.away === cheer ? m.home : m.away;
              const homeAway = m.home === cheer ? '홈' : '원정';
              return (
                <PixelText key={i} variant="caption" color={colors.textDim}>
                  {shortDateDow(m.date)} vs {teamName(opp)} ({homeAway})
                </PixelText>
              );
            })}
          </Panel>
        )}

        <PixelText variant="caption" color={colors.accent} style={styles.subLabel}>주목 경기 (예측)</PixelText>
        {report.thisWeek.top.length > 0 ? (
          report.thisWeek.top.map((g, i) => {
            const dateText = g.dateStart && g.dateEnd ? dateRangeDow(g.dateStart, g.dateEnd) : g.dateStart ? shortDateDow(g.dateStart) : '';
            return (
            <Panel key={i} style={styles.gameCard}>
              <View style={styles.gameTop}>
                <View style={styles.gameLeft}>
                  <View style={styles.matchup}>
                    <TeamName code={g.away} variant="body" />
                    <PixelText variant="caption" color={colors.textDim}>vs</PixelText>
                    <TeamName code={g.home} variant="body" />
                    {dateText ? <PixelText variant="caption" color={colors.textDim}>{dateText}</PixelText> : null}
                  </View>
                  {g.reason ? <PixelText variant="caption" color={colors.textDim} style={styles.reason}>{g.reason}</PixelText> : null}
                </View>
                <ScoreSkinRenderer score={g.pred} variant="compact" teamColor={getTeamColor(g.home)} />
              </View>
            </Panel>
          );
          })
        ) : (
          <Panel><PixelText variant="body" color={colors.textDim}>이번주 일정이 없어요</PixelText></Panel>
        )}
        <PixelText variant="caption" color={colors.textDim} style={styles.note}>※ 이번주 예측은 선발 미정이라 근사치예요</PixelText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md },
  intro: { marginBottom: spacing.md, lineHeight: 26 },
  section: { marginBottom: spacing.lg },
  // 지난주 성적표
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  teamBlock: { paddingVertical: 5 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  teamRowMine: { marginHorizontal: -spacing.sm, paddingHorizontal: spacing.sm, borderRadius: 4 },
  noteLine: { marginTop: 3, marginLeft: 30 + spacing.sm, lineHeight: 14 },
  rankCol: { width: 30 },
  nameCol: { flex: 1 },
  meTag: { },
  recCol: { width: 58, textAlign: 'right' },
  // 이번주
  myTeam: { gap: spacing.xs, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  subLabel: { marginTop: spacing.sm, marginBottom: spacing.xs },
  gameCard: { marginBottom: spacing.sm },
  gameTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  gameLeft: { flex: 1, gap: spacing.xs },
  matchup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  reason: {},
  note: { marginTop: spacing.sm },
});
