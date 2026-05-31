// 월요 리포트: 지난주 리뷰(명경기 실제꿀잼 + 내 팀 성적) + 이번주 예측(주목 경기 근사꿀잼 + 내 팀 일정).
import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import type { ReportData } from '../types';
import { loadReport, loadTeams } from '../data/load';
import { getCheerTeam } from '../data/team';
import PixelText from './PixelText';
import Panel from './Panel';
import TeamName from './TeamName';
import HonjamBadge from './HonjamBadge';
import SectionLabel from './SectionLabel';
import { shortDate } from '../utils';
import { colors, spacing } from '../theme';

const TEAMS = loadTeams().teams;
const teamName = (code: string) => TEAMS.find((t) => t.code === code)?.name ?? code;

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

  const myLast = cheer ? report.lastWeek.team[cheer] : undefined;
  const myThis = cheer ? report.thisWeek.team[cheer] : undefined;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <PixelText variant="caption" color={colors.textDim} style={styles.intro}>오늘은 경기가 없어요 · 한 주를 정리해볼까요?</PixelText>

      {/* 지난주 리뷰 */}
      <View style={styles.section}>
        <SectionLabel icon="🏁" label="지난주 리뷰" />
        {myLast && cheer && (
          <Panel accentColor={colors.accent} style={styles.myTeam}>
            <View style={styles.row}>
              <TeamName code={cheer} variant="body" />
              <PixelText variant="caption" color={colors.textDim}>지난주 성적</PixelText>
            </View>
            <PixelText variant="title" color={myLast.w >= myLast.l ? colors.good : colors.bad}>
              {myLast.w}승 {myLast.d}무 {myLast.l}패
            </PixelText>
          </Panel>
        )}
        <PixelText variant="caption" color={colors.accent} style={styles.subLabel}>이주의 명경기</PixelText>
        {report.lastWeek.top.length > 0 ? (
          report.lastWeek.top.map((g, i) => (
            <Panel key={i} style={styles.gameRow}>
              <View style={styles.matchup}>
                <TeamName code={g.away} variant="body" />
                <PixelText variant="body" color={colors.text}>{g.aScore} : {g.bScore}</PixelText>
                <TeamName code={g.home} variant="body" />
              </View>
              <View style={styles.right}>
                <PixelText variant="caption" color={colors.textDim}>{shortDate(g.date)}</PixelText>
                <HonjamBadge score={g.actual} size="sm" />
              </View>
            </Panel>
          ))
        ) : (
          <Panel><PixelText variant="body" color={colors.textDim}>지난주 경기 기록이 없어요</PixelText></Panel>
        )}
      </View>

      {/* 이번주 예측 */}
      <View style={styles.section}>
        <SectionLabel icon="🔮" label="이번주 예측" />
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
                  {shortDate(m.date)} vs {teamName(opp)} ({homeAway})
                </PixelText>
              );
            })}
          </Panel>
        )}
        <PixelText variant="caption" color={colors.accent} style={styles.subLabel}>주목 경기 (예측)</PixelText>
        {report.thisWeek.top.length > 0 ? (
          report.thisWeek.top.map((g, i) => (
            <Panel key={i} style={styles.gameRow}>
              <View style={styles.matchup}>
                <TeamName code={g.away} variant="body" />
                <PixelText variant="caption" color={colors.textDim}>vs</PixelText>
                <TeamName code={g.home} variant="body" />
              </View>
              <View style={styles.right}>
                <PixelText variant="caption" color={colors.textDim}>{shortDate(g.date)}</PixelText>
                <HonjamBadge score={g.pred} size="sm" />
              </View>
            </Panel>
          ))
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
  intro: { marginBottom: spacing.md },
  section: { marginBottom: spacing.lg },
  myTeam: { gap: spacing.xs, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  subLabel: { marginTop: spacing.sm, marginBottom: spacing.xs },
  gameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.sm },
  matchup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, flexWrap: 'wrap' },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  note: { marginTop: spacing.sm },
});
