// 내 계정 상세 — 설정 메인의 "내 계정 ›"에서 진입. 소셜 연동/로그아웃 + 추천코드 입력.
import { useEffect, useState } from 'react';
import { View, Image, ScrollView, Modal, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/Auth';
import { useScoreSkin } from '../context/ScoreSkin';
import { fetchHasRedeemed, rpcRedeemReferralCode } from '../services/referrals';
import PixelText from '../components/PixelText';
import Panel from '../components/Panel';
import PixelButton from '../components/PixelButton';
import ScreenHeader from '../components/ScreenHeader';
import SectionLabel from '../components/SectionLabel';
import { border, colors, spacing } from '../theme';

export default function AccountDetail() {
  const navigation = useNavigation();
  const {
    userId, isProtected, email, authBusy, linkConflict,
    connectGoogle, recoverGoogle, signOut, clearLinkConflict,
  } = useAuth();
  const { baseballBalance, refreshAccount } = useScoreSkin();
  const [hasRedeemed, setHasRedeemed] = useState<boolean | null>(null);
  const [redeemInput, setRedeemInput] = useState('');
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (userId) fetchHasRedeemed().then((v) => { if (active) setHasRedeemed(v); }).catch(() => {});
    return () => { active = false; };
  }, [userId]);

  const submitRedeem = async () => {
    const code = redeemInput.trim();
    if (!code) return;
    setRedeemBusy(true);
    setRedeemMsg(null);
    try {
      const res = await rpcRedeemReferralCode(code);
      if (res.success) {
        setHasRedeemed(true);
        setRedeemMsg(`추천코드 적용! 야구공 +${res.reward} 받았어요`);
        await refreshAccount();
      } else {
        setRedeemMsg(
          res.reason === 'self_referral' ? '내 코드는 입력할 수 없어요'
            : res.reason === 'already_redeemed' ? '이미 추천코드를 입력했어요'
            : res.reason === 'not_protected' ? '구글 계정 연동 후 입력할 수 있어요'
            : res.reason === 'too_many_attempts' ? '오늘 시도가 너무 많아요. 내일 다시 시도해 주세요'
            : '존재하지 않는 코드예요'
        );
      }
    } catch {
      setRedeemMsg('오류가 발생했어요. 다시 시도해 주세요.');
    } finally {
      setRedeemBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Image source={require('../assets/stadium-bg.webp')} style={styles.bgImage} resizeMode="cover" />
      <View style={styles.bgOverlay} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="내 계정" leftIcon="back" onLeftPress={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.section}>
            <SectionLabel label="소셜 계정" />
            <Panel>
              <PixelText variant="body">
                {isProtected ? '구글 계정 연결됨 ✓' : '구글 계정 연결하기'}
              </PixelText>
              <PixelText variant="caption" color={colors.textDim} style={styles.value}>
                {isProtected
                  ? `${email ? `${email} · ` : ''}기기를 바꿔도 데이터가 유지돼요`
                  : '연결하면 기기를 바꿔도 야구공·스킨이 그대로 유지돼요'}
              </PixelText>
              {isProtected ? (
                <PixelButton label="로그아웃" accentColor={colors.bad} onPress={() => { void signOut(); }} style={styles.btn} />
              ) : (
                <PixelButton
                  label={authBusy ? '진행 중…' : '구글 계정으로 연결하기'}
                  accentColor={colors.good}
                  onPress={() => { void connectGoogle(); }}
                  disabled={authBusy}
                  style={styles.btn}
                />
              )}
            </Panel>
          </View>

          <View style={styles.section}>
            <SectionLabel label="추천코드 입력" />
            <Panel>
              {hasRedeemed === true ? (
                <PixelText variant="body" color={colors.textDim}>추천코드를 이미 입력했어요</PixelText>
              ) : !isProtected ? (
                <PixelText variant="body" color={colors.textDim}>구글 계정 연동 후 친구의 추천코드를 입력할 수 있어요</PixelText>
              ) : (
                <>
                  <PixelText variant="caption" color={colors.textDim}>친구의 추천코드를 입력하면 야구공 10개를 받아요 (평생 1회)</PixelText>
                  <TextInput
                    style={styles.redeemInput}
                    value={redeemInput}
                    onChangeText={(t) => setRedeemInput(t.toUpperCase())}
                    placeholder="친구의 추천코드"
                    placeholderTextColor={colors.textDim}
                    autoCapitalize="characters"
                    maxLength={6}
                  />
                  <PixelButton
                    label={redeemBusy ? '처리 중…' : '입력하기'}
                    onPress={() => { void submitRedeem(); }}
                    disabled={redeemBusy || redeemInput.trim().length === 0}
                    style={styles.btn}
                  />
                  {redeemMsg && (
                    <PixelText variant="caption" color={colors.textDim} style={styles.value}>{redeemMsg}</PixelText>
                  )}
                </>
              )}
            </Panel>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* 충돌 = 이미 쓰던 구글 → 그 계정 불러오기(복구) 제안 */}
      <Modal visible={linkConflict} transparent animationType="fade" onRequestClose={clearLinkConflict}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <PixelText variant="title" color={colors.text}>이미 만든 계정이 있어요</PixelText>
            <PixelText variant="body" color={colors.textDim} style={styles.modalMsg}>
              이 구글 계정으로 만든 기록이 이미 있어요. 그 계정을 불러올까요?{'\n'}
              지금 이 기기의 진행상황
              {baseballBalance > 0 ? ` (야구공 ${baseballBalance}개 등)` : ''}은 불러온 계정으로 대체돼요.
            </PixelText>
            <View style={styles.modalRow}>
              <PixelButton label="취소" accentColor={colors.textDim} onPress={clearLinkConflict} style={styles.modalBtn} />
              <PixelButton label="불러오기" onPress={() => { clearLinkConflict(); void recoverGoogle(); }} style={styles.modalBtn} />
            </View>
            <PixelText variant="caption" color={colors.textDim} style={styles.modalHint}>
              다른 구글 계정을 쓰려면 취소하고 다시 연결하세요.
            </PixelText>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bgImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  bgOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(243,233,206,0.35)' },
  safe: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing.md },
  section: { marginBottom: spacing.lg },
  value: { marginTop: spacing.xs },
  btn: { marginTop: spacing.sm },
  redeemInput: {
    marginTop: spacing.xs, borderWidth: 1, borderColor: colors.border, borderRadius: border.radius,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, color: colors.text,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  modalCard: {
    width: '100%', maxWidth: 340, backgroundColor: colors.surface,
    borderWidth: border.width, borderColor: colors.border, borderRadius: border.radius,
    padding: spacing.lg, gap: spacing.sm,
  },
  modalMsg: { marginTop: spacing.xs },
  modalRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  modalBtn: { flex: 1 },
  modalHint: { marginTop: spacing.xs },
});
