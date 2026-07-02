// 야구공 내역 바텀시트 — 최근 30일 거래를 날짜와 함께 표시.
import { Modal, View, Pressable, ScrollView, StyleSheet } from 'react-native';
import PixelText from './PixelText';
import { type BaseballTx, kstDateLabel } from '../utils/attendance';
import { colors, spacing, border } from '../theme';

const DAY_MS = 86400 * 1000;

interface Props {
  visible: boolean;
  onClose: () => void;
  transactions: BaseballTx[];
  days?: number;   // 기본 30일
}

export default function TxHistorySheet({ visible, onClose, transactions, days = 30 }: Props) {
  const cutoff = Date.now() - days * DAY_MS;
  const list = transactions.filter((t) => new Date(t.createdAt).getTime() >= cutoff);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <PixelText variant="title">야구공 내역</PixelText>
            <Pressable onPress={onClose} hitSlop={8}>
              <PixelText variant="body" color={colors.textDim}>✕</PixelText>
            </Pressable>
          </View>
          <PixelText variant="caption" color={colors.textDim} style={styles.sub}>최근 {days}일</PixelText>
          {list.length === 0 ? (
            <PixelText variant="body" color={colors.textDim} style={styles.empty}>내역이 없어요</PixelText>
          ) : (
            <ScrollView style={styles.scroll}>
              {list.map((tx) => (
                <View key={tx.id} style={styles.row}>
                  <PixelText variant="caption" color={colors.textDim} style={styles.date}>{kstDateLabel(tx.createdAt)}</PixelText>
                  <PixelText variant="caption" color={colors.text} style={styles.label} numberOfLines={1}>{tx.label}</PixelText>
                  <PixelText variant="caption" color={tx.type === 'earn' ? colors.good : colors.bad}>
                    {tx.type === 'earn' ? '+' : '-'}{tx.amount}
                  </PixelText>
                </View>
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
    padding: spacing.md, paddingBottom: spacing.xl, maxHeight: '75%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sub: { marginBottom: spacing.sm },
  empty: { textAlign: 'center', marginVertical: spacing.xl },
  scroll: {},
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(45,36,20,0.12)',
  },
  date: { width: 62 },
  label: { flex: 1 },
});
