import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './navigation/RootNavigator';
import { TeamThemeProvider } from './context/TeamTheme';

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

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <TeamThemeProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
        <StatusBar style="dark" />
      </TeamThemeProvider>
    </SafeAreaProvider>
  );
}
