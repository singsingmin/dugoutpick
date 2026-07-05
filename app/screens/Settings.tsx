// 설정 화면 — 라커룸 우상단 톱니로 진입. 데이터 갱신 / 적중률 / (디버그) / 앱 정보.
import { useEffect, useState } from 'react';
import { View, ScrollView, Image, Modal, Switch, Platform, Linking, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import type { TrackRecord } from '../types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/Auth';
import { useScoreSkin } from '../context/ScoreSkin';
import { loadGames } from '../data/load';
import { getNotifyEnabled, setNotifyEnabled, requestPermission, disableAndCancel } from '../utils/notifications';
import { registerPushToken, disablePush } from '../services/push';
import PixelText from '../components/PixelText';
import Panel from '../components/Panel';
import PixelButton from '../components/PixelButton';
import ScreenHeader from '../components/ScreenHeader';
import SectionLabel from '../components/SectionLabel';
import TrackRecordBadge from '../components/TrackRecordBadge';
import { formatUpdatedAt } from '../utils';
import { colors, spacing, border } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const APP_VERSION = '1.0.0';
// 빌드 커밋(app.config extra.buildId: 웹=github.sha, EAS=커밋해시). 캐시/최신 여부 확인용.
const BUILD_ID = ((Constants.expoConfig?.extra?.buildId as string | undefined) ?? 'local').slice(0, 7);
// 디버그 도구 노출: 로컬 dev(__DEV__) + preview 테스트 빌드(env). production(출시) 미노출.
const DEBUG_TOOLS = __DEV__ || process.env.EXPO_PUBLIC_DEBUG_TOOLS === '1';
const IS_WEB = Platform.OS === 'web';   // 웹은 로컬 알림 미지원

export default function Settings() {
  const navigation = useNavigation<Nav>();
  const {
    isProtected, email, authBusy, authError, linkConflict,
    connectGoogle, recoverGoogle, signOut, clearLinkConflict,
  } = useAuth();
  const { baseballBalance, addBaseballs, resetProgress } = useScoreSkin();
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [trackRecord, setTrackRecord] = useState<TrackRecord | null>(null);
  const [notify, setNotify] = useState(false);
  const [permDenied, setPermDenied] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [debugMsg, setDebugMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadGames().then((d) => {
      if (!active) return;
      setUpdatedAt(d.updatedAt);
      setTrackRecord(d.trackRecord ?? null);
    }).catch(() => {});
    getNotifyEnabled().then((v) => { if (active) setNotify(v); });
    return () => { active = false; };
  }, []);

  const toggleNotify = async () => {
    if (notify) {                         // 끄기
      setNotify(false); setPermDenied(false); setPushError(null);
      await disableAndCancel();           // 로컬 pref off + 예약 취소
      await disablePush();                // 서버 토큰 비활성
      return;
    }
    const ok = await requestPermission();  // 켜기 — 권한 먼저
    if (!ok) { setPermDenied(true); return; }
    setNotify(true); setPermDenied(false); setPushError(null);
    await setNotifyEnabled(true);
    const res = await registerPushToken(); // 서버 푸시 토큰 등록(로컬 스케줄 대체)
    if (!res.ok) setPushError(res.error ?? '토큰 등록 실패');  // 조용한 실패 방지 — 원인 표면화
  };

  const onDebugReset = async () => { setDebugMsg('초기화 중…'); await resetProgress(); setDebugMsg('초기화 완료 (야구공 15)'); };
  const onDebugGrant = async () => { setDebugMsg('지급 중…'); await addBaseballs(50); setDebugMsg('야구공 +50 지급됨'); };

  return (
    <View style={styles.root}>
      <Image source={require('../assets/stadium-bg.webp')} style={styles.bgImage} resizeMode="cover" />
      <View style={styles.bgOverlay} />
      <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="설정" leftIcon="back" onLeftPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <SectionLabel label="알림" />
          <Panel>
            <View style={styles.notifyRow}>
              <View style={styles.notifyText}>
                <PixelText variant="body">내 팀 경기 시작 알림</PixelText>
                <PixelText variant="caption" color={colors.textDim} style={styles.value}>
                  경기 시작 30분 전, 응원팀 경기가 있는 날에만 울려요
                </PixelText>
              </View>
              <Switch
                value={notify}
                onValueChange={() => { void toggleNotify(); }}
                disabled={IS_WEB}
                trackColor={{ true: colors.good, false: colors.border }}
                thumbColor={colors.bg}
              />
            </View>
            {IS_WEB && (
              <PixelText variant="caption" color={colors.textDim} style={styles.value}>
                웹에서는 알림을 지원하지 않아요. 앱에서 켜주세요.
              </PixelText>
            )}
            {permDenied && (
              <>
                <PixelText variant="caption" color={colors.bad} style={styles.value}>
                  알림 권한이 꺼져 있어요. 설정에서 켤 수 있어요.
                </PixelText>
                <PixelButton
                  label="설정 열기"
                  onPress={() => { void Linking.openSettings(); }}
                  style={styles.notifyBtn}
                />
              </>
            )}
            {pushError && (
              <PixelText variant="caption" color={colors.bad} style={styles.value}>
                푸시 등록 실패: {pushError}
              </PixelText>
            )}
          </Panel>
        </View>

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
              <PixelButton
                label="로그아웃"
                accentColor={colors.bad}
                onPress={() => { void signOut(); }}
                style={styles.notifyBtn}
              />
            ) : (
              <PixelButton
                label={authBusy ? '진행 중…' : '구글 계정으로 연결하기'}
                accentColor={colors.good}
                onPress={() => { void connectGoogle(); }}
                disabled={authBusy}
                style={styles.notifyBtn}
              />
            )}
            {authError && (
              <PixelText variant="caption" color={colors.bad} style={styles.value}>{authError}</PixelText>
            )}
          </Panel>
        </View>

        <View style={styles.section}>
          <SectionLabel label="데이터" />
          <Panel>
            <PixelText variant="body">갱신 시각</PixelText>
            <PixelText variant="caption" color={colors.textDim} style={styles.value}>
              {updatedAt ? formatUpdatedAt(updatedAt) : '-'}
            </PixelText>
          </Panel>
        </View>

        <View style={styles.section}>
          <SectionLabel label="꿀잼지수 적중률" />
          <TrackRecordBadge track={trackRecord} variant="settings" />
        </View>

        {/* 개발/테스트용 — dev + preview 빌드에서만(production 미노출). 서버 RPC=debug_enabled 게이팅. */}
        {DEBUG_TOOLS && (
          <View style={styles.section}>
            <SectionLabel label="테스트 도구" />
            <Panel>
              <PixelText variant="caption" color={colors.textDim}>서버 계정 초기화/지급 (debug 빌드 전용)</PixelText>
              <View style={styles.debugRow}>
                <PixelButton label="초기화 (야구공 15)" accentColor={colors.bad} onPress={() => { void onDebugReset(); }} style={styles.debugBtn} />
                <PixelButton label="야구공 +50" onPress={() => { void onDebugGrant(); }} style={styles.debugBtn} />
              </View>
              {debugMsg && (
                <PixelText variant="caption" color={colors.textDim} style={styles.value}>{debugMsg}</PixelText>
              )}
            </Panel>
          </View>
        )}

        <View style={styles.section}>
          <SectionLabel label="앱 정보" />
          <Panel>
            <PixelText variant="body">오늘야구각</PixelText>
            <PixelText variant="caption" color={colors.textDim} style={styles.value}>버전 {APP_VERSION} · 빌드 {BUILD_ID}</PixelText>
            <PixelText variant="caption" color={colors.textDim}>KBO 경기 꿀잼지수 · 데이터 출처: KBO</PixelText>
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
  notifyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  notifyText: { flex: 1 },
  notifyBtn: { marginTop: spacing.sm },
  debugRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  debugBtn: { flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  modalCard: { backgroundColor: colors.bg, borderColor: colors.border, borderWidth: border.width, borderRadius: border.radius, padding: spacing.lg, width: '100%', maxWidth: 340 },
  modalMsg: { marginTop: spacing.md, lineHeight: 20 },
  modalRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  modalBtn: { flex: 1 },
  modalHint: { marginTop: spacing.sm, textAlign: 'center' },
});
