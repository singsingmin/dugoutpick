// 포스트시즌 시리즈 현황 카드 — 오늘경기 탭 상단(예측카드 위). (docs/postseason-plan.md §2)
// PO 기간엔 하루 1경기라 이 카드 + 그 경기 카드가 사실상 히어로.
import { View, Pressable, StyleSheet } from 'react-native';
import type { PostseasonSeriesContext } from '../types';
import PixelText from './PixelText';
import Panel from './Panel';
import TeamBadge from './TeamBadge';
import AppIcon from './AppIcon';
import { colors, spacing } from '../theme';

interface Props {
  ctx: PostseasonSeriesContext;
  onPressBracket?: () => void; // 있으면 카드 탭 시 브래킷 바텀시트 오픈 + '대진표 ▾' 힌트 노출
}

export default function SeriesStatusCard({ ctx, onPressBracket }: Props) {
  const { high, low, roundName, gameNo, seriesScore, matchpoint, elimination, isFinalGame } = ctx;
  const sHigh = seriesScore[high] ?? 0;
  const sLow = seriesScore[low] ?? 0;
  const opener = sHigh === 0 && sLow === 0;
  // 긴장 국면(불꽃 아이콘): 최종전 · 매치포인트 · 벼랑끝
  const hot = isFinalGame || matchpoint[high] || matchpoint[low] || elimination[high] || elimination[low];

  const inner = (
    <Panel accentColor={colors.gold} style={styles.card}>
      {/* 라운드명 + 차전 (+ 대진표 힌트) */}
      <View style={styles.headRow}>
        <AppIcon name="autumn" size={20} />
        <PixelText variant="title" color={colors.accent}>{roundName} · {gameNo}차전</PixelText>
        {onPressBracket && (
          <PixelText variant="caption" color={colors.textDim} style={styles.bracketHint}>대진표 ▾</PixelText>
        )}
      </View>

      {/* 시리즈 스코어 (상위시드 좌, 하위시드 우) */}
      <View style={styles.scoreRow}>
        <TeamBadge code={high} size="sm" />
        {opener ? (
          <PixelText variant="body" color={colors.textDim} style={styles.opener}>시리즈 개막</PixelText>
        ) : (
          <View style={styles.scoreMid}>
            <PixelText variant="hero" color={colors.text}>{sHigh}</PixelText>
            <PixelText variant="title" color={colors.textDim} style={styles.dash}>─</PixelText>
            <PixelText variant="hero" color={colors.text}>{sLow}</PixelText>
          </View>
        )}
        <TeamBadge code={low} size="sm" />
      </View>

      {/* 맥락 한 줄 */}
      <View style={styles.ctxRow}>
        {hot && <AppIcon name="fire" size={16} />}
        <PixelText variant="body" color={hot ? colors.bad : colors.textDim} style={styles.ctxText}>
          {ctx.contextLine}
        </PixelText>
      </View>
    </Panel>
  );

  return onPressBracket ? <Pressable onPress={onPressBracket}>{inner}</Pressable> : inner;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bracketHint: { marginLeft: 'auto' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm },
  scoreMid: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dash: { marginTop: 2 },
  opener: {},
  ctxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  ctxText: { flexShrink: 1 },
});
