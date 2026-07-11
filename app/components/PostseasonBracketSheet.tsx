// 포스트시즌 브래킷(스텝래더) 바텀시트. 시리즈 현황 카드 탭으로 열림. (docs/postseason-plan.md §5)
// KBO 가을야구는 대칭 토너먼트가 아닌 계단식: WC → 준PO → PO → KS(우승).
import { Modal, View, ScrollView, Pressable, StyleSheet } from 'react-native';
import type { BracketRound } from '../types';
import { loadTeams } from '../data/load';
import PixelText from './PixelText';
import AppIcon from './AppIcon';
import { border, colors, spacing } from '../theme';

const TEAMS = loadTeams().teams;
const nameOf = (code: string | null) => (code ? TEAMS.find((t) => t.code === code)?.name ?? code : '미정');
const colorOf = (code: string | null) => (code ? TEAMS.find((t) => t.code === code)?.color ?? colors.text : colors.textDim);

interface Props {
  visible: boolean;
  onClose: () => void;
  bracket: BracketRound[];
  myCode: string | null;
}

const STATUS_LABEL: Record<BracketRound['status'], string> = { upcoming: '예정', active: '진행 중', done: '종료' };

function TeamLine({ code, wins, isWinner, isMy, isKS }: { code: string | null; wins: number; isWinner: boolean; isMy: boolean; isKS: boolean }) {
  return (
    <View style={[styles.teamLine, isMy && styles.myLine]}>
      <View style={styles.teamNameWrap}>
        {isMy && <PixelText variant="caption" color={colors.accent}>★ </PixelText>}
        <PixelText variant="body" color={colorOf(code)} numberOfLines={1}>{nameOf(code)}</PixelText>
        {isWinner && (
          <PixelText variant="caption" color={colors.good} style={styles.advance}>
            {isKS ? ' 🏆 우승' : ' 진출'}
          </PixelText>
        )}
      </View>
      {code && <PixelText variant="title" color={isWinner ? colors.good : colors.text}>{wins}</PixelText>}
    </View>
  );
}

export default function PostseasonBracketSheet({ visible, onClose, bracket, myCode }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <AppIcon name="autumn" size={22} />
              <PixelText variant="title">가을야구 대진표</PixelText>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <PixelText variant="body" color={colors.textDim}>✕</PixelText>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {bracket.map((r, i) => {
              const isKS = r.round === 'KS';
              const highWin = r.winner === r.high;
              const lowWin = r.winner === r.low;
              return (
                <View key={r.round}>
                  <View style={[styles.roundBox, r.status === 'active' && styles.roundActive]}>
                    <View style={styles.roundHead}>
                      <PixelText variant="caption" color={colors.onGreen} style={[styles.roundLabel, { backgroundColor: r.status === 'active' ? colors.bad : colors.accent }]}>
                        {r.roundName}
                      </PixelText>
                      <PixelText variant="caption" color={colors.textDim}>{STATUS_LABEL[r.status]}</PixelText>
                    </View>
                    <TeamLine code={r.high} wins={r.score[r.high ?? ''] ?? 0} isWinner={highWin} isMy={!!myCode && r.high === myCode} isKS={isKS} />
                    <TeamLine code={r.low} wins={r.score[r.low ?? ''] ?? 0} isWinner={lowWin} isMy={!!myCode && r.low === myCode} isKS={isKS} />
                  </View>
                  {i < bracket.length - 1 && (
                    <View style={styles.connector}><PixelText variant="caption" color={colors.textDim}>▼ 승자 진출</PixelText></View>
                  )}
                </View>
              );
            })}
            <PixelText variant="caption" color={colors.textDim} style={styles.footnote}>
              4위·5위 와일드카드 → 준PO(3위) → PO(2위) → 한국시리즈(1위)
            </PixelText>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { height: '80%', backgroundColor: '#FBF5E4', borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: spacing.md, paddingBottom: spacing.xl },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  scroll: { flex: 1 },
  roundBox: {
    borderWidth: 1, borderColor: 'rgba(45,36,20,0.30)', borderRadius: border.radius,
    backgroundColor: colors.surface, padding: spacing.sm, gap: spacing.xs,
  },
  roundActive: { borderColor: colors.bad, borderWidth: 2 },
  roundHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  roundLabel: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: border.radius },
  teamLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: 4 },
  myLine: { backgroundColor: colors.surfaceAlt },
  teamNameWrap: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  advance: {},
  connector: { alignItems: 'center', paddingVertical: 2 },
  footnote: { textAlign: 'center', marginTop: spacing.md },
});
