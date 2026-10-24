import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Button, EmptyState, Icon, Page, SectionTitle } from '@/components/ui';
import { colors } from '@/common/theme/tokens';

type PointsTab = 'charge' | 'history';

const packs = [
  { points: 100, price: '₩1,100' },
  { points: 300, price: '₩3,300' },
  { points: 600, price: '₩6,600' },
];

export function PointsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [selectedTab, setSelectedTab] = useState<PointsTab | null>(null);
  useEffect(() => setSelectedTab(null), [params.tab]);
  const tab = selectedTab ?? (params.tab === 'history' ? 'history' : 'charge');
  const goBack = () => router.canGoBack() ? router.back() : router.replace('/account');

  return <Page contentStyle={styles.page}>
    <Pressable accessibilityRole="button" accessibilityLabel="뒤로 가기" onPress={goBack} style={styles.backButton}>
      <Icon name="arrow-left" size={20} />
      <AppText weight="semibold">뒤로 가기</AppText>
    </Pressable>
    <SectionTitle title="이야기를 계속하는 방법" eyebrow="MORE STORIES, MORE MOMENTS" />
    <View style={styles.balanceCard}>
      <AppText style={styles.muted}>사용 가능한 포인트</AppText>
      <AppText weight="bold" style={styles.balance}>— P</AppText>
      <AppText style={styles.muted}>포인트 정보는 준비 중이에요</AppText>
    </View>
    <View style={styles.tabs} accessibilityRole="tablist">
      {(['charge', 'history'] as const).map((item) => {
        const selected = tab === item;
        return <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected }}
          style={[styles.tab, selected && styles.activeTab]} onPress={() => setSelectedTab(item)}>
          <AppText weight={selected ? 'semibold' : 'regular'} style={[styles.tabLabel, selected && styles.activeLabel]}>
            {item === 'charge' ? '충전하기' : '이용 내역'}
          </AppText>
        </Pressable>;
      })}
    </View>
    {tab === 'charge' ? <View style={styles.chargeContent}>
      <View style={styles.rewardCard}>
        <View style={styles.rewardCopy}>
          <AppText weight="semibold">광고 보고 +10 P</AppText>
          <AppText style={styles.muted}>광고 보상은 준비 중이에요</AppText>
        </View>
        <Button label="준비 중" disabled onPress={() => {}} />
      </View>
      <View style={styles.packHeading}>
        <AppText weight="semibold">포인트 충전</AppText>
        <AppText style={styles.exampleLabel}>예시 가격</AppText>
      </View>
      {packs.map((pack) => <View key={pack.points} style={styles.packCard}>
        <View style={styles.packCopy}>
          <AppText weight="bold" style={styles.packPoints}>{pack.points} P</AppText>
          <AppText style={styles.muted}>예시 가격 · {pack.price}</AppText>
        </View>
        <Button label="준비 중" disabled onPress={() => {}} />
      </View>)}
      <AppText style={styles.notice}>표시된 상품과 가격은 예시이며 실제 결제되지 않아요.</AppText>
    </View> : <EmptyState title="이용 내역은 준비 중이에요" description="포인트 내역을 조회하는 기능은 아직 연결되지 않았어요." />}
  </Page>;
}

const styles = StyleSheet.create({
  page: { paddingTop: 16, gap: 22 },
  backButton: { alignSelf: 'flex-start', minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9 },
  balanceCard: { alignItems: 'center', gap: 7, backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 24 },
  balance: { fontSize: 34, lineHeight: 43 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: 4, marginTop: -4 },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  activeTab: { backgroundColor: colors.elevated },
  tabLabel: { fontSize: 14, color: colors.muted },
  activeLabel: { color: colors.text },
  chargeContent: { gap: 13 },
  rewardCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 },
  rewardCopy: { flex: 1, gap: 5 },
  packHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 },
  exampleLabel: { color: colors.muted, fontSize: 12 },
  packCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 },
  packCopy: { flex: 1, gap: 3 },
  packPoints: { fontSize: 17, lineHeight: 24 },
  notice: { color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 2 },
});
