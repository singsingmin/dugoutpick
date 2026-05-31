// 경기 상태 칩: 경기전 / 경기중 / 종료 / (우천)취소
import { View, StyleSheet } from 'react-native';
import PixelText from './PixelText';
import type { Game } from '../types';
import { border, colors } from '../theme';

const LIVE_RED = '#E03131';

function info(game: Game): { label: string; color: string } {
  switch (game.status) {
    case 'LIVE': return { label: '경기중', color: LIVE_RED };
    case 'FINAL': return { label: '종료', color: colors.textDim };
    case 'CANCELED': return { label: game.cancelReason || '취소', color: colors.bad };
    default: return { label: '경기전', color: colors.accent };
  }
}

export default function StatusChip({ game }: { game: Game }) {
  const { label, color } = info(game);
  return (
    <View style={[styles.chip, { borderColor: color }]}>
      <PixelText variant="caption" color={color}>{label}</PixelText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
});
