// 계정(구글) 연결 화면 (Phase 3 Stage 4) — phase3-account-design.md §2 F4~F6.
// 단일 진입 "구글 계정 연결하기". 앱이 연결/복구를 자동 분기(내부: linkIdentity vs signInWithOAuth):
// 새 구글이면 연결, 이미 쓰던 구글이면 충돌 감지 → "불러오기"(복구) 제안 모달. OAuth 완료는 비동기.
import { View, ScrollView, Image, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/Auth';
import { useScoreSkin } from '../context/ScoreSkin';
import PixelText from '../components/PixelText';
import Panel from '../components/Panel';
import PixelButton from '../components/PixelButton';
import ScreenHeader from '../components/ScreenHeader';
import SectionLabel from '../components/SectionLabel';
import AppIcon from '../components/AppIcon';
import { colors, spacing, border } from '../theme';

export default function AccountProtect() {
  const navigation = useNavigation();
  const {
    isProtected, email, authBusy, authError, linkConflict,
    connectGoogle, recoverGoogle, clearLinkConflict,
  } = useAuth();
  const { baseballBalance } = useScoreSkin();

  const onRecover = async () => {
    clearLinkConflict();
    await recoverGoogle();
  };

  return (
    <View style={styles.root}>
      <Image source={require('../assets/stadium-bg.webp')} style={styles.bgImage} resizeMode="cover" />
      <View style={styles.bgOverlay} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="구글 계정 연결" leftIcon="back" onLeftPress={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.content}>
          {isProtected ? (
            // ── 연결됨 ──────────────────────────────
            <View style={styles.section}>
              <SectionLabel icon="star" label="소셜 계정" />
              <Panel>
                <View style={styles.statusRow}>
                  <AppIcon name="star" size={22} />
                  <PixelText variant="title" color={colors.good}>구글 계정 연결됨 ✓</PixelText>
                </View>
                {email && (
                  <PixelText variant="caption" color={colors.textDim} style={styles.gap}>{email}</PixelText>
                )}
                <PixelText variant="body" color={colors.text} style={styles.gap}>
                  이제 앱을 지우거나 기기를 바꿔도 구글 로그인으로 야구공·스킨·출석을 그대로 이어갈 수 있어요.
                </PixelText>
              </Panel>
            </View>
          ) : (
            // ── 미연결(익명) ────────────────────────
            <View style={styles.section}>
              <SectionLabel icon="star" label="소셜 계정" />
              <Panel>
                <PixelText variant="body" color={colors.text}>
                  지금은 이 기기에만 저장돼 있어요. 앱을 지우면 야구공·스킨·출석이 모두 사라져요.
                </PixelText>
                <PixelText variant="caption" color={colors.textDim} style={styles.gap}>
                  구글 계정을 연결하면 데이터를 안전하게 보관하고, 기기를 바꿔도 그대로 이어갈 수 있어요.
                </PixelText>
                <PixelButton
                  label={authBusy ? '진행 중…' : '구글 계정으로 연결하기'}
                  onPress={() => { void connectGoogle(); }}
                  disabled={authBusy}
                  style={styles.actionBtn}
                />
                {authError && (
                  <PixelText variant="caption" color={colors.bad} style={styles.gap}>{authError}</PixelText>
                )}
              </Panel>
            </View>
          )}
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
              <PixelButton label="취소" accentColor={colors.surfaceAlt} onPress={clearLinkConflict} style={styles.modalBtn} />
              <PixelButton label="불러오기" onPress={() => { void onRecover(); }} style={styles.modalBtn} />
            </View>
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
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  gap: { marginTop: spacing.sm },
  actionBtn: { marginTop: spacing.md },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  modalCard: { backgroundColor: colors.bg, borderColor: colors.border, borderWidth: border.width, borderRadius: border.radius, padding: spacing.lg, width: '100%', maxWidth: 340 },
  modalMsg: { marginTop: spacing.md, lineHeight: 20 },
  modalRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  modalBtn: { flex: 1 },
});
