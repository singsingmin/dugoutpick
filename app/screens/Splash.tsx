import { useEffect, useRef, useState } from 'react';
import { ImageBackground, Platform, Pressable, StatusBar, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { getCheerTeam } from '../data/team';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

let _introShownThisSession = false;

export default function Splash({ navigation }: Props) {
  const [canNavigate, setCanNavigate] = useState(false);
  const teamRef = useRef<string | null>(null);

  useEffect(() => {
    getCheerTeam().then((c) => {
      teamRef.current = c;
      if (_introShownThisSession) {
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
      testID="splash-container"
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
        // 웹: object-position:top → 이미지 상단(타이틀)이 항상 화면 상단에 고정.
        // 컨테이너가 viewport보다 커도 타이틀이 잘리지 않음.
        imageStyle={Platform.OS === 'web' ? (webImageStyle as object) : undefined}
      />
    </Pressable>
  );
}

// web 전용 CSS — RN StyleSheet에서 지원 안 하므로 별도 선언
const webImageStyle = { objectPosition: 'top center' };

const styles = StyleSheet.create({
  container: { flex: 1 },
  image: { flex: 1 },
});
