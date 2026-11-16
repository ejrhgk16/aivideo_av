import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { AppText, Button, EmptyState, Icon, Page } from '@/components/ui';
import { colors } from '@/common/theme/tokens';
import { getErrorMessage } from '@/common/http/errorMessages';
import { getPointHistory, type PointHistoryItem, type PointTransactionType } from '@/features/economy/pointHistory';
import { useUser } from '@/features/user/UserProvider';

type PointsTab = 'charge' | 'history';
type PendingDemo = { id: number; kind: 'ad' | 'pack'; amount: number; price?: string };
type DemoState = {
  owner: string;
  balance: number;
  items: PointHistoryItem[];
  adCount: number;
  pending: PendingDemo | null;
};

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

const transactionIcons: Record<PointTransactionType, 'credit-card' | 'gift' | 'unlock' | 'settings' | 'rotate-ccw'> = {
  PURCHASE: 'credit-card',
  AD_REWARD: 'gift',
  EPISODE_UNLOCK: 'unlock',
  ADMIN_ADJUSTMENT: 'settings',
  REFUND: 'rotate-ccw',
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
  const { width } = useWindowDimensions();
  const [selectedTab, setSelectedTab] = useState<PointsTab | null>(null);
  useEffect(() => setSelectedTab(null), [params.tab]);
  const tab = selectedTab ?? (params.tab === 'history' ? 'history' : 'charge');
  const active = tab === 'history';
  const owner = user?.uuid ?? null;
  const ownerKey = `${owner ?? 'anonymous'}:${sessionVersion}`;

  const [history, setHistory] = useState<HistoryState | null>(null);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const current = useRef({ owner, version: sessionVersion, active, isRestoring, isCurrentSession });
  current.current = { owner, version: sessionVersion, active, isRestoring, isCurrentSession };

  const [demo, setDemo] = useState<DemoState | null>(null);
  const demoOwner = useRef(ownerKey);
  demoOwner.current = ownerKey;
  const focused = useRef(false);
  const nextDemoId = useRef(0);
  const pendingId = useRef<number | null>(null);
  const currentDemo = demo?.owner === ownerKey ? demo : null;

  const loadPage = useCallback(async (
    page: number,
    replace: boolean,
    requestGeneration: number,
    version: number,
    userUuid: string,
  ) => {
    if (inFlight.current) return;
    const isCurrentRequest = () => generation.current === requestGeneration
      && current.current.isCurrentSession(version)
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
  }, []);

  useFocusEffect(useCallback(() => {
    const requestGeneration = ++generation.current;
    inFlight.current = false;
    setHistory(null);
    if (active && user?.uuid && !isRestoring) {
      void loadPage(1, true, requestGeneration, sessionVersion, user.uuid);
    }
    return () => { generation.current += 1; inFlight.current = false; };
  }, [active, user?.uuid, isRestoring, sessionVersion, loadPage]));

  // Keep the demo alive across charge/history tab changes, but discard it on route blur or owner change.
  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => {
      focused.current = false;
      pendingId.current = null;
      setDemo(null);
    };
  }, [ownerKey]));

  const visibleHistory = active && user?.uuid && history?.owner === user.uuid && history.version === sessionVersion
    ? history : null;
  const retryFirstPage = () => {
    if (active && user?.uuid && !isRestoring) {
      void loadPage(1, true, generation.current, sessionVersion, user.uuid);
    }
  };
  const loadNextPage = () => {
    if (!user?.uuid || visibleHistory?.status !== 'loaded' || !visibleHistory.hasNext || visibleHistory.nextLoading) return;
    void loadPage(visibleHistory.page + 1, false, generation.current, sessionVersion, user.uuid);
  };

  const openDemo = (kind: PendingDemo['kind'], amount: number, price?: string) => {
    if (!focused.current || isRestoring || (kind === 'ad' && (currentDemo?.adCount ?? 0) >= 5)) return;
    const id = ++nextDemoId.current;
    pendingId.current = id;
    const pending = { id, kind, amount, price };
    setDemo((previous) => {
      const base = previous?.owner === ownerKey
        ? previous
        : { owner: ownerKey, balance: points ?? 0, items: [], adCount: 0, pending: null };
      return { ...base, pending };
    });
  };

  const closeDemo = (id?: number) => {
    if (id !== undefined && pendingId.current !== id) return;
    pendingId.current = null;
    setDemo((previous) => previous?.owner === ownerKey ? { ...previous, pending: null } : previous);
  };

  const confirmDemo = (id: number) => {
    if (!focused.current || demoOwner.current !== ownerKey || pendingId.current !== id || isRestoring) return;
    pendingId.current = null;
    const createdAt = new Date().toISOString();
    setDemo((previous) => {
      if (previous?.owner !== ownerKey || previous.pending?.id !== id) return previous;
      const pending = previous.pending;
      if (pending.kind === 'ad' && previous.adCount >= 5) return { ...previous, pending: null };
      const balanceAfter = previous.balance + pending.amount;
      const item: PointHistoryItem = {
        uuid: `demo-${id}`,
        transactionType: pending.kind === 'ad' ? 'AD_REWARD' : 'PURCHASE',
        amount: pending.amount,
        balanceAfter,
        createdAt,
        episode: null,
      };
      return {
        ...previous,
        balance: balanceAfter,
        items: [item, ...previous.items],
        adCount: previous.adCount + (pending.kind === 'ad' ? 1 : 0),
        pending: null,
      };
    });
  };

  const renderHistoryItem = useCallback(({ item }: { item: PointHistoryItem }) => (
    <View style={styles.historyRow}>
      <View style={styles.historyIcon}>
        <Icon name={transactionIcons[item.transactionType]} size={18} color={item.amount > 0 ? colors.accent : '#A1ACBA'} />
      </View>
      <View style={styles.historyCopy}>
        <AppText weight="semibold" numberOfLines={1}>{transactionLabels[item.transactionType]}</AppText>
        <AppText style={styles.historyMeta}>{formatHistoryTime(item.createdAt)}</AppText>
        {item.episode ? <AppText style={styles.historyDetail} numberOfLines={1}>
          {item.episode.dramaTitle} · {item.episode.episodeNumber}화
        </AppText> : null}
        <AppText style={styles.historyMeta}>{`거래 후 잔액 ${item.balanceAfter.toLocaleString('ko-KR')} P`}</AppText>
      </View>
      <AppText weight="semibold" style={[styles.historyAmount, item.amount > 0 ? styles.pointIncrease : styles.pointDecrease]}>
        {formatPointChange(item.amount)}
      </AppText>
    </View>
  ), []);

  const historyEmpty = isRestoring
    ? <EmptyState title="로그인 상태를 확인하고 있어요" description="잠시만 기다려 주세요." />
    : !user?.uuid
      ? <EmptyState title="로그인이 필요해요" description="포인트 이용 내역을 보려면 로그인해 주세요."
          action="로그인" onAction={() => router.push('/login')} />
      : !visibleHistory || visibleHistory.status === 'loading'
        ? <EmptyState title="이용 내역을 불러오는 중이에요" description="잠시만 기다려 주세요." />
        : visibleHistory.status === 'error'
          ? <EmptyState title="이용 내역을 불러오지 못했어요" description={getErrorMessage(visibleHistory.error)}
              action="다시 시도" onAction={retryFirstPage} />
          : <EmptyState title="포인트 이용 내역이 없어요" description="포인트가 추가되거나 사용되면 이곳에 표시돼요." />;

  const goBack = () => router.canGoBack() ? router.back() : router.replace('/account');
  const amount = currentDemo ? currentDemo.balance.toLocaleString('ko-KR') : points === null ? '—' : points.toLocaleString('ko-KR');
  const pointsDescription = currentDemo ? '이 포인트는 화면을 나가면 초기화돼요'
    : points === null ? '로그인 후 포인트를 확인할 수 있어요'
      : '마음에 드는 드라마의 다음 회차를 열어보세요.';
  const titleSize = width <= 700 ? 25 : 32;
  const balanceSize = width <= 700 ? 58 : 64;
  const pending = currentDemo?.pending ?? null;

  const historyHeader = <>
    {currentDemo?.items.length ? <View style={styles.demoHistory}>
      <AppText weight="semibold" style={styles.historySectionTitle}>체험 내역</AppText>
      {currentDemo.items.map((item) => <View key={item.uuid}>{renderHistoryItem({ item })}</View>)}
    </View> : null}
    <AppText weight="semibold" style={styles.historySectionTitle}>실제 이용 내역</AppText>
  </>;

  return <Page scroll={tab === 'charge'} contentStyle={[styles.page, !active && styles.chargePage]}>
    <Pressable accessibilityRole="button" accessibilityLabel="뒤로 가기" onPress={goBack} style={styles.backButton}>
      <Icon name="arrow-left" size={20} />
      <AppText weight="semibold">뒤로 가기</AppText>
    </Pressable>
    <View style={styles.heading}>
      <AppText weight="medium" style={styles.eyebrow}>MORE STORIES, MORE MOMENTS</AppText>
      <AppText weight="bold" style={[styles.headingTitle, { fontSize: titleSize, lineHeight: titleSize + 8 }]}>
        이야기를 계속하는 방법
      </AppText>
    </View>
    <View style={styles.balanceArea}>
      <AppText style={styles.balanceLabel}>{currentDemo ? '체험 포인트' : '사용 가능한 포인트'}</AppText>
      <AppText weight="bold" style={[styles.balance, { fontSize: balanceSize }]}>{amount} <AppText weight="bold" style={styles.balanceP}>P</AppText></AppText>
      <AppText style={styles.balanceDescription}>{pointsDescription}</AppText>
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
      <Pressable accessibilityRole="button" accessibilityLabel="광고 보고 포인트 받기"
        accessibilityState={{ disabled: isRestoring || (currentDemo?.adCount ?? 0) >= 5 }}
        disabled={isRestoring || (currentDemo?.adCount ?? 0) >= 5}
        onPress={() => openDemo('ad', 10)} style={styles.rewardCard}>
        <View style={styles.giftIcon}><Icon name="gift" size={22} color={colors.accent} /></View>
        <View style={styles.rewardCopy}>
          <AppText weight="semibold">광고 보고 포인트 받기</AppText>
          <AppText style={styles.rewardMeta}>광고 보상 체험 · {currentDemo?.adCount ?? 0}/5회</AppText>
        </View>
        <View style={styles.rewardValue}>
          <AppText weight="bold" style={styles.rewardPoints}>+10 P</AppText>
          <Icon name="chevron-right" size={18} color="#A3B194" />
        </View>
      </Pressable>
      <View style={styles.packHeading}>
        <AppText weight="semibold" style={styles.packTitle}>필요한 만큼 충전해요</AppText>
        <AppText style={styles.exampleLabel}>예시 가격</AppText>
      </View>
      {packs.map((pack) => <Pressable key={pack.points} accessibilityRole="button"
        accessibilityLabel={`${pack.points} P 충전 체험`} onPress={() => openDemo('pack', pack.points, pack.price)}
        disabled={isRestoring} accessibilityState={{ disabled: isRestoring }}
        style={styles.packCard}>
        <View style={styles.packIcon}><AppText weight="bold" style={styles.packIconText}>P</AppText></View>
        <AppText weight="bold" style={[styles.packPoints, { fontSize: width <= 700 ? 21 : 23 }]}>{pack.points}<AppText weight="bold" style={styles.packP}> P</AppText></AppText>
        <View style={styles.priceBadge}><AppText weight="semibold" style={styles.priceText}>{pack.price}</AppText></View>
      </Pressable>)}
      <AppText style={styles.notice}>실제 결제되지 않으며 체험 포인트는 이 화면을 나가면 초기화돼요.</AppText>
      <View style={styles.footerNote}><Icon name="check-circle" size={16} color="#99A88C" />
        <AppText style={styles.footerText}>한 번 연 회차는 다시 볼 때 무료예요.</AppText></View>
      {currentDemo?.items.length ? <View style={styles.chargeDemoHistory}>
        <AppText weight="semibold" style={styles.historySectionTitle}>체험 내역</AppText>
        {currentDemo.items.map((item) => <View key={item.uuid}>{renderHistoryItem({ item })}</View>)}
      </View> : null}
    </View> : <FlatList
      data={visibleHistory?.items ?? []}
      keyExtractor={(item) => item.uuid}
      renderItem={renderHistoryItem}
      ListHeaderComponent={historyHeader}
      ListEmptyComponent={historyEmpty}
      ListFooterComponent={visibleHistory?.status === 'loaded'
        ? visibleHistory.nextLoading
          ? <AppText style={styles.historyFooter}>더 불러오는 중이에요</AppText>
          : visibleHistory.nextError
            ? <View style={styles.historyFooter}>
                <AppText>{getErrorMessage(visibleHistory.nextError)}</AppText>
                <Button label="다시 시도" onPress={loadNextPage} variant="secondary" />
              </View>
            : visibleHistory.hasNext
              ? <Button label="더 보기" onPress={loadNextPage} variant="secondary" />
              : null
        : null}
      style={styles.historyList}
      contentContainerStyle={styles.historyListContent}
    />}
    <Modal visible={!!pending} transparent animationType="fade" onRequestClose={() => closeDemo(pending?.id)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard} accessibilityRole="alert">
          <View style={styles.modalIcon}><Icon name={pending?.kind === 'ad' ? 'gift' : 'credit-card'} size={24} color={colors.accent} /></View>
          <AppText weight="bold" style={styles.modalTitle}>{pending?.kind === 'ad' ? '광고 체험' : '충전 체험'}</AppText>
          {pending?.kind === 'pack' ? <>
            <AppText weight="semibold" style={styles.modalAmount}>{pending.amount.toLocaleString('ko-KR')} P</AppText>
            <AppText style={styles.modalPrice}>{pending.price}</AppText>
          </> : <AppText style={styles.modalDescription}>체험을 완료하면 10 P가 추가돼요.</AppText>}
          <AppText style={styles.modalDescription}>실제 결제되지 않는 화면 체험이에요.</AppText>
          <Button label={pending?.kind === 'ad' ? '체험 완료' : '체험 충전하기'} onPress={() => pending && confirmDemo(pending.id)} style={styles.modalPrimary} />
          <Button label="취소" variant="ghost" onPress={() => closeDemo(pending?.id)} style={styles.modalCancel} />
        </View>
      </View>
    </Modal>
  </Page>;
}

const styles = StyleSheet.create({
  page: { paddingTop: 16, paddingBottom: 28, gap: 22, width: '100%', maxWidth: 780, alignSelf: 'center' },
  chargePage: { paddingHorizontal: 22 },
  backButton: { alignSelf: 'flex-start', minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9 },
  heading: { gap: 7 },
  eyebrow: { color: '#A1ACBA', fontSize: 10, lineHeight: 15, letterSpacing: 1.8 },
  headingTitle: { color: colors.text, letterSpacing: -0.7 },
  balanceArea: { alignItems: 'flex-start', gap: 5, paddingTop: 5 },
  balanceLabel: { color: '#A1ACBA', fontSize: 14 },
  balance: { color: colors.text, lineHeight: 75, letterSpacing: -2 },
  balanceP: { color: colors.accent, fontSize: 31, letterSpacing: 0 },
  balanceDescription: { color: '#939FAD', fontSize: 13, lineHeight: 20 },
  tabs: { flexDirection: 'row', backgroundColor: '#171B22', borderRadius: 12, padding: 4, marginTop: -4, minHeight: 49 },
  tab: { flex: 1, minHeight: 41, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  activeTab: { backgroundColor: '#30363F' },
  tabLabel: { fontSize: 14, color: '#A1ACBA' },
  activeLabel: { color: colors.text },
  chargeContent: { gap: 13 },
  rewardCard: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#232B1D', borderRadius: 15, borderWidth: 1, borderColor: '#CBF46A25', padding: 13 },
  giftIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#334325', alignItems: 'center', justifyContent: 'center' },
  rewardCopy: { flex: 1, minWidth: 0, gap: 4 },
  rewardMeta: { color: '#A3B194', fontSize: 12, lineHeight: 18 },
  rewardValue: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rewardPoints: { color: colors.accent, fontSize: 15 },
  packHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 7 },
  packTitle: { fontSize: 18, flexShrink: 1 },
  exampleLabel: { color: '#939FAD', fontSize: 12 },
  packCard: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#171C23', borderRadius: 14, padding: 13 },
  packIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2B3325', alignItems: 'center', justifyContent: 'center' },
  packIconText: { color: colors.accent, fontSize: 18 },
  packPoints: { flex: 1, color: colors.text },
  packP: { color: '#A1ACBA', fontSize: 13 },
  priceBadge: { backgroundColor: '#2A313B', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, flexShrink: 0 },
  priceText: { fontSize: 13 },
  notice: { color: '#99A88C', fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 2 },
  footerNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 1 },
  footerText: { color: '#778491', fontSize: 12, lineHeight: 18 },
  chargeDemoHistory: { marginTop: 12 },
  historyList: { flex: 1, minHeight: 120 },
  historyListContent: { gap: 0, paddingBottom: 20, flexGrow: 1 },
  historySectionTitle: { color: colors.text, fontSize: 17, marginBottom: 8 },
  demoHistory: { marginBottom: 18 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#252A32', paddingVertical: 13 },
  historyIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#171C23', alignItems: 'center', justifyContent: 'center' },
  historyCopy: { flex: 1, minWidth: 0, gap: 2 },
  historyDetail: { color: '#A1ACBA', fontSize: 12, lineHeight: 18 },
  pointIncrease: { color: colors.accent },
  pointDecrease: { color: colors.text },
  historyAmount: { fontSize: 16, flexShrink: 0 },
  historyMeta: { color: '#939FAD', fontSize: 11, lineHeight: 16 },
  historyFooter: { alignItems: 'center', gap: 8, padding: 12 },
  modalBackdrop: { flex: 1, padding: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000B8' },
  modalCard: { width: '100%', maxWidth: 400, alignItems: 'center', gap: 10, borderRadius: 22, backgroundColor: '#171A20', borderWidth: 1, borderColor: '#30363F', padding: 24 },
  modalIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#2B3325', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  modalTitle: { fontSize: 21, lineHeight: 29 },
  modalAmount: { color: colors.accent, fontSize: 24, lineHeight: 32 },
  modalPrice: { color: '#A1ACBA', fontSize: 15 },
  modalDescription: { color: '#A1ACBA', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  modalPrimary: { alignSelf: 'stretch', marginTop: 7 },
  modalCancel: { alignSelf: 'stretch' },
});
