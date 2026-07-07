// 알림 설정 상세 — 설정 메인의 "알림 설정 ›"에서 진입. 내 팀 경기 시작 알림 토글.
import { useEffect, useState } from 'react';
import { View, Image, ScrollView, Switch, Platform, Linking, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { getNotifyEnabled, setNotifyEnabled, requestPermission, disableAndCancel } from '../utils/notifications';
import { registerPushToken, disablePush } from '../services/push';
import PixelText from '../components/PixelText';
import Panel from '../components/Panel';
import PixelButton from '../components/PixelButton';
import ScreenHeader from '../components/ScreenHeader';
import { colors, spacing } from '../theme';

const IS_WEB = Platform.OS === 'web';

export default function NotificationSettings() {
  const navigation = useNavigation();
  const [notify, setNotify] = useState(false);
  const [permDenied, setPermDenied] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getNotifyEnabled().then((v) => { if (active) setNotify(v); });
    return () => { active = false; };
  }, []);

  const toggleNotify = async () => {
    if (notify) {
      setNotify(false); setPermDenied(false); setPushError(null);
      await disableAndCancel();
      await disablePush();
      return;
    }
    const ok = await requestPermission();
    if (!ok) { setPermDenied(true); return; }
    setNotify(true); setPermDenied(false); setPushError(null);
    await setNotifyEnabled(true);
    const res = await registerPushToken();
    if (!res.ok) setPushError(res.error ?? '토큰 등록 실패');
  };

  return (
    <View style={styles.root}>
      <Image source={require('../assets/stadium-bg.webp')} style={styles.bgImage} resizeMode="cover" />
      <View style={styles.bgOverlay} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="알림 설정" leftIcon="back" onLeftPress={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.content}>
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
                <PixelButton label="설정 열기" onPress={() => { void Linking.openSettings(); }} style={styles.btn} />
              </>
            )}
            {pushError && (
              <PixelText variant="caption" color={colors.bad} style={styles.value}>
                푸시 등록 실패: {pushError}
              </PixelText>
            )}
          </Panel>
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
  notifyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  notifyText: { flex: 1 },
  value: { marginTop: spacing.xs },
  btn: { marginTop: spacing.sm },
});
