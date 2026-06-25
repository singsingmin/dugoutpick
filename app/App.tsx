import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './navigation/RootNavigator';
import { TeamThemeProvider } from './context/TeamTheme';

export default function App() {
  const [loaded] = useFonts({
    Galmuri11: require('./assets/fonts/Galmuri11.ttf'),
    Galmuri11Bold: require('./assets/fonts/Galmuri11-Bold.ttf'),
  });

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
