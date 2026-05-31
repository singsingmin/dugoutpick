import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import type { TabParamList } from './types';
import Today from '../screens/Today';
import MyTeam from '../screens/MyTeam';
import Settings from '../screens/Settings';
import { colors, fonts, border } from '../theme';

const Tab = createBottomTabNavigator<TabParamList>();

// 8비트 탭바. 아이콘은 이미지 대신 텍스트/이모지(ADR-009).
const icon = (glyph: string) => ({ color }: { color: string }) => (
  <Text style={{ fontSize: 16, color }}>{glyph}</Text>
);

export default function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: border.width,
        },
        tabBarLabelStyle: { fontFamily: fonts.pixel, fontSize: 10 },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
      }}
    >
      <Tab.Screen name="Today" component={Today} options={{ title: '오늘경기', tabBarIcon: icon('⚾') }} />
      <Tab.Screen name="MyTeam" component={MyTeam} options={{ title: '내 팀', tabBarIcon: icon('★') }} />
      <Tab.Screen name="Settings" component={Settings} options={{ title: '설정', tabBarIcon: icon('⚙') }} />
    </Tab.Navigator>
  );
}
