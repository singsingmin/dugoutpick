import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet } from 'react-native';
import type { TabParamList } from './types';
import Today from '../screens/Today';
import Standings from '../screens/Standings';
import MyTeam from '../screens/MyTeam';
import LockerRoom from '../screens/LockerRoom';
import AppIcon, { type AppIconName } from '../components/AppIcon';
import { colors, fonts } from '../theme';
import { isKstMonday } from '../utils';
import { useTeamTheme } from '../context/TeamTheme';

const Tab = createBottomTabNavigator<TabParamList>();

export default function Tabs() {
  const monday = isKstMonday();
  const { accent } = useTeamTheme();

  const icon = (name: AppIconName) => ({ focused, color }: { focused: boolean; color: string }) => (
    <View style={styles.iconWrap}>
      <AppIcon name={name} size={26} color={color} />
      <View style={[styles.indicator, focused && { backgroundColor: accent }]} />
    </View>
  );

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: accent,
        },
        tabBarLabelStyle: { fontFamily: fonts.pixel, fontSize: 10 },
        tabBarActiveTintColor: colors.onGreen,
        tabBarInactiveTintColor: 'rgba(243,233,206,0.80)',
      }}
    >
      <Tab.Screen name="Today" component={Today} options={{ title: monday ? '월요 리포트' : '오늘경기', tabBarIcon: icon(monday ? 'clipboard' : 'baseball') }} />
      <Tab.Screen name="Standings" component={Standings} options={{ title: '순위', tabBarIcon: icon('chart') }} />
      <Tab.Screen name="MyTeam" component={MyTeam} options={{ title: '내 팀', tabBarIcon: icon('star') }} />
      <Tab.Screen name="LockerRoom" component={LockerRoom} options={{ title: '라커룸', tabBarIcon: icon('lockerroom') }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: 'center' },
  indicator: { marginTop: 3, height: 3, width: 18, borderRadius: 2, backgroundColor: 'transparent' },
});
