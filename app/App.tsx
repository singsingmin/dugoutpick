import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './navigation/RootNavigator';
import { AuthProvider, useAuth } from './context/Auth';
import { TeamThemeProvider } from './context/TeamTheme';
import { ScoreSkinProvider } from './context/ScoreSkin';
import { syncPushOnLaunch } from './services/push';

// 폰트 로딩 완료 전까지 네이티브 스플래시 유지
SplashScreen.preventAutoHideAsync();

// AuthProvider 내부에서 세션 확립(userId 확보) 후에만 푸시 동기화.
// 버그 감사 발견: App 최상단에서 마운트 즉시 호출하면 supabase가 AsyncStorage에서
// 세션을 복원하기 전이라 RPC가 'not authenticated'로 조용히 실패할 수 있었음.
function PushSync() {
  const { userId } = useAuth();
  useEffect(() => { if (userId) void syncPushOnLaunch(); }, [userId]);
  return null;
}

export default function App() {
  const [loaded] = useFonts({
    Galmuri11: require('./assets/fonts/Galmuri11.ttf'),
    Galmuri11Bold: require('./assets/fonts/Galmuri11-Bold.ttf'),
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PushSync />
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
