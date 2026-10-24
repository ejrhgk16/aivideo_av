import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppText, EmptyState, Page, SectionTitle } from '@/components/ui';
import { AppTopBar } from '@/components/AppTopBar';
import { colors } from '@/common/theme/tokens';

type LibraryTab = '저장한 작품' | '시청 기록';

export function LibraryScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [selectedTab, setSelectedTab] = useState<LibraryTab | null>(null);
  useEffect(() => setSelectedTab(null), [params.tab]);
  const tab = selectedTab ?? (params.tab === 'history' || params.tab === '시청 기록' ? '시청 기록' : '저장한 작품');

  return <Page header={<AppTopBar />} contentStyle={styles.page}>
    <SectionTitle eyebrow="MY COLLECTION" title="보관함" />
    <View style={styles.tabs} accessibilityRole="tablist">
      {(['저장한 작품', '시청 기록'] as const).map((item) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }} style={[styles.tab, tab === item && styles.activeTab]} onPress={() => setSelectedTab(item)}><AppText weight={tab === item ? 'semibold' : 'regular'} style={[styles.tabLabel, tab === item && styles.activeLabel]}>{item}</AppText></Pressable>)}
    </View>
    <EmptyState title={`${tab} 기능은 준비 중이에요`} description="저장과 시청 기록을 불러오는 기능이 아직 연결되지 않았어요." />
  </Page>;
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 22, paddingTop: 26, paddingBottom: 30, gap: 0 },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, borderCurve: 'continuous', padding: 4, marginTop: 25, marginBottom: 24 },
  tab: { flex: 1, minHeight: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderCurve: 'continuous' },
  activeTab: { backgroundColor: colors.elevated },
  tabLabel: { fontSize: 13, color: colors.muted },
  activeLabel: { color: colors.text },
});
