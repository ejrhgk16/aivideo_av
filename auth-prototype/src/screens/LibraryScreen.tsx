import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, Button, EmptyState, Page, SectionTitle } from '@/components/ui';
import { AppTopBar } from '@/components/AppTopBar';
import { colors } from '@/common/theme/tokens';
import { getErrorMessage } from '@/common/http/errorMessages';
import { getSavedVideos, savedVideoRoute, type SavedVideoItem, type WatchHistoryItem } from '@/features/playback/savedVideos';
import { getWatchHistory } from '@/features/playback/watchHistory';
import { useUser } from '@/features/user/UserProvider';
import { resolveApiImageUrl } from '@/common/media';

function formatSavedDuration(durationMs: number): string {
  const totalSeconds = Math.max(1, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}초`;
  return seconds === 0 ? `${minutes}분` : `${minutes}분 ${seconds}초`;
}

type LibraryTab = '저장한 작품' | '시청 기록';
type LibraryItem = SavedVideoItem | WatchHistoryItem;
type ItemsOwner = { uuid: string; version: number; tab: LibraryTab };

export function LibraryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { isRestoring, user, sessionVersion, isCurrentSession } = useUser();
  const [selectedTab, setSelectedTab] = useState<LibraryTab | null>(null);
  useEffect(() => setSelectedTab(null), [params.tab]);
  const tab = selectedTab ?? (params.tab === 'history' || params.tab === '시청 기록' ? '시청 기록' : '저장한 작품');
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [error, setError] = useState<unknown>(null);
  const [nextError, setNextError] = useState<unknown>(null);
  const [nextLoading, setNextLoading] = useState(false);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const nextPage = useRef(2);
  const [itemsOwner, setItemsOwner] = useState<ItemsOwner | null>(null);
  const owner = user?.uuid ?? null;
  const currentTab = useRef(tab);
  const currentOwner = useRef(owner);
  currentTab.current = tab;
  currentOwner.current = owner;

  const loadPage = useCallback(async (page: number, replace: boolean, requestGeneration: number, version: number, userUuid: string, requestTab: LibraryTab) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const isCurrentRequest = () => generation.current === requestGeneration
      && isCurrentSession(version)
      && currentOwner.current === userUuid
      && currentTab.current === requestTab;
    if (replace) {
      setStatus('loading');
      setItems([]);
      setItemsOwner(null);
      setError(null);
      setNextError(null);
    } else {
      setNextLoading(true);
      setNextError(null);
    }
    try {
      const result = requestTab === '시청 기록' ? await getWatchHistory(page) : await getSavedVideos(page);
      if (!isCurrentRequest()) return;
      setItems((current) => {
        if (replace) return result.items;
        const merged: LibraryItem[] = [...current];
        const seen = new Set(merged.map((item) => item.videoUuid));
        for (const item of result.items) {
          if (!seen.has(item.videoUuid)) {
            seen.add(item.videoUuid);
            merged.push(item);
          }
        }
        return merged;
      });
      setHasNext(result.hasNext);
      nextPage.current = result.page + 1;
      setStatus('loaded');
      setItemsOwner({ uuid: userUuid, version, tab: requestTab });
      setError(null);
      setNextError(null);
    } catch (error) {
      if (!isCurrentRequest()) return;
      if (replace) { setStatus('error'); setError(error); }
      else setNextError(error);
    } finally {
      if (isCurrentRequest()) {
        inFlight.current = false;
        setNextLoading(false);
      }
    }
  }, [isCurrentSession]);

  useFocusEffect(useCallback(() => {
    const requestGeneration = ++generation.current;
    inFlight.current = false;
    nextPage.current = 2;
    setItems([]);
    setItemsOwner(null);
    setHasNext(false);
    setNextError(null);
    if (isRestoring || !owner) {
      setStatus('idle');
      return () => { generation.current += 1; };
    }
    void loadPage(1, true, requestGeneration, sessionVersion, owner, tab);
    return () => { generation.current += 1; inFlight.current = false; };
  }, [tab, isRestoring, owner, sessionVersion, loadPage]));

  const loadNextPage = () => {
    if (!ownsCurrentList || !hasNext || nextLoading || status !== 'loaded' || isRestoring || !owner) return;
    const page = nextPage.current;
    void loadPage(page, false, generation.current, sessionVersion, owner, tab);
  };
  const ownsCurrentList = itemsOwner?.uuid === owner && itemsOwner.version === sessionVersion && itemsOwner.tab === tab;
  const visibleItems = ownsCurrentList ? items : [];
  const retry = () => {
    if (!isRestoring && owner) void loadPage(1, true, generation.current, sessionVersion, owner, tab);
  };

  return <Page header={<AppTopBar />} scroll={false} contentStyle={styles.page}>
    <SectionTitle eyebrow="MY COLLECTION" title="보관함" />
    <View style={styles.tabs} accessibilityRole="tablist">
      {(['저장한 작품', '시청 기록'] as const).map((item) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }} style={[styles.tab, tab === item && styles.activeTab]} onPress={() => setSelectedTab(item)}><AppText weight={tab === item ? 'semibold' : 'regular'} style={[styles.tabLabel, tab === item && styles.activeLabel]}>{item}</AppText></Pressable>)}
    </View>
    {isRestoring ? <EmptyState title="로그인 상태를 확인하고 있어요" description="잠시만 기다려 주세요." />
      : !owner ? <EmptyState title="로그인이 필요해요" description={tab === '시청 기록' ? '시청 기록을 보려면 로그인해 주세요.' : '저장한 영상을 보려면 로그인해 주세요.'} action="로그인" onAction={() => router.push('/login')} />
      : status === 'loading' || status === 'idle' || (status === 'loaded' && !ownsCurrentList) ? <EmptyState title={tab === '시청 기록' ? '시청 기록을 불러오는 중이에요' : '저장한 영상을 불러오는 중이에요'} description="잠시만 기다려 주세요." />
      : status === 'error' ? <EmptyState title={tab === '시청 기록' ? '시청 기록을 불러오지 못했어요' : '저장한 영상을 불러오지 못했어요'} description={getErrorMessage(error)} action="다시 시도" onAction={retry} />
      : visibleItems.length === 0 ? <EmptyState title={tab === '시청 기록' ? '시청 기록이 없어요' : '저장한 영상이 없어요'} description={tab === '시청 기록' ? '영상을 시청하면 이곳에 표시돼요.' : '마음에 드는 영상을 저장해 보세요.'} />
      : <FlatList data={visibleItems} showsVerticalScrollIndicator={false} keyExtractor={(item) => item.videoUuid} renderItem={({ item }) => {
        const videoLabel = item.contentType === 'PREVIEW' ? '미리보기' : `에피소드 ${item.episodeNumber}화`;
        return <Pressable accessibilityRole="button" accessibilityLabel={`${item.dramaTitle} ${videoLabel}`} style={styles.card} onPress={() => router.push(savedVideoRoute(item))}>
          {item.imageUrl ? <Image source={{ uri: resolveApiImageUrl(item.imageUrl) ?? undefined }} contentFit="cover" style={styles.image} /> : <View style={[styles.image, styles.imagePlaceholder]} />}
          <View style={styles.cardText}><AppText weight="semibold" numberOfLines={1} style={styles.cardTitle}>{item.dramaTitle}</AppText><AppText style={styles.meta}>{videoLabel}</AppText><AppText style={styles.meta}>{formatSavedDuration(item.durationMs)}</AppText></View>
        </Pressable>;
      }} onEndReached={loadNextPage} onEndReachedThreshold={0.4} ListFooterComponent={nextLoading ? <AppText style={styles.footer}>더 불러오는 중이에요</AppText> : nextError ? <View style={styles.footer}><AppText>{getErrorMessage(nextError)}</AppText><Button label="다시 시도" onPress={loadNextPage} variant="secondary" /></View> : hasNext ? <Button label="더 보기" onPress={loadNextPage} variant="secondary" /> : null} style={styles.list} contentContainerStyle={styles.listContent} />}
  </Page>;
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 22, paddingTop: 26, paddingBottom: 30, gap: 0 },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, borderCurve: 'continuous', padding: 4, marginTop: 25, marginBottom: 24 },
  tab: { flex: 1, minHeight: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderCurve: 'continuous' },
  activeTab: { backgroundColor: colors.elevated },
  tabLabel: { fontSize: 13, color: colors.muted },
  activeLabel: { color: colors.text },
  list: { flex: 1 }, listContent: { gap: 12, paddingBottom: 20 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 10, borderRadius: 14, backgroundColor: colors.surface },
  image: { width: 112, height: 63, borderRadius: 7, borderCurve: 'continuous', backgroundColor: colors.elevated }, imagePlaceholder: { backgroundColor: colors.elevated },
  cardText: { flex: 1, gap: 5 }, cardTitle: { lineHeight: 23 }, meta: { color: colors.muted, fontSize: 12 }, footer: { alignItems: 'center', paddingVertical: 16, gap: 10 },
});
