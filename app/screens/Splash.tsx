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
  //
  // ⚠️ 자동이동을 getCheerTeam() resolve에만 걸면, 웹에서 AsyncStorage getItem이 hang할 때
  //    .then이 영영 안 걸려 인트로에서 멈춘다(실사고). → 팀 조회를 타임아웃과 race하고,
  //    인트로 최소 노출(delay)과 함께 기다린 뒤 무조건 진입(조회가 멈춰도 최대 대기 후 이동).
  useEffect(() => {
    let cancelled = false;
    const delay = _introShownThisSession ? 0 : 700;
    _introShownThisSession = true;
    // 팀 조회 hang 방지: 최대 2초 후 null로 진행(그 경우 온보딩으로).
    const teamP = Promise.race<string | null>([
      getCheerTeam().catch(() => null),
      new Promise<null>((res) => setTimeout(() => res(null), 2000)),
    ]);
    const delayP = new Promise<void>((res) => setTimeout(res, delay));
    Promise.all([teamP, delayP]).then(([c]) => {
      if (!cancelled) navigation.replace(c ? 'Tabs' : 'Onboarding');
    });
    return () => { cancelled = true; };
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
