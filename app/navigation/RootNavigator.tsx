import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import Splash from '../screens/Splash';
import Onboarding from '../screens/Onboarding';
import GameDetail from '../screens/GameDetail';
import SkinSelect from '../screens/SkinSelect';
import BaseballCenter from '../screens/BaseballCenter';
import PredictionLeague from '../screens/PredictionLeague';
import FullLeaderboard from '../screens/FullLeaderboard';
import TitleList from '../screens/TitleList';
import BackgroundShop from '../screens/BackgroundShop';
import HallOfFame from '../screens/HallOfFame';
import Settings from '../screens/Settings';
import AccountDetail from '../screens/AccountDetail';
import NotificationSettings from '../screens/NotificationSettings';
import Tabs from './Tabs';
import { colors, fonts } from '../theme';
import { useTeamTheme } from '../context/TeamTheme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { accent } = useTeamTheme();
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerStyle: { backgroundColor: accent },
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
      <Stack.Screen name="SkinSelect" component={SkinSelect} options={{ headerShown: false }} />
      <Stack.Screen name="BaseballCenter" component={BaseballCenter} options={{ headerShown: false }} />
      <Stack.Screen name="PredictionLeague" component={PredictionLeague} options={{ headerShown: false }} />
      <Stack.Screen name="FullLeaderboard" component={FullLeaderboard} options={{ headerShown: false }} />
      <Stack.Screen name="TitleList" component={TitleList} options={{ headerShown: false }} />
      <Stack.Screen name="BackgroundShop" component={BackgroundShop} options={{ headerShown: false }} />
      <Stack.Screen name="HallOfFame" component={HallOfFame} options={{ headerShown: false }} />
      <Stack.Screen name="Settings" component={Settings} options={{ headerShown: false }} />
      <Stack.Screen name="AccountDetail" component={AccountDetail} options={{ headerShown: false }} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettings} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
