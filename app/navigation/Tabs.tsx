import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, Platform } from 'react-native';
import type { TabParamList } from './types';
import Today from '../screens/Today';
import Standings from '../screens/Standings';
import MyTeam from '../screens/MyTeam';
import Settings from '../screens/Settings';
import { colors, fonts, border } from '../theme';
import { isKstMonday } from '../utils';
import { useTeamTheme } from '../context/TeamTheme';

const Tab = createBottomTabNavigator<TabParamList>();

export default function Tabs() {
  const monday = isKstMonday();
  const { accent } = useTeamTheme();

  // 8비트 탭바 아이콘 (이모지) + 활성 시 팀색 언더라인 인디케이터.
  const icon = (glyph: string) => ({ focused, color }: { focused: boolean; color: string }) => (
    <View style={styles.iconWrap}>
      <Text style={{ fontSize: 16, color }}>{glyph}</Text>
      <View style={[styles.indicator, focused && { backgroundColor: accent }]} />
    </View>
  );

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: border.width,
          // 웹: CSS env()로 브라우저 홈 인디케이터 영역 회피 (useSafeAreaInsets는 웹 브라우저에서 0 반환)
          ...(Platform.OS === 'web' ? { paddingBottom: 'env(safe-area-inset-bottom, 0px)' as any } : {}),
        },
        tabBarLabelStyle: { fontFamily: fonts.pixel, fontSize: 10 },
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: colors.textDim,
      }}
    >
      <Tab.Screen name="Today" component={Today} options={{ title: monday ? '월요 리포트' : '오늘경기', tabBarIcon: icon(monday ? '📋' : '⚾') }} />
      <Tab.Screen name="Standings" component={Standings} options={{ title: '순위', tabBarIcon: icon('📊') }} />
      <Tab.Screen name="MyTeam" component={MyTeam} options={{ title: '내 팀', tabBarIcon: icon('★') }} />
      <Tab.Screen name="Settings" component={Settings} options={{ title: '설정', tabBarIcon: icon('⚙') }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: 'center' },
  indicator: { marginTop: 3, height: 3, width: 18, borderRadius: 2, backgroundColor: 'transparent' },
});
