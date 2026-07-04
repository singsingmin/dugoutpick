// 설정 화면 — 라커룸 우상단 톱니로 진입. 데이터 갱신 / 적중률 / (디버그) / 앱 정보.
import { useEffect, useState } from 'react';
import { View, ScrollView, Image, StyleSheet } from 'react-native';
import type { TrackRecord } from '../types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/Auth';
import { useScoreSkin } from '../context/ScoreSkin';
import { loadGames } from '../data/load';
import { getNotifyEnabled, setNotifyEnabled, requestPermission, rescheduleMyTeamGameStart, disableAndCancel } from '../utils/notifications';
import PixelText from '../components/PixelText';
import Panel from '../components/Panel';
import PixelButton from '../components/PixelButton';
import ScreenHeader from '../components/ScreenHeader';
import SectionLabel from '../components/SectionLabel';
import TrackRecordBadge from '../components/TrackRecordBadge';
import { formatUpdatedAt } from '../utils';
import { colors, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const APP_VERSION = '1.0.0';
// 배포 빌드 커밋(github.sha). 로컬은 미주입 → 'local'. 캐시/최신 여부 즉시 확인용.
const BUILD_ID = (process.env.EXPO_PUBLIC_BUILD_ID ?? 'local').slice(0, 7);
// 디버그 도구 노출: 로컬 dev(__DEV__) + preview 테스트 빌드(env). production(출시) 미노출.
const DEBUG_TOOLS = __DEV__ || process.env.EXPO_PUBLIC_DEBUG_TOOLS === '1';

export default function Settings() {
  const navigation = useNavigation<Nav>();
  const { isProtected, email, signOut } = useAuth();
  const { addBaseballs, resetProgress } = useScoreSkin();
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [trackRecord, setTrackRecord] = useState<TrackRecord | null>(null);
  const [notify, setNotify] = useState(false);
  const [permDenied, setPermDenied] = useState(false);
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
      setNotify(false); setPermDenied(false);
      await disableAndCancel();
      return;
    }
    const ok = await requestPermission();  // 켜기 — 권한 먼저
    if (!ok) { setPermDenied(true); return; }
    setNotify(true); setPermDenied(false);
    await setNotifyEnabled(true);
    await rescheduleMyTeamGameStart();
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
            <PixelText variant="body">내 팀 경기 시작 알림</PixelText>
            <PixelText variant="caption" color={colors.textDim} style={styles.value}>
              경기 시작 30분 전, 응원팀 경기가 있는 날에만 울려요
            </PixelText>
            <PixelButton
              label={notify ? '알림 켜짐 (탭해서 끄기)' : '알림 켜기'}
              accentColor={notify ? colors.good : undefined}
              onPress={() => { void toggleNotify(); }}
              style={styles.notifyBtn}
            />
            {permDenied && (
              <PixelText variant="caption" color={colors.bad} style={styles.value}>
                알림 권한이 거부됐어요. 기기 설정에서 허용해 주세요.
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
            <PixelButton
              label={isProtected ? '계정 관리' : '구글 계정 연결하기'}
              accentColor={isProtected ? undefined : colors.good}
              onPress={() => navigation.navigate('AccountProtect')}
              style={styles.notifyBtn}
            />
            {isProtected && (
              <PixelButton
                label="로그아웃"
                accentColor={colors.bad}
                onPress={() => { void signOut(); }}
                style={styles.notifyBtn}
              />
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
  notifyBtn: { marginTop: spacing.sm },
  debugRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  debugBtn: { flex: 1 },
});
