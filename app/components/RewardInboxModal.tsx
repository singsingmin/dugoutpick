// 보상 도착 모달 — 앱 진입 시 미확인 reward_events가 있으면 표시(P1).
import { Modal, View, StyleSheet } from 'react-native';
import PixelText from './PixelText';
import PixelButton from './PixelButton';
import AppIcon from './AppIcon';
import { rewardEventMessage, type RewardEvent } from '../services/rewards';
import { border, colors, spacing } from '../theme';

export default function RewardInboxModal({ events, onClose }: { events: RewardEvent[]; onClose: () => void }) {
  if (events.length === 0) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.head}>
            <AppIcon name="baseball" size={22} />
            <PixelText variant="title" color={colors.text}>보상 도착!</PixelText>
          </View>
          <View style={styles.list}>
            {events.map((e) => {
              const m = rewardEventMessage(e);
              return (
                <View key={e.id} style={styles.row}>
                  <PixelText variant="body" color={colors.text} style={styles.rowTitle} numberOfLines={2}>{m.title}</PixelText>
                  {!!m.detail && <PixelText variant="body" color={colors.accent}>{m.detail}</PixelText>}
                </View>
              );
            })}
          </View>
          <PixelButton label="확인" onPress={onClose} style={styles.btn} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: {
    width: '100%', maxWidth: 340, backgroundColor: colors.surface,
    borderWidth: border.width, borderColor: colors.border, borderRadius: border.radius,
    padding: spacing.lg, gap: spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center' },
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm,
    paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.surfaceAlt,
  },
  rowTitle: { flex: 1 },
  btn: { marginTop: spacing.xs },
});
