import { useEffect, useRef, useState } from 'react';
import { ImageBackground, Pressable, StatusBar, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { getCheerTeam } from '../data/team';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

// 세션 레벨 플래그 — JS 런타임이 살아있는 동안 유지.
// 앱 완전 종료(프로세스 kill) 시 모듈이 재로드되어 자동 false로 리셋됨.
// 다른 앱에 갔다가 돌아오는 경우 JS 프로세스가 유지되므로 true 그대로 → 인트로 스킵.
let _introShownThisSession = false;

export default function Splash({ navigation }: Props) {
  const [canNavigate, setCanNavigate] = useState(false);
  const teamRef = useRef<string | null>(null);

  useEffect(() => {
    getCheerTeam().then((c) => {
      teamRef.current = c;
      if (_introShownThisSession) {
        // 이미 이 세션에서 인트로를 봤으면 즉시 홈으로
        navigation.replace(c ? 'Tabs' : 'Onboarding');
      } else {
        setCanNavigate(true);
      }
    });
  }, [navigation]);

  const handleTap = () => {
    _introShownThisSession = true;
    navigation.replace(teamRef.current ? 'Tabs' : 'Onboarding');
  };

  return (
    <Pressable
      style={styles.container}
      onPress={canNavigate ? handleTap : undefined}
      accessibilityRole="button"
      accessibilityLabel="홈으로 이동"
    >
      <StatusBar hidden />
      <ImageBackground
        source={require('../assets/splash-intro.png')}
        style={styles.image}
        resizeMode="cover"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  image: { flex: 1 },
});
