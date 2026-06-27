// 투수 한 줄. 예정/경기중: 원정선발 [sep] 홈선발 (팀명 열과 정렬 맞춤). 종료: 승 X · 패 Y (· 세 Z).
// 양쪽 다 미등록이면 줄 자체를 숨겨(null) 빈 줄이 생기지 않게 한다. 한쪽만 미등록이면 '미정'.
import { View, StyleSheet } from 'react-native';
import type { ViewStyle, StyleProp } from 'react-native';
import type { Game } from '../types';
import PixelText from './PixelText';
import { colors, spacing } from '../theme';

export default function StarterLine({ game, style }: { game: Game; style?: StyleProp<ViewStyle> }) {
  // 종료 경기: 선발 대신 승/패(/세이브) 투수. 무승부면 win/lose 없음 → 선발 표기로 폴백.
  const d = game.decision;
  if (game.status === 'FINAL' && d && (d.win || d.lose)) {
    const parts: string[] = [];
    if (d.win) parts.push(`승 ${d.win}`);
    if (d.lose) parts.push(`패 ${d.lose}`);
    if (d.save) parts.push(`세 ${d.save}`);
    return (
      <View style={[styles.row, styles.center, style]}>
        <PixelText variant="caption" color={colors.textDim} numberOfLines={1}>
          {parts.join(' · ')}
        </PixelText>
      </View>
    );
  }

  const a = game.away.starter?.name;
  const h = game.home.starter?.name;
  if (!a && !h) return null;
  // sep 너비 = GameCard matchup의 'vs' 텍스트(~16px) + marginHorizontal(4*2) = 24px로 팀명 열 정렬 맞춤
  return (
    <View style={[styles.row, style]}>
      <PixelText variant="caption" color={colors.textDim} style={styles.name} numberOfLines={1}>{a ?? '미정'}</PixelText>
      <View style={styles.sep} />
      <PixelText variant="caption" color={colors.textDim} style={styles.name} numberOfLines={1}>{h ?? '미정'}</PixelText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  center: { justifyContent: 'center' },
  name: { flex: 1, textAlign: 'center' },
  sep: { width: 24 },
});
