import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, Button, EmptyState, Page, SectionTitle } from '@/components/ui';
import { AppTopBar } from '@/components/AppTopBar';
import { colors } from '@/common/theme/tokens';
import { getErrorMessage } from '@/common/http/errorMessages';
import { getSavedVideos, savedVideoRoute, type SavedVideoItem } from '@/features/playback/savedVideos';
import { useSavedVideos } from '@/features/playback/SavedVideosProvider';
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

export function LibraryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { isRestoring, user, sessionVersion, isCurrentSession } = useUser();
  const savedVideos = useSavedVideos();
  const [selectedTab, setSelectedTab] = useState<LibraryTab | null>(null);
  useEffect(() => setSelectedTab(null), [params.tab]);
  const tab = selectedTab ?? (params.tab === 'history' || params.tab === '시청 기록' ? '시청 기록' : '저장한 작품');
  const [items, setItems] = useState<SavedVideoItem[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [error, setError] = useState<unknown>(null);
  const [nextError, setNextError] = useState<unknown>(null);
  const [nextLoading, setNextLoading] = useState(false);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const nextPage = useRef(2);
  const [itemsOwner, setItemsOwner] = useState<{ uuid: string; version: number } | null>(null);
  const owner = user?.uuid ?? null;

  const loadPage = useCallback(async (page: number, replace: boolean, requestGeneration: number, version: number, userUuid: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
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
    const startedRevision = savedVideos.state.getSnapshot().revision;
    try {
      const result = await getSavedVideos(page);
      if (generation.current !== requestGeneration || !isCurrentSession(version) || user?.uuid !== userUuid) return;
      if (!savedVideos.state.accept(result.items.map((item) => ({ videoUuid: item.videoUuid, isSaved: true })), startedRevision)) {
        return;
      }
      setItems((current) => {
        const merged = replace ? [] : current;
        const seen = new Set(merged.map((item) => item.videoUuid));
        return [...merged, ...result.items.filter((item) => !seen.has(item.videoUuid))];
      });
      setHasNext(result.hasNext);
      nextPage.current = page + 1;
      setStatus('loaded');
      setItemsOwner({ uuid: userUuid, version });
      setError(null);
      setNextError(null);
    } catch (error) {
      if (generation.current !== requestGeneration || !isCurrentSession(version) || user?.uuid !== userUuid) return;
      if (replace) { setStatus('error'); setError(error); }
      else setNextError(error);
    } finally {
      if (generation.current === requestGeneration) {
        inFlight.current = false;
        setNextLoading(false);
      }
    }
  }, [isCurrentSession, savedVideos.state, user]);

  useFocusEffect(useCallback(() => {
    const requestGeneration = ++generation.current;
    inFlight.current = false;
    nextPage.current = 2;
    setItems([]);
    setItemsOwner(null);
    setHasNext(false);
    setNextError(null);
    if (tab !== '저장한 작품' || isRestoring || !owner) {
      setStatus('idle');
      return () => { generation.current += 1; };
    }
    void loadPage(1, true, requestGeneration, sessionVersion, owner);
    return () => { generation.current += 1; inFlight.current = false; };
  }, [tab, isRestoring, owner, sessionVersion, savedVideos.snapshot.revision, loadPage]));

  const loadNextPage = () => {
    if (!hasNext || nextLoading || status !== 'loaded' || !owner) return;
    const page = nextPage.current;
    void loadPage(page, false, generation.current, sessionVersion, owner);
  };
  const visibleItems = itemsOwner?.uuid === owner && itemsOwner.version === sessionVersion ? items : [];
  const ownsCurrentList = itemsOwner?.uuid === owner && itemsOwner.version === sessionVersion;
  const retry = () => {
    if (owner) void loadPage(1, true, generation.current, sessionVersion, owner);
  };

  return <Page header={<AppTopBar />} scroll={false} contentStyle={styles.page}>
    <SectionTitle eyebrow="MY COLLECTION" title="보관함" />
    <View style={styles.tabs} accessibilityRole="tablist">
      {(['저장한 작품', '시청 기록'] as const).map((item) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }} style={[styles.tab, tab === item && styles.activeTab]} onPress={() => setSelectedTab(item)}><AppText weight={tab === item ? 'semibold' : 'regular'} style={[styles.tabLabel, tab === item && styles.activeLabel]}>{item}</AppText></Pressable>)}
    </View>
    {tab === '시청 기록' ? <EmptyState title="시청 기록 기능은 준비 중이에요" description="시청 기록을 불러오는 기능은 아직 연결되지 않았어요." />
      : isRestoring ? <EmptyState title="로그인 상태를 확인하고 있어요" description="잠시만 기다려 주세요." />
      : !owner ? <EmptyState title="로그인이 필요해요" description="저장한 영상을 보려면 로그인해 주세요." action="로그인" onAction={() => router.push('/login')} />
      : status === 'loading' || status === 'idle' || (status === 'loaded' && !ownsCurrentList) ? <EmptyState title="저장한 영상을 불러오는 중이에요" description="잠시만 기다려 주세요." />
      : status === 'error' ? <EmptyState title="저장한 영상을 불러오지 못했어요" description={getErrorMessage(error)} action="다시 시도" onAction={retry} />
      : visibleItems.length === 0 ? <EmptyState title="저장한 영상이 없어요" description="마음에 드는 영상을 저장해 보세요." />
      : <FlatList data={visibleItems} keyExtractor={(item) => item.videoUuid} renderItem={({ item }) => {
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
