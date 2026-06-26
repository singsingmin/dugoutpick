import { useEffect, useRef, useState } from 'react';
import { ImageBackground, Pressable, StatusBar, StyleSheet } from 'react-native';
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
      nativeID="splash-container"
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
