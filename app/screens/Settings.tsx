// 설정 화면 — 라커룸 우상단 톱니로 진입. 데이터 갱신 / 적중률 / (디버그) / 앱 정보.
import { useEffect, useState } from 'react';
import { View, ScrollView, Image, StyleSheet } from 'react-native';
import type { TrackRecord } from '../types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/Auth';
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

export default function Settings() {
  const navigation = useNavigation<Nav>();
  const { isProtected, email, signOut } = useAuth();
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [trackRecord, setTrackRecord] = useState<TrackRecord | null>(null);
  const [notify, setNotify] = useState(false);
  const [permDenied, setPermDenied] = useState(false);

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
          <SectionLabel label="계정" />
          <Panel>
            <PixelText variant="body">
              {isProtected ? '계정 보호됨 ✓' : '미보호 (익명)'}
            </PixelText>
            <PixelText variant="caption" color={colors.textDim} style={styles.value}>
              {isProtected
                ? `Google 연결됨${email ? ` · ${email}` : ''} · 재설치·기기변경 복구 가능`
                : '앱을 지우면 야구공·스킨·출석이 사라져요. Google로 보호하세요.'}
            </PixelText>
            <PixelButton
              label={isProtected ? '계정 관리' : '계정 보호하기'}
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

        <View style={styles.section}>
          <SectionLabel label="앱 정보" />
          <Panel>
            <PixelText variant="body">오늘야구각</PixelText>
            <PixelText variant="caption" color={colors.textDim} style={styles.value}>버전 {APP_VERSION}</PixelText>
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
});
