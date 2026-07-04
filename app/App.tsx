import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './navigation/RootNavigator';
import { AuthProvider } from './context/Auth';
import { TeamThemeProvider } from './context/TeamTheme';
import { ScoreSkinProvider } from './context/ScoreSkin';
import { syncPushOnLaunch } from './services/push';

// 폰트 로딩 완료 전까지 네이티브 스플래시 유지
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [loaded] = useFonts({
    Galmuri11: require('./assets/fonts/Galmuri11.ttf'),
    Galmuri11Bold: require('./assets/fonts/Galmuri11-Bold.ttf'),
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  // 앱 시작 시 옛 로컬 예약 정리 + 서버 푸시 토큰 갱신(알림 켜져있을 때). 설정 꺼져있으면 정리만.
  useEffect(() => { void syncPushOnLaunch(); }, []);

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <TeamThemeProvider>
          <ScoreSkinProvider>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
            <StatusBar style="dark" />
          </ScoreSkinProvider>
        </TeamThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
