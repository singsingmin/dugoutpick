// 오늘경기 탭 상단 원탭 출석 카드 — 라커룸까지 안 들어가도 메인에서 바로 출석(2026-07).
// 오늘 아직 안 받았을 때만 노출. 받으면 잠깐 '완료 +N' 보여준 뒤 사라짐.
import { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useScoreSkin, type ClaimResult } from '../context/ScoreSkin';
import { useOnline } from '../hooks/useOnline';
import { useTeamTheme } from '../context/TeamTheme';
import { ATTENDANCE_REWARD } from '../utils/attendance';
import PixelText from './PixelText';
import Panel from './Panel';
import AppIcon from './AppIcon';
import { colors, border, spacing } from '../theme';

const SHOW_RAW_ERR = __DEV__ || process.env.EXPO_PUBLIC_DEBUG_TOOLS === '1';

export default function AttendanceCard() {
  const { canClaimAttendance, attendanceStreak, claimAttendance } = useScoreSkin();
  const online = useOnline();
  const { accent } = useTeamTheme();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ClaimResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  if (hidden || (!canClaimAttendance && !done)) return null;

  const onClaim = async () => {
    if (busy || done) return;
    setError(null);
    if (!online) { setError('인터넷 연결 후 받을 수 있어요'); return; }
    setBusy(true);
    try {
      const r = await claimAttendance();
      if (r.claimed) {
        setDone(r);
        hideTimer.current = setTimeout(() => setHidden(true), 2500); // 완료 표시 후 사라짐
      }
    } catch (e) {
      setError(SHOW_RAW_ERR ? `오류: ${(e as Error).message}` : '처리 중 오류가 났어요. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Panel accentColor={accent} style={styles.card}>
        <View style={styles.left}>
          <AppIcon name="baseball" size={28} />
          <View style={styles.textCol}>
            {done ? (
              <>
                <PixelText variant="body" color={colors.text}>출석 완료! 🎉</PixelText>
                <PixelText variant="caption" color={colors.textDim}>
                  야구공 +{done.earned}{done.bonus > 0 ? ` (연속 보너스 +${done.bonus})` : ''} 획득
                </PixelText>
              </>
            ) : (
              <>
                <PixelText variant="body" color={colors.text}>오늘의 출석 보상</PixelText>
                <PixelText variant="caption" color={error ? colors.bad : colors.textDim}>
                  {error ?? `${attendanceStreak > 0 ? `연속 ${attendanceStreak}일 · ` : ''}탭 한 번으로 야구공 +${ATTENDANCE_REWARD}`}
                </PixelText>
              </>
            )}
          </View>
        </View>
        {done ? (
          <View style={[styles.btn, styles.btnDone]}>
            <PixelText variant="caption" color={colors.good}>✓ 완료</PixelText>
          </View>
        ) : (
          <Pressable
            onPress={onClaim}
            disabled={busy}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`오늘 출석 보상 야구공 ${ATTENDANCE_REWARD}개 받기`}
            style={[styles.btn, { backgroundColor: accent }, busy && styles.btnBusy]}
          >
            <PixelText variant="caption" color={colors.onGreen}>+{ATTENDANCE_REWARD} 받기</PixelText>
          </Pressable>
        )}
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  textCol: { flexShrink: 1 },
  btn: { borderRadius: border.radius, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, minWidth: 64, alignItems: 'center' },
  btnBusy: { opacity: 0.6 },
  btnDone: { backgroundColor: colors.surfaceAlt },
});
