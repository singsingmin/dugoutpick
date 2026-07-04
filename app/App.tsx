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
import { rescheduleMyTeamGameStart } from './utils/notifications';

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

  // 앱 시작 시 내 팀 경기 시작 알림 재예약(최신 일정 반영, 설정 꺼져있으면 no-op).
  useEffect(() => { void rescheduleMyTeamGameStart(); }, []);

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
