// 선발 타순 바텀시트. GameDetail에서 호출. lineup.confirmed=false 시 추정 안내 표시.
import { Modal, View, Pressable, StyleSheet } from 'react-native';
import type { Game, LineupPlayer } from '../types';
import PixelText from './PixelText';
import { colors, spacing } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  game: Game;
}

export default function LineupSheet({ visible, onClose, game }: Props) {
  const { lineup } = game;
  if (!lineup) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <PixelText variant="title">선발 타순</PixelText>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="닫기">
              <PixelText variant="body" color={colors.textDim}>✕</PixelText>
            </Pressable>
          </View>
          {lineup.confirmed ? (
            <View style={styles.table}>
              <LineupCol title={game.away.name} players={lineup.away} />
              <View style={styles.divider} />
              <LineupCol title={game.home.name} players={lineup.home} />
            </View>
          ) : (
            <PixelText variant="body" color={colors.textDim} style={styles.pending}>
              선발 타순이 확정되면 업데이트돼요
            </PixelText>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function LineupCol({ title, players }: { title: string; players: LineupPlayer[] }) {
  return (
    <View style={styles.col}>
      <PixelText variant="body" style={styles.colTitle}>{title}</PixelText>
      {players.map((p) => (
        <View key={p.order} style={styles.playerRow}>
          <PixelText variant="caption" color={colors.textDim} style={styles.orderNum}>{p.order}</PixelText>
          <PixelText variant="caption" style={styles.playerName} numberOfLines={1}>{p.name}</PixelText>
          <PixelText variant="caption" color={colors.textDim} style={styles.pos} numberOfLines={1}>{p.pos}</PixelText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.sm,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  notice: { marginBottom: spacing.sm },
  pending: { textAlign: 'center', marginVertical: spacing.xl },
  table: { flexDirection: 'row', gap: spacing.sm },
  divider: { width: 1, backgroundColor: colors.border },
  col: { flex: 1, gap: spacing.xs },
  colTitle: { textAlign: 'center', marginBottom: spacing.xs },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  orderNum: { width: 14, textAlign: 'center' },
  playerName: { flex: 1 },
  pos: { width: 54, textAlign: 'right' },
});
