import Feather from '@expo/vector-icons/Feather';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { colors, typography } from '@/theme/tokens';

const tabs = [
  { name: 'index', label: '홈', icon: 'home' },
  { name: 'recommend', label: '추천', icon: 'film' },
  { name: 'search', label: '찾기', icon: 'search' },
  { name: 'library', label: '보관함', icon: 'bookmark' },
  { name: 'account', label: '내 정보', icon: 'user' },
] as const;

export default function TabLayout() {
  return <NativeTabs backgroundColor={colors.surface} tintColor={colors.accent}
    iconColor={{ default: colors.muted, selected: colors.accent }}
    labelStyle={{ default: { fontFamily: typography.medium, fontSize: 11, color: colors.muted }, selected: { color: colors.accent } }}
    disableTransparentOnScrollEdge labelVisibilityMode="labeled">
    {tabs.map(tab => <NativeTabs.Trigger name={tab.name} key={tab.name} disableAutomaticContentInsets>
      <NativeTabs.Trigger.Icon src={<NativeTabs.Trigger.VectorIcon family={Feather} name={tab.icon} />} />
      <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>)}
  </NativeTabs>;
}
