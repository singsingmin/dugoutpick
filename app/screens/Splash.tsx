import { useEffect } from 'react';
import { ImageBackground, StatusBar, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { getCheerTeam } from '../data/team';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

let _introShownThisSession = false;

export default function Splash({ navigation }: Props) {
  // 자동 진입 — 첫 실행 시 인트로를 0.7초 보여준 뒤 탭 없이 오늘경기(응원팀 없으면 온보딩)로 이동.
  // 세션 내 재진입(_introShownThisSession)은 지연 없이 즉시 이동.
  useEffect(() => {
    const t0 = Date.now();
    console.log('[splash] effect start', new Date(t0).toISOString());   // 진단(임시)
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    getCheerTeam().then((c) => {
      console.log('[splash] getCheerTeam resolved +', Date.now() - t0, 'ms, team=', c);   // 진단(임시)
      if (cancelled) return;
      const dest = c ? 'Tabs' : 'Onboarding';
      const delay = _introShownThisSession ? 0 : 700;
      _introShownThisSession = true;
      timer = setTimeout(() => {
        console.log('[splash] navigate ->', dest, '+', Date.now() - t0, 'ms');   // 진단(임시)
        if (!cancelled) navigation.replace(dest);
      }, delay);
    });
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [navigation]);

  return (
    <View testID="splash-container" nativeID="splash-container" style={styles.container}>
      <StatusBar hidden />
      <ImageBackground
        source={require('../assets/splash-intro.webp')}
        style={styles.image}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  image: { flex: 1 },
});
