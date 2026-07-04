// 야구공 센터 — 잔액·출석 보상·연속 출석 보드·최근 내역. (광고 버튼은 추후 확장 슬롯)
import { useEffect, useRef, useState } from 'react';
import { View, Image, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTeamTheme } from '../context/TeamTheme';
import { useScoreSkin } from '../context/ScoreSkin';
import { useOnline } from '../hooks/useOnline';
import { txDisplayLabel } from '../utils/scoreSkinConfig';
import { ATTENDANCE_REWARD, ATTENDANCE_BONUS, ATTENDANCE_CYCLE, isKstToday, kstDateLabel } from '../utils/attendance';
import PixelText from '../components/PixelText';
import Panel from '../components/Panel';
import PixelButton from '../components/PixelButton';
import ScreenHeader from '../components/ScreenHeader';
import SectionLabel from '../components/SectionLabel';
import AppIcon from '../components/AppIcon';
import TxHistorySheet from '../components/TxHistorySheet';
import { border, colors, spacing } from '../theme';

export default function BaseballCenter() {
  const navigation = useNavigation();
  const { accent } = useTeamTheme();
  const {
    baseballBalance, canClaimAttendance, attendanceStreak, cyclePosition,
    transactions, claimAttendance,
  } = useScoreSkin();
  const online = useOnline();
  const [toast, setToast] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 오늘(KST) 받은 출석 보상 합계(기본+보너스) — 완료 카드 표시용. 재시작 후에도 내역에서 도출.
  const todayEarned = transactions
    .filter((t) => (t.reason === 'attendance' || t.reason === 'attendance_bonus') && isKstToday(t.createdAt))
    .reduce((sum, t) => sum + t.amount, 0);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  };

  const onClaim = async () => {
    if (!online) { showToast('출석 보상은 인터넷 연결 후 받을 수 있어요'); return; }
    const r = await claimAttendance();
    if (r.claimed) {
      showToast(r.bonus > 0 ? `출석 완료! 야구공 ${r.earned}개 획득 (보너스 +${r.bonus})` : `출석 완료! 야구공 ${r.earned}개 획득`);
    }
  };

  const recent = transactions.slice(0, 5);

  return (
    <View style={styles.root}>
      <Image source={require('../assets/stadium-bg.webp')} style={styles.bgImage} resizeMode="cover" />
      <View style={styles.bgOverlay} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="야구공 센터" leftIcon="back" onLeftPress={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.content}>
          {/* 현재 보유 */}
          <View style={styles.balanceCard}>
            <AppIcon name="baseball" size={34} />
            <View style={styles.balanceText}>
              <PixelText variant="caption" color={colors.textDim}>현재 보유</PixelText>
              <PixelText variant="hero" color={colors.text}>{baseballBalance}</PixelText>
            </View>
          </View>

          {/* 오늘 출석 보상 */}
          <View style={styles.section}>
            <SectionLabel icon="star" label="오늘 출석 보상" />
            <Panel>
              {/* 1) 메인 상태 / 보상 결과 */}
              {canClaimAttendance ? (
                <>
                  <PixelText variant="body" color={colors.text}>매일 출석하고 야구공 {ATTENDANCE_REWARD}개를 받아보세요</PixelText>
                  <PixelButton label={`야구공 ${ATTENDANCE_REWARD}개 받기`} onPress={onClaim} disabled={!online} style={styles.claimBtn} />
                  {!online && (
                    <PixelText variant="caption" color={colors.textDim} style={styles.subInfo}>오프라인 상태예요 · 연결 후 받을 수 있어요</PixelText>
                  )}
                </>
              ) : (
                <>
                  <PixelText variant="title" color={accent}>오늘 출석 완료 ✓</PixelText>
                  {todayEarned > 0 && (
                    <PixelText variant="body" color={colors.text} style={styles.rewardLine}>야구공 {todayEarned}개 받았어요</PixelText>
                  )}
                </>
              )}

              {/* 2) 보조 정보 — 연속 출석(강조 칩) + 내일 안내 */}
              {attendanceStreak > 0 && (
                <View style={styles.streakChip}>
                  <AppIcon name="fire" size={16} />
                  <PixelText variant="body" color={accent}>{attendanceStreak}일 연속 출석 중</PixelText>
                </View>
              )}
              {!canClaimAttendance && (
                <PixelText variant="caption" color={colors.textDim} style={styles.subInfo}>내일 다시 받을 수 있어요</PixelText>
              )}
            </Panel>
          </View>

          {/* 7일 출석 보드 */}
          <View style={styles.section}>
            <SectionLabel icon="fire" label="7일 출석 보드" />
            <Panel>
              <View style={styles.board}>
                {Array.from({ length: ATTENDANCE_CYCLE }, (_, i) => i + 1).map((day) => {
                  const filled = day <= cyclePosition;
                  const isBonus = day === ATTENDANCE_CYCLE;
                  return (
                    <View
                      key={day}
                      style={[
                        styles.dayCell,
                        isBonus && styles.dayBonus,
                        filled && { backgroundColor: isBonus ? colors.gold : accent, borderColor: colors.border },
                      ]}
                    >
                      {filled ? (
                        <AppIcon name="baseball" size={18} />
                      ) : (
                        <PixelText variant="caption" color={colors.textDim}>{day}</PixelText>
                      )}
                      {isBonus && (
                        <PixelText variant="caption" color={filled ? colors.onGold : colors.textDim} style={styles.bonusTag}>
                          +{ATTENDANCE_BONUS}
                        </PixelText>
                      )}
                    </View>
                  );
                })}
              </View>
              <PixelText variant="caption" color={colors.textDim} style={styles.line}>
                7일 연속 출석 시 보너스 야구공 {ATTENDANCE_BONUS}개!
              </PixelText>
            </Panel>
          </View>

          {/* 최근 야구공 내역 */}
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <SectionLabel icon="chart" label="최근 야구공 내역" />
              {transactions.length > 0 && (
                <Pressable onPress={() => setHistoryOpen(true)} hitSlop={8} style={styles.moreBtn}>
                  <PixelText variant="caption" color={accent}>전체 내역 ›</PixelText>
                </Pressable>
              )}
            </View>
            <Panel>
              {recent.length === 0 ? (
                <PixelText variant="body" color={colors.textDim}>내역이 없어요</PixelText>
              ) : (
                recent.map((tx) => (
                  <View key={tx.id} style={styles.txRow}>
                    <PixelText variant="caption" color={colors.textDim} style={styles.txDate}>{kstDateLabel(tx.createdAt)}</PixelText>
                    <PixelText variant="caption" color={colors.text} style={styles.txLabel} numberOfLines={1}>{txDisplayLabel(tx.reason, tx.relatedSkinId, tx.label)}</PixelText>
                    <PixelText variant="caption" color={tx.type === 'earn' ? colors.good : colors.bad}>
                      {tx.type === 'earn' ? '+' : '-'}{tx.amount}
                    </PixelText>
                  </View>
                ))
              )}
            </Panel>
          </View>
        </ScrollView>
      </SafeAreaView>

      <TxHistorySheet visible={historyOpen} onClose={() => setHistoryOpen(false)} transactions={transactions} days={30} />

      {toast && (
        <View style={styles.toastWrap} pointerEvents="none">
          <View style={styles.toast}><PixelText variant="caption" color="#fff">{toast}</PixelText></View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bgImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  bgOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(243,233,206,0.35)' },
  safe: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing.md },

  balanceCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(45,36,20,0.30)',
    borderRadius: border.radius, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.lg,
  },
  balanceText: { gap: 2 },

  section: { marginBottom: spacing.lg },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  line: { marginBottom: spacing.sm },

  // 출석 카드 3단
  claimBtn: { marginTop: spacing.sm },
  rewardLine: { marginTop: 2 },
  streakChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    marginTop: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 3,
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: 999,
  },
  subInfo: { marginTop: spacing.xs },

  board: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  dayCell: {
    width: 38, height: 44, borderRadius: border.radius, borderWidth: 1, borderColor: 'rgba(45,36,20,0.25)',
    backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', gap: 1,
  },
  dayBonus: { borderColor: colors.gold, borderWidth: 1.5 },
  bonusTag: { fontSize: 8, lineHeight: 10 },

  txRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 3 },
  txDate: { width: 62 },
  txLabel: { flex: 1 },
  moreBtn: { paddingVertical: 2, paddingLeft: spacing.sm },

  toastWrap: { position: 'absolute', left: 0, right: 0, bottom: 40, alignItems: 'center' },
  toast: { backgroundColor: 'rgba(30,24,12,0.92)', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 999 },
});
