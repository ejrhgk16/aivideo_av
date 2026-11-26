import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, Modal, Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { AppText, Button, EmptyState, Icon, isKeyboardPress, KEYBOARD_PRESS_GUARD_MS, LoadingState, Page, Peeka } from '@/components/ui';
import { createThemedStyles, useColors } from '@/common/theme/theme';
import { radius, spacing, textSizes } from '@/common/theme/tokens';
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

const AD_REWARD_POINTS = 10;
const AD_DAILY_LIMIT = 5;
const AD_SECONDS = 5;

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
  return `${value > 0 ? '+' : ''}${value.toLocaleString('ko-KR')}P`;
}

export function PointsScreen() {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { points, user, isRestoring, sessionVersion, isCurrentSession } = useUser();
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
  const [adSeconds, setAdSeconds] = useState(0);
  const openedAt = useRef(0);

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
    if (!focused.current || isRestoring || (kind === 'ad' && (currentDemo?.adCount ?? 0) >= AD_DAILY_LIMIT)) return;
    const id = ++nextDemoId.current;
    pendingId.current = id;
    openedAt.current = Date.now();
    setAdSeconds(0);
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
    if (currentDemo?.pending?.kind === 'ad' && adSeconds < AD_SECONDS) return;
    pendingId.current = null;
    const createdAt = new Date().toISOString();
    setDemo((previous) => {
      if (previous?.owner !== ownerKey || previous.pending?.id !== id) return previous;
      const pending = previous.pending;
      if (pending.kind === 'ad' && previous.adCount >= AD_DAILY_LIMIT) return { ...previous, pending: null };
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
        <Icon name={transactionIcons[item.transactionType]} size={18} color={item.amount > 0 ? colors.accent : colors.muted} />
      </View>
      <View style={styles.historyCopy}>
        <AppText weight="semibold" numberOfLines={1}>{transactionLabels[item.transactionType]}</AppText>
        <AppText style={styles.historyMeta}>{formatHistoryTime(item.createdAt)}</AppText>
        {item.episode ? <AppText style={styles.historyDetail} numberOfLines={1}>
          {item.episode.dramaTitle} · {item.episode.episodeNumber}화
        </AppText> : null}
        <AppText style={styles.historyMeta}>{`거래 후 잔액 ${item.balanceAfter.toLocaleString('ko-KR')}P`}</AppText>
      </View>
      <AppText weight="semibold" style={[styles.historyAmount, item.amount > 0 ? styles.pointIncrease : styles.pointDecrease]}>
        {formatPointChange(item.amount)}
      </AppText>
    </View>
  ), [colors, styles]);

  const historyEmpty = isRestoring
    ? <LoadingState />
    : !user?.uuid
      ? <EmptyState title="로그인이 필요해요" description="포인트 이용 내역을 보려면 로그인해 주세요."
          action="로그인" onAction={() => router.push('/auth/login')} />
      : !visibleHistory || visibleHistory.status === 'loading'
        ? <LoadingState />
        : visibleHistory.status === 'error'
          ? <EmptyState title="이용 내역을 불러오지 못했어요" description={getErrorMessage(visibleHistory.error)}
              action="다시 시도" onAction={retryFirstPage} />
          : <EmptyState title="포인트 이용 내역이 없어요" description="포인트가 추가되거나 사용되면 이곳에 표시돼요." />;

  const goBack = () => router.canGoBack() ? router.back() : router.replace('/account');
  const balanceValue = currentDemo ? currentDemo.balance : points;
  const amount = balanceValue === null ? '—' : balanceValue.toLocaleString('ko-KR');
  const pointsDescription = currentDemo ? '이 포인트는 화면을 나가면 초기화돼요'
    : points === null ? '로그인 후 포인트를 확인할 수 있어요' : null;
  const pending = currentDemo?.pending ?? null;
  const adsLeft = AD_DAILY_LIMIT - (currentDemo?.adCount ?? 0);
  const adDone = adSeconds >= AD_SECONDS;
  const pendingAd = pending?.kind === 'ad' ? pending.id : null;

  // 광고 창은 5초 동안 주 버튼을 막는다. 실제 광고는 아직 없어 시간만 센다.
  useEffect(() => {
    if (pendingAd === null) return;
    const timer = setInterval(() => setAdSeconds((value) => {
      if (value + 1 >= AD_SECONDS) clearInterval(timer);
      return Math.min(value + 1, AD_SECONDS);
    }), 1000);
    return () => clearInterval(timer);
  }, [pendingAd]);

  const confirmPack = (event: GestureResponderEvent) => {
    // 창을 연 Enter가 그대로 충전되지 않게, 창이 열린 직후의 키보드 입력은 버린다.
    if (isKeyboardPress(event) && Date.now() - openedAt.current < KEYBOARD_PRESS_GUARD_MS) return;
    if (pending) confirmDemo(pending.id);
  };

  const historyHeader = <>
    {currentDemo?.items.length ? <View style={styles.demoHistory}>
      <AppText weight="semibold" style={styles.historySectionTitle}>체험 내역</AppText>
      {currentDemo.items.map((item) => <View key={item.uuid}>{renderHistoryItem({ item })}</View>)}
    </View> : null}
    <AppText weight="semibold" style={styles.historySectionTitle}>실제 이용 내역</AppText>
  </>;

  return <Page scroll={tab === 'charge'} contentStyle={[styles.page, !active && styles.chargePage]}>
    <Pressable accessibilityRole="button" accessibilityLabel="뒤로 가기" onPress={goBack} style={styles.backButton}>
      <Icon name="chevron-left" size={20} />
      <AppText weight="semibold" style={styles.backLabel}>뒤로 가기</AppText>
    </Pressable>
    <AppText weight="bold" accessibilityRole="header" style={styles.headingTitle}>포인트</AppText>
    <View style={styles.balanceArea}>
      <AppText style={styles.balanceLabel}>{currentDemo ? '체험 포인트' : '사용 가능한 포인트'}</AppText>
      <AppText weight="bold" style={styles.balance}>{amount}<AppText weight="bold" style={styles.balanceP}>P</AppText></AppText>
      {pointsDescription ? <AppText style={styles.balanceDescription}>{pointsDescription}</AppText> : null}
    </View>
    <View style={styles.tabs} accessibilityRole="tablist">
      {(['charge', 'history'] as const).map((item) => {
        const selected = tab === item;
        return <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected }}
          style={[styles.tab, selected && styles.activeTab]} onPress={() => setSelectedTab(item)}>
          <AppText weight={selected ? 'semibold' : 'medium'} style={[styles.tabLabel, selected && styles.activeLabel]}>
            {item === 'charge' ? '충전하기' : '이용 내역'}
          </AppText>
        </Pressable>;
      })}
    </View>
    {tab === 'charge' ? <View style={styles.chargeContent}>
      <Pressable accessibilityRole="button" accessibilityLabel="광고 보고 10P 받기"
        accessibilityState={{ disabled: isRestoring || adsLeft <= 0 }}
        disabled={isRestoring || adsLeft <= 0}
        onPress={() => openDemo('ad', AD_REWARD_POINTS)} style={[styles.rewardCard, adsLeft <= 0 && styles.rewardCardDone]}>
        <View style={styles.giftIcon}><Icon name="gift" size={22} color={adsLeft <= 0 ? colors.muted : colors.accent} /></View>
        <View style={styles.rewardCopy}>
          <AppText weight="semibold" style={adsLeft <= 0 ? styles.rewardTitleDone : undefined}>광고 보고 10P 받기</AppText>
          <AppText style={styles.rewardMeta}>{adsLeft <= 0 ? '오늘 5번 모두 받았어요 · 내일 다시 받을 수 있어요' : `오늘 ${adsLeft}번 남음`}</AppText>
        </View>
        {adsLeft > 0 ? <Icon name="chevron-right" size={18} color={colors.muted} /> : null}
      </Pressable>
      {packs.map((pack) => <Pressable key={pack.points} accessibilityRole="button"
        accessibilityLabel={`${pack.points}P 충전 체험`} onPress={() => openDemo('pack', pack.points, pack.price)}
        disabled={isRestoring} accessibilityState={{ disabled: isRestoring }}
        style={styles.packCard}>
        <AppText weight="bold" style={styles.packPoints}>{pack.points}<AppText weight="bold" style={styles.packP}>P</AppText></AppText>
        <AppText weight="semibold" style={styles.priceText}>{pack.price}</AppText>
      </Pressable>)}
      <AppText style={styles.notice}>실제 결제되지 않으며 체험 포인트는 이 화면을 나가면 초기화돼요.</AppText>
      <View style={styles.footerNote}><Icon name="check-circle" size={16} color={colors.muted} />
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
          ? <LoadingState compact />
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
        {pending?.kind === 'ad' ? <View style={styles.modalCard} accessibilityRole="alert" accessibilityLabel="광고 보고 10P 받기">
          <AppText weight="semibold" style={styles.trial}>체험판</AppText>
          <Peeka slot={adDone ? 'loading' : 'loadingEgg'} size={88} />
          <AppText weight="bold" accessibilityRole="header" style={styles.modalTitle}>광고 보고 10P 받기</AppText>
          <AppText style={styles.modalDescription} accessibilityLiveRegion="polite">
            {adDone ? '광고가 끝났어요. 10P를 받아 가세요.' : '광고를 5초 보면 10P를 받을 수 있어요. '}
            {adDone ? null : <AppText weight="bold" style={styles.modalCountdown}>{`${AD_SECONDS - adSeconds}초 남음`}</AppText>}
          </AppText>
          <View style={styles.adTrack} accessible accessibilityRole="progressbar" accessibilityLabel="광고 진행"
            accessibilityValue={{ min: 0, max: AD_SECONDS, now: adSeconds }}>
            <View style={[styles.adFill, { width: `${(adSeconds / AD_SECONDS) * 100}%` }]} />
          </View>
          <Button label={adDone ? '10P 받기' : `${AD_SECONDS - adSeconds}초 후 10P 받기`} disabled={!adDone}
            onPress={() => confirmDemo(pending.id)} style={styles.modalPrimary} />
          <Button label="취소" variant="ghost" onPress={() => closeDemo(pending.id)} style={styles.modalCancel} />
          <AppText style={styles.modalFineprint}>{adDone ? '실제 광고가 아닌 화면 체험이에요.' : '5초가 지나기 전에 닫으면 포인트가 지급되지 않아요.'}</AppText>
        </View> : pending ? <View style={styles.modalCard} accessibilityRole="alert" accessibilityLabel={`${pending.amount.toLocaleString('ko-KR')}P를 충전할까요?`}>
          <AppText weight="semibold" style={styles.trial}>체험판</AppText>
          <View style={styles.modalIcon}><Icon name="credit-card" size={40} color={colors.accent} /></View>
          <AppText weight="bold" accessibilityRole="header" style={styles.modalTitle}>{`${pending.amount.toLocaleString('ko-KR')}P를 충전할까요?`}</AppText>
          <AppText style={styles.modalDescription}>다음 회차를 바로 이어볼 수 있어요.</AppText>
          <View style={styles.summary}>
            <View style={styles.summaryRow}><AppText style={styles.summaryLabel}>선택한 포인트</AppText>
              <AppText weight="semibold" style={styles.summaryValue}>{`${pending.amount.toLocaleString('ko-KR')}P`}</AppText></View>
            <View style={styles.summaryRow}><AppText style={styles.summaryLabel}>가격</AppText>
              <AppText weight="semibold" style={styles.summaryValue}>{pending.price}</AppText></View>
            <View style={[styles.summaryRow, styles.summaryTotal]}><AppText style={styles.summaryLabel}>충전 후 잔액</AppText>
              <AppText weight="bold" style={styles.summaryValue}>{`${((currentDemo?.balance ?? 0) + pending.amount).toLocaleString('ko-KR')}P`}</AppText></View>
          </View>
          <Button label={`${pending.amount.toLocaleString('ko-KR')}P 충전하기`} onPress={confirmPack} style={styles.modalPrimary} />
          <Button label="취소" variant="ghost" onPress={() => closeDemo(pending.id)} style={styles.modalCancel} />
          <AppText style={styles.modalFineprint}>실제 결제되지 않는 화면 체험이에요.</AppText>
        </View> : null}
      </View>
    </Modal>
  </Page>;
}

const useStyles = createThemedStyles((colors) => ({
  page: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg, width: '100%', maxWidth: 780, alignSelf: 'center' },
  chargePage: { paddingHorizontal: spacing.md },
  backButton: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, marginBottom: -spacing.sm },
  backLabel: { ...textSizes.label14 },
  headingTitle: { color: colors.text, ...textSizes.heading24 },
  balanceArea: { alignItems: 'flex-start', gap: spacing.xxs },
  balanceLabel: { color: colors.muted, ...textSizes.label14 },
  balance: { color: colors.text, ...textSizes.heading32 },
  balanceP: { color: colors.accent, ...textSizes.body18 },
  balanceDescription: { color: colors.muted, ...textSizes.caption12 },
  tabs: { flexDirection: 'row', gap: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { minHeight: 46, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: colors.accent },
  tabLabel: { ...textSizes.label14, color: colors.muted },
  activeLabel: { color: colors.text },
  chargeContent: { gap: spacing.sm },
  rewardCard: { minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, padding: spacing.sm },
  rewardCardDone: { backgroundColor: 'transparent', borderColor: colors.border },
  giftIcon: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  rewardCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  rewardTitleDone: { color: colors.muted },
  rewardMeta: { color: colors.muted, ...textSizes.caption12 },
  packCard: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: spacing.md },
  packPoints: { color: colors.text, ...textSizes.body18 },
  packP: { color: colors.muted, ...textSizes.label14 },
  priceText: { color: colors.text, ...textSizes.label14 },
  notice: { color: colors.muted, ...textSizes.caption12, textAlign: 'center' },
  footerNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  footerText: { color: colors.muted, ...textSizes.caption12 },
  chargeDemoHistory: { marginTop: spacing.sm },
  historyList: { flex: 1, minHeight: 120 },
  historyListContent: { gap: 0, paddingBottom: spacing.lg, flexGrow: 1 },
  historySectionTitle: { color: colors.text, ...textSizes.body18, marginBottom: spacing.xs },
  demoHistory: { marginBottom: spacing.lg },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: spacing.sm },
  historyIcon: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  historyCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  historyDetail: { color: colors.muted, ...textSizes.caption12 },
  pointIncrease: { color: colors.accent },
  pointDecrease: { color: colors.text },
  historyAmount: { ...textSizes.body16, flexShrink: 0 },
  historyMeta: { color: colors.muted, ...textSizes.badge11 },
  historyFooter: { alignItems: 'center', gap: spacing.xs, padding: spacing.sm },
  modalBackdrop: { flex: 1, padding: spacing.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.backdrop },
  modalCard: { width: '100%', maxWidth: 400, alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  trial: { color: colors.muted, ...textSizes.badge11 },
  modalIcon: { width: 88, height: 88, borderRadius: radius.pill, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { color: colors.text, ...textSizes.heading24, textAlign: 'center' },
  modalDescription: { color: colors.muted, ...textSizes.label14, textAlign: 'center' },
  modalCountdown: { color: colors.text, ...textSizes.label14 },
  adTrack: { alignSelf: 'stretch', height: 3, borderRadius: radius.pill, backgroundColor: colors.border, overflow: 'hidden' },
  adFill: { height: 3, backgroundColor: colors.accent },
  summary: { alignSelf: 'stretch', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.background, borderRadius: radius.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryTotal: { paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  summaryLabel: { color: colors.muted, ...textSizes.label14 },
  summaryValue: { color: colors.text, ...textSizes.label14 },
  modalPrimary: { alignSelf: 'stretch', marginTop: spacing.xs },
  modalCancel: { alignSelf: 'stretch' },
  modalFineprint: { color: colors.muted, ...textSizes.caption12, textAlign: 'center' },
}));
