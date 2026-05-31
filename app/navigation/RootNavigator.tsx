import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import Splash from '../screens/Splash';
import Onboarding from '../screens/Onboarding';
import GameDetail from '../screens/GameDetail';
import Tabs from './Tabs';
import { colors, fonts } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerStyle: { backgroundColor: colors.accent },
        headerTintColor: colors.onGreen,
        headerTitleStyle: { fontFamily: fonts.pixel },
        headerTitleAlign: 'center',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="Splash" component={Splash} options={{ headerShown: false }} />
      <Stack.Screen name="Onboarding" component={Onboarding} options={{ headerShown: false }} />
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="GameDetail" component={GameDetail} options={{ title: '경기 상세' }} />
    </Stack.Navigator>
  );
}
