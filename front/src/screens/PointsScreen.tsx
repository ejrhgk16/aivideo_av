import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { AppText, Button, EmptyState, Icon, Page, SectionTitle } from '@/components/ui';
import { colors } from '@/common/theme/tokens';
import { getErrorMessage } from '@/common/http/errorMessages';
import { getPointHistory, type PointHistoryItem, type PointTransactionType } from '@/features/economy/pointHistory';
import { useUser } from '@/features/user/UserProvider';

type PointsTab = 'charge' | 'history';

const packs = [
  { points: 100, price: '₩1,100' },
  { points: 300, price: '₩3,300' },
  { points: 600, price: '₩6,600' },
];

type HistoryState = {
  owner: string;
  version: number;
  items: PointHistoryItem[];
  page: number;
  hasNext: boolean;
  status: 'loading' | 'loaded' | 'error';
  error: unknown;
  nextLoading: boolean;
  nextError: unknown;
};

const transactionLabels: Record<PointTransactionType, string> = {
  PURCHASE: '포인트 충전',
  AD_REWARD: '광고 보상',
  EPISODE_UNLOCK: '회차 구매',
  ADMIN_ADJUSTMENT: '관리자 조정',
  REFUND: '환불',
};

const pointHistoryDateFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function formatHistoryTime(value: string): string {
  const parts = Object.fromEntries(pointHistoryDateFormatter.formatToParts(new Date(value))
    .map((part) => [part.type, part.value]));
  return `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`;
}

function formatPointChange(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toLocaleString('ko-KR')} P`;
}

export function PointsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { points, user, isRestoring, sessionVersion, isCurrentSession } = useUser();
  const [selectedTab, setSelectedTab] = useState<PointsTab | null>(null);
  useEffect(() => setSelectedTab(null), [params.tab]);
  const tab = selectedTab ?? (params.tab === 'history' ? 'history' : 'charge');
  const active = tab === 'history';
  const owner = user?.uuid ?? null;
  const [history, setHistory] = useState<HistoryState | null>(null);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const current = useRef({ owner, version: sessionVersion, active, isRestoring });
  current.current = { owner, version: sessionVersion, active, isRestoring };

  const loadPage = useCallback(async (
    page: number,
    replace: boolean,
    requestGeneration: number,
    version: number,
    userUuid: string,
  ) => {
    if (inFlight.current) return;
    const isCurrentRequest = () => generation.current === requestGeneration
      && isCurrentSession(version)
      && current.current.owner === userUuid
      && current.current.version === version
      && current.current.active
      && !current.current.isRestoring;
    if (!isCurrentRequest()) return;

    inFlight.current = true;
    if (replace) {
      setHistory({ owner: userUuid, version, items: [], page: 0, hasNext: false,
        status: 'loading', error: null, nextLoading: false, nextError: null });
    } else {
      setHistory((value) => value && { ...value, nextLoading: true, nextError: null });
    }

    try {
      const result = await getPointHistory(page);
      if (!isCurrentRequest()) return;
      setHistory((value) => {
        const items = replace ? [] : [...(value?.items ?? [])];
        const seen = new Set(items.map((item) => item.uuid));
        for (const item of result.items) {
          if (!seen.has(item.uuid)) {
            seen.add(item.uuid);
            items.push(item);
          }
        }
        return { owner: userUuid, version, items, page: result.page, hasNext: result.hasNext,
          status: 'loaded', error: null, nextLoading: false, nextError: null };
      });
    } catch (error) {
      if (!isCurrentRequest()) return;
      setHistory((value) => value && (replace
        ? { ...value, status: 'error', error }
        : { ...value, nextError: error }));
    } finally {
      if (isCurrentRequest()) {
        inFlight.current = false;
        setHistory((value) => value && { ...value, nextLoading: false });
      }
    }
  }, [isCurrentSession]);

  useFocusEffect(useCallback(() => {
    const requestGeneration = ++generation.current;
    inFlight.current = false;
    setHistory(null);
    if (active && owner && !isRestoring) {
      void loadPage(1, true, requestGeneration, sessionVersion, owner);
    }
    return () => { generation.current += 1; inFlight.current = false; };
  }, [active, owner, isRestoring, sessionVersion, loadPage]));

  const visibleHistory = active && owner && history?.owner === owner && history.version === sessionVersion
    ? history : null;
  const retryFirstPage = () => {
    if (active && owner && !isRestoring) {
      void loadPage(1, true, generation.current, sessionVersion, owner);
    }
  };
  const loadNextPage = () => {
    if (!owner || visibleHistory?.status !== 'loaded' || !visibleHistory.hasNext || visibleHistory.nextLoading) return;
    void loadPage(visibleHistory.page + 1, false, generation.current, sessionVersion, owner);
  };
  const renderHistoryItem = useCallback(({ item }: { item: PointHistoryItem }) => (
    <View style={styles.historyRow}>
      <AppText weight="semibold">{transactionLabels[item.transactionType]}</AppText>
      {item.episode ? <AppText>{item.episode.dramaTitle} · {item.episode.episodeNumber}화</AppText> : null}
      <AppText style={item.amount > 0 ? styles.pointIncrease : styles.pointDecrease}>{formatPointChange(item.amount)}</AppText>
      <AppText style={styles.historyMeta}>거래 후 잔액 {item.balanceAfter.toLocaleString('ko-KR')} P</AppText>
      <AppText style={styles.historyMeta}>{formatHistoryTime(item.createdAt)}</AppText>
    </View>
  ), []);
  const historyContent = isRestoring
    ? <EmptyState title="로그인 상태를 확인하고 있어요" description="잠시만 기다려 주세요." />
    : !owner
      ? <EmptyState title="로그인이 필요해요" description="포인트 이용 내역을 보려면 로그인해 주세요."
          action="로그인" onAction={() => router.push('/login')} />
      : !visibleHistory || visibleHistory.status === 'loading'
        ? <EmptyState title="이용 내역을 불러오는 중이에요" description="잠시만 기다려 주세요." />
        : visibleHistory.status === 'error'
          ? <EmptyState title="이용 내역을 불러오지 못했어요" description={getErrorMessage(visibleHistory.error)}
              action="다시 시도" onAction={retryFirstPage} />
          : visibleHistory.items.length === 0
            ? <EmptyState title="포인트 이용 내역이 없어요" description="포인트가 추가되거나 사용되면 이곳에 표시돼요." />
            : <FlatList
                data={visibleHistory.items}
                keyExtractor={(item) => item.uuid}
                renderItem={renderHistoryItem}
                ListFooterComponent={visibleHistory.nextLoading
                  ? <AppText style={styles.historyFooter}>더 불러오는 중이에요</AppText>
                  : visibleHistory.nextError
                    ? <View style={styles.historyFooter}>
                        <AppText>{getErrorMessage(visibleHistory.nextError)}</AppText>
                        <Button label="다시 시도" onPress={loadNextPage} variant="secondary" />
                      </View>
                    : visibleHistory.hasNext
                      ? <Button label="더 보기" onPress={loadNextPage} variant="secondary" />
                      : null}
                style={styles.historyList}
                contentContainerStyle={styles.historyListContent}
              />;
  const goBack = () => router.canGoBack() ? router.back() : router.replace('/account');
  const amount = points === null ? '—' : points.toLocaleString('ko-KR');
  const pointsDescription = points === null ? '로그인 후 포인트를 확인할 수 있어요'
    : `사용 가능한 포인트는 ${amount} P예요`;

  return <Page scroll={tab === 'charge'} contentStyle={styles.page}>
    <Pressable accessibilityRole="button" accessibilityLabel="뒤로 가기" onPress={goBack} style={styles.backButton}>
      <Icon name="arrow-left" size={20} />
      <AppText weight="semibold">뒤로 가기</AppText>
    </Pressable>
    <SectionTitle title="이야기를 계속하는 방법" eyebrow="MORE STORIES, MORE MOMENTS" />
    <View style={styles.balanceCard}>
      <AppText style={styles.muted}>사용 가능한 포인트</AppText>
      <AppText weight="bold" style={styles.balance}>{amount} P</AppText>
      <AppText style={styles.muted}>{pointsDescription}</AppText>
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
    </View> : historyContent}
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
  historyList: { flex: 1 },
  historyListContent: { gap: 12, paddingBottom: 20 },
  historyRow: { gap: 5, backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border, padding: 16 },
  pointIncrease: { color: colors.accent, fontSize: 19, lineHeight: 27 },
  pointDecrease: { fontSize: 19, lineHeight: 27 },
  historyMeta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  historyFooter: { alignItems: 'center', gap: 8, padding: 12 },
});
