import { Tabs } from 'expo-router';
import { Icon } from '@/components/ui';
import { colors, typography } from '@/theme/tokens';

const tabs = [
  { name: 'index', label: '홈', icon: 'home' },
  { name: 'recommend', label: '추천', icon: 'film' },
  { name: 'search', label: '찾기', icon: 'search' },
  { name: 'library', label: '보관함', icon: 'bookmark' },
  { name: 'account', label: '내 정보', icon: 'user' },
] as const;

// NativeTabs uses platform image rendering, unavailable in a browser.
export default function WebTabLayout() {
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: colors.accent,
    tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 72, paddingTop: 7, paddingBottom: 9 },
    tabBarLabelStyle: { fontFamily: typography.medium, fontSize: 11 },
  }}>
    {tabs.map(tab => <Tabs.Screen name={tab.name} key={tab.name} options={{ title: tab.label, tabBarAccessibilityLabel: `${tab.label} 탭`, tabBarIcon: ({ focused }) => <Icon name={tab.icon} color={focused ? colors.accent : colors.muted} size={22} /> }} />)}
  </Tabs>;
}
