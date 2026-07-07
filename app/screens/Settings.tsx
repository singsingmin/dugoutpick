// 설정 메인 — 라커룸 우상단 톱니로 진입. 내 추천코드 + 그룹형 행 목록(드릴다운).
// 무거운 내용(소셜 연동·추천코드 입력=내 계정, 알림 토글=알림 설정)은 상세 화면으로 분리.
import { useEffect, useState } from 'react';
import { View, ScrollView, Image, Pressable, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import type { TrackRecord } from '../types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/Auth';
import { useScoreSkin } from '../context/ScoreSkin';
import { loadGames } from '../data/load';
import { fetchMyReferralCode } from '../services/referrals';
import PixelText from '../components/PixelText';
import Panel from '../components/Panel';
import PixelButton from '../components/PixelButton';
import CopyIcon from '../components/CopyIcon';
import ScreenHeader from '../components/ScreenHeader';
import SectionLabel from '../components/SectionLabel';
import SettingsRow from '../components/SettingsRow';
import TrackRecordBadge from '../components/TrackRecordBadge';
import { border, colors, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const APP_VERSION = '1.0.0';
const BUILD_ID = ((Constants.expoConfig?.extra?.buildId as string | undefined) ?? 'local').slice(0, 7);
const DEBUG_TOOLS = __DEV__ || process.env.EXPO_PUBLIC_DEBUG_TOOLS === '1';

export default function Settings() {
  const navigation = useNavigation<Nav>();
  const { isProtected } = useAuth();
  const { addBaseballs, resetProgress } = useScoreSkin();
  const [trackRecord, setTrackRecord] = useState<TrackRecord | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [debugMsg, setDebugMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadGames().then((d) => { if (active) setTrackRecord(d.trackRecord ?? null); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (isProtected) fetchMyReferralCode().then((c) => { if (active) setReferralCode(c); }).catch(() => {});
    return () => { active = false; };
  }, [isProtected]);

  const copyReferralCode = async () => {
    if (!referralCode) return;
    try {
      await Clipboard.setStringAsync(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* 웹 권한 등 실패는 무시 — 코드가 보여 수동 복사 가능 */ }
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
          {/* 내 추천코드 */}
          {isProtected && (
            <Panel style={styles.referralCard}>
              <PixelText variant="body">내 추천코드</PixelText>
              {referralCode ? (
                <Pressable style={styles.codePill} onPress={() => { void copyReferralCode(); }}>
                  <PixelText variant="title" color={colors.accent} style={styles.codeText}>{referralCode}</PixelText>
                  <CopyIcon size={26} color={colors.accent} bg={colors.surfaceAlt} />
                </Pressable>
              ) : (
                <PixelText variant="title" color={colors.textDim} style={styles.value}>발급 중...</PixelText>
              )}
              {copied && <PixelText variant="caption" color={colors.good}>복사됐어요</PixelText>}
              <PixelText variant="caption" color={colors.textDim} style={styles.value}>코드를 복사해 친구에게 공유해보세요</PixelText>
              <PixelText variant="caption" color={colors.textDim}>친구가 첫 예측에 참여하면 나도 야구공 10개를 받아요</PixelText>
            </Panel>
          )}

          {/* 계정 */}
          <View style={styles.section}>
            <SectionLabel label="계정" />
            <Panel style={styles.rowGroup}>
              <SettingsRow label="내 계정" onPress={() => navigation.navigate('AccountDetail')} last />
            </Panel>
          </View>

          {/* 환경설정 */}
          <View style={styles.section}>
            <SectionLabel label="환경설정" />
            <Panel style={styles.rowGroup}>
              <SettingsRow label="알림 설정" onPress={() => navigation.navigate('NotificationSettings')} last />
            </Panel>
          </View>

          {/* 꿀잼지수 적중률 */}
          <View style={styles.section}>
            <SectionLabel label="꿀잼지수 적중률" />
            <TrackRecordBadge track={trackRecord} variant="settings" />
          </View>

          {/* 개발/테스트용 — dev + preview 빌드에서만(production 미노출). */}
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

          {/* 앱 정보 */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bgImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  bgOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(243,233,206,0.35)' },
  safe: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing.md },

  referralCard: { marginTop: spacing.sm, marginBottom: spacing.lg },
  codePill: {
    marginTop: spacing.xs, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: colors.border, borderRadius: border.radius,
    backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  codeText: { letterSpacing: 3 },

  section: { marginBottom: spacing.lg },
  rowGroup: { paddingVertical: 0 },   // 행이 자체 세로 패딩을 가져 박스를 내용에 맞게 밀착
  value: { marginTop: spacing.xs },
  debugRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  debugBtn: { flex: 1 },
});
