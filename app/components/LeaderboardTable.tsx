// 예측 리그 랭킹 표. 구단 순위표(Standings)와 동일한 톤:
//  - 테두리 컨테이너 + 행마다 상단 가로선으로 구분
//  - 내 행은 팀색 연배경(teamColorLight) + 좌측 팀색 바 (순위표 '내 팀 강조'와 일치)
// myRowPinned: 상위 N 밖일 때 표 하단에 '내 순위'를 고정으로 덧붙임(방향 B).
import { View, StyleSheet } from 'react-native';
import PixelText from './PixelText';
import { border, colors, spacing } from '../theme';
import { teamColorLight } from '../utils';

export interface LbRow {
  rank: number;
  nickname: string;
  isMe: boolean;
  right: string;
  sub?: string;
}

function RowView({ row, accent, first }: { row: LbRow; accent: string; first: boolean }) {
  const mine = row.isMe;
  return (
    <View
      style={[
        styles.block,
        first && styles.blockFirst,
        mine && { backgroundColor: teamColorLight(accent), borderLeftColor: accent },
      ]}
    >
      <PixelText variant="caption" color={colors.textDim} style={styles.rankCol}>{row.rank}</PixelText>
      <View style={styles.nameCol}>
        <PixelText variant="body" color={mine ? accent : colors.text} numberOfLines={1}>{row.nickname}</PixelText>
        {row.sub && <PixelText variant="caption" color={colors.textDim}>{row.sub}</PixelText>}
      </View>
      <PixelText variant="body" color={colors.text}>{row.right}</PixelText>
    </View>
  );
}

export default function LeaderboardTable({ rows, accent, myRowPinned }: {
  rows: LbRow[];
  accent: string;
  myRowPinned?: LbRow | null;
}) {
  return (
    <View style={styles.table}>
      {rows.map((r, i) => (
        <RowView key={`${r.nickname}-${r.rank}-${i}`} row={r} accent={accent} first={i === 0} />
      ))}
      {myRowPinned && (
        <>
          <View style={styles.gapRow}>
            <PixelText variant="caption" color={colors.textDim}>⋯</PixelText>
          </View>
          <RowView row={myRowPinned} accent={accent} first={false} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    borderWidth: 1, borderColor: 'rgba(45,36,20,0.30)', borderRadius: border.radius,
    backgroundColor: colors.surface, overflow: 'hidden',
  },
  block: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 7, paddingHorizontal: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
    borderLeftWidth: 4, borderLeftColor: 'transparent',   // 4px 좌측 바(내 행만 팀색) — 행 간 정렬 유지
  },
  blockFirst: { borderTopWidth: 0 },   // 컨테이너 상단 테두리와 겹치지 않게
  gapRow: { alignItems: 'center', paddingVertical: 1, borderTopWidth: 1, borderTopColor: colors.border },
  rankCol: { width: 24, textAlign: 'center' },
  nameCol: { flex: 1 },
});
