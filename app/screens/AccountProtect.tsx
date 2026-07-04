// 계정 보호/복구 화면 (Phase 3 Stage 4) — phase3-account-design.md §2 F4~F6.
// 보호(linkIdentity): 익명 uid 유지·데이터 보존. 복구(signInWithOAuth): 서버 우선 전면 교체(손실 경고).
// OAuth 완료는 비동기(딥링크/detectSessionInUrl) → isProtected 전환으로 반영.
import { useState } from 'react';
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
  const { isProtected, email, authBusy, authError, protect, recover, clearAuthError } = useAuth();
  const { baseballBalance } = useScoreSkin();
  const [confirmRecover, setConfirmRecover] = useState(false);

  const onRecover = async () => {
    setConfirmRecover(false);
    await recover();
  };

  return (
    <View style={styles.root}>
      <Image source={require('../assets/stadium-bg.webp')} style={styles.bgImage} resizeMode="cover" />
      <View style={styles.bgOverlay} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="계정 보호" leftIcon="back" onLeftPress={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.content}>
          {isProtected ? (
            // ── 보호됨 상태 ──────────────────────────────
            <View style={styles.section}>
              <SectionLabel icon="star" label="계정 보호됨" />
              <Panel>
                <View style={styles.statusRow}>
                  <AppIcon name="star" size={22} />
                  <PixelText variant="title" color={colors.good}>보호 완료 ✓</PixelText>
                </View>
                {email && (
                  <PixelText variant="caption" color={colors.textDim} style={styles.gap}>
                    연결된 계정: {email}
                  </PixelText>
                )}
                <PixelText variant="body" color={colors.text} style={styles.gap}>
                  이제 앱을 지우거나 기기를 바꿔도 Google 로그인으로 야구공·스킨·출석을 되살릴 수 있어요.
                </PixelText>
              </Panel>
            </View>
          ) : (
            // ── 미보호(익명) 상태 ────────────────────────
            <>
              <View style={styles.section}>
                <SectionLabel icon="star" label="계정 보호하기" />
                <Panel>
                  <PixelText variant="body" color={colors.text}>
                    지금은 이 기기에만 저장돼 있어요. 앱을 지우면 야구공·스킨·출석이 모두 사라져요.
                  </PixelText>
                  <PixelText variant="caption" color={colors.textDim} style={styles.gap}>
                    Google 계정으로 연결하면 데이터를 그대로 지키고, 나중에 재설치·기기변경 시 복구할 수 있어요.
                  </PixelText>
                  <PixelButton
                    label={authBusy ? '진행 중…' : 'Google로 보호하기'}
                    onPress={() => { void protect(); }}
                    disabled={authBusy}
                    style={styles.actionBtn}
                  />
                </Panel>
              </View>

              <View style={styles.section}>
                <SectionLabel label="이미 계정이 있어요" />
                <Panel>
                  <PixelText variant="caption" color={colors.textDim}>
                    예전에 보호한 적이 있다면 복구하세요. 지금 이 기기의 진행상황은 기존 계정 데이터로 대체돼요.
                  </PixelText>
                  <PixelButton
                    label="Google로 복구하기"
                    accentColor={colors.surfaceAlt}
                    onPress={() => { clearAuthError(); setConfirmRecover(true); }}
                    disabled={authBusy}
                    style={styles.actionBtn}
                  />
                </Panel>
              </View>
            </>
          )}

          {authError && (
            <View style={styles.section}>
              <Panel>
                <PixelText variant="caption" color={colors.bad}>
                  인증 오류: {authError}
                </PixelText>
              </Panel>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* 복구 손실 경고 모달(케이스 B) */}
      <Modal visible={confirmRecover} transparent animationType="fade" onRequestClose={() => setConfirmRecover(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <PixelText variant="title" color={colors.text}>복구할까요?</PixelText>
            <PixelText variant="body" color={colors.textDim} style={styles.modalMsg}>
              복구하면 지금 이 기기의 진행상황
              {baseballBalance > 0 ? ` (야구공 ${baseballBalance}개 등)` : ''}이 사라지고,
              기존 Google 계정의 데이터로 대체돼요.
            </PixelText>
            <View style={styles.modalRow}>
              <PixelButton label="취소" accentColor={colors.surfaceAlt} onPress={() => setConfirmRecover(false)} style={styles.modalBtn} />
              <PixelButton label="계속" accentColor={colors.bad} onPress={() => { void onRecover(); }} style={styles.modalBtn} />
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
