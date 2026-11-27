import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, FlatList, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, Button, EmptyState, Icon, LoadingState, Page } from '@/components/ui';
import { AppTopBar } from '@/components/AppTopBar';
import { createThemedStyles, useColors } from '@/common/theme/theme';
import { radius, spacing, textSizes } from '@/common/theme/tokens';
import { SessionChangedError } from '@/common/http/api';
import { getErrorMessage } from '@/common/http/errorMessages';
import { getSavedVideos, removeSavedVideo, saveVideo, savedVideoRoute, type SavedVideoItem, type WatchHistoryItem } from '@/features/playback/savedVideos';
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
type RemovedSaved = { item: SavedVideoItem; index: number };
type Notice = { text: string; tone: 'ok' | 'warn'; undo: RemovedSaved | null };

const NOTICE_MS = 3200;
const UNDO_NOTICE_MS = 6000;
// 보관함·시청 기록 API의 고정 페이지 크기. 저장 취소로 당겨진 서버 위치를 계산할 때 쓴다.
const PAGE_SIZE = 30;

export function LibraryScreen() {
  const styles = useStyles();
  const colors = useColors();
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
  // 마지막 페이지를 읽은 뒤 서버에서 빠진 저장 항목 수. 그만큼 뒤 항목이 앞 페이지로 당겨진다.
  const removedCount = useRef(0);
  const [itemsOwner, setItemsOwner] = useState<ItemsOwner | null>(null);
  const owner = user?.uuid ?? null;
  const currentTab = useRef(tab);
  const currentOwner = useRef(owner);
  currentTab.current = tab;
  currentOwner.current = owner;
  const [notice, setNotice] = useState<Notice | null>(null);
  const [writingUuid, setWritingUuid] = useState<string | null>(null);
  const writePending = useRef(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearNotice = useCallback(() => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = null;
    setNotice(null);
  }, []);
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);
  // 완료 알림은 3.2초, 되돌리기가 붙거나 주의 알림은 6초 보인다. 낭독 문장에는 되돌릴 수 있다는 말을 덧붙인다.
  const showNotice = (next: Notice) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(next);
    noticeTimer.current = setTimeout(() => { noticeTimer.current = null; setNotice(null); }, next.undo || next.tone === 'warn' ? UNDO_NOTICE_MS : NOTICE_MS);
    AccessibilityInfo.announceForAccessibility(next.undo ? `${next.text} 되돌리기 버튼으로 되돌릴 수 있어요.` : next.text);
  };

  const loadPage = useCallback(async (page: number, replace: boolean, requestGeneration: number, version: number, userUuid: string, requestTab: LibraryTab, removedAtRequest = 0) => {
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
      removedCount.current = replace ? 0 : removedCount.current - removedAtRequest;
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
    removedCount.current = 0;
    setItems([]);
    setItemsOwner(null);
    setHasNext(false);
    setNextError(null);
    writePending.current = false;
    setWritingUuid(null);
    clearNotice();
    if (isRestoring || !owner) {
      setStatus('idle');
      return () => { generation.current += 1; };
    }
    void loadPage(1, true, requestGeneration, sessionVersion, owner, tab);
    return () => { generation.current += 1; inFlight.current = false; };
  }, [tab, isRestoring, owner, sessionVersion, loadPage, clearNotice]));

  const loadNextPage = () => {
    if (!ownsCurrentList || !hasNext || nextLoading || status !== 'loaded' || isRestoring || !owner) return;
    // 저장 취소로 서버 목록이 당겨졌으면 아직 받지 않은 첫 항목이 있는 페이지부터 다시 읽는다. 겹치는 항목은 UUID로 거른다.
    const removed = removedCount.current;
    const page = Math.floor(Math.max(0, (nextPage.current - 1) * PAGE_SIZE - removed) / PAGE_SIZE) + 1;
    void loadPage(page, false, generation.current, sessionVersion, owner, tab, removed);
  };
  const ownsCurrentList = itemsOwner?.uuid === owner && itemsOwner.version === sessionVersion && itemsOwner.tab === tab;
  const visibleItems = ownsCurrentList ? items : [];
  const retry = () => {
    if (!isRestoring && owner) void loadPage(1, true, generation.current, sessionVersion, owner, tab);
  };

  // 저장 취소와 되돌리기. 서버에 반영된 뒤에만 목록을 바꾸고, 그사이 탭·계정·화면이 바뀌면 결과를 버린다.
  const writeSaved = async (item: SavedVideoItem, saved: boolean, onDone: () => void) => {
    if (writePending.current || isRestoring || !owner) return;
    const requestGeneration = generation.current;
    const version = sessionVersion;
    const userUuid = owner;
    const isCurrentWrite = () => generation.current === requestGeneration
      && isCurrentSession(version)
      && currentOwner.current === userUuid
      && currentTab.current === '저장한 작품';
    writePending.current = true;
    setWritingUuid(item.videoUuid);
    try {
      if (saved) await saveVideo(item.videoUuid, item.contentType);
      else await removeSavedVideo(item.videoUuid);
      if (isCurrentWrite()) onDone();
    } catch (error) {
      if (isCurrentWrite() && !(error instanceof SessionChangedError)) showNotice({ text: getErrorMessage(error), tone: 'warn', undo: null });
    } finally {
      if (isCurrentWrite()) {
        writePending.current = false;
        setWritingUuid(null);
      }
    }
  };
  const removeSaved = (item: SavedVideoItem) => {
    const index = items.findIndex((entry) => entry.videoUuid === item.videoUuid);
    void writeSaved(item, false, () => {
      removedCount.current += 1;
      setItems((current) => current.filter((entry) => entry.videoUuid !== item.videoUuid));
      showNotice({ text: '저장을 취소했어요.', tone: 'ok', undo: { item, index } });
    });
  };
  const undoRemove = (removed: RemovedSaved) => {
    clearNotice();
    void writeSaved(removed.item, true, () => {
      removedCount.current -= 1;
      setItems((current) => current.some((item) => item.videoUuid === removed.item.videoUuid)
        ? current
        : [...current.slice(0, removed.index), removed.item, ...current.slice(removed.index)]);
      showNotice({ text: '보관함에 다시 저장했어요.', tone: 'ok', undo: null });
    });
  };

  return <Page header={<AppTopBar />} scroll={false} contentStyle={styles.page}>
    <AppText weight="bold" accessibilityRole="header" style={styles.title}>보관함</AppText>
    <View style={styles.tabs} accessibilityRole="tablist">
      {(['저장한 작품', '시청 기록'] as const).map((item) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }} style={[styles.tab, tab === item && styles.activeTab]} onPress={() => setSelectedTab(item)}><AppText weight={tab === item ? 'semibold' : 'medium'} style={[styles.tabLabel, tab === item && styles.activeLabel]}>{item}</AppText></Pressable>)}
    </View>
    {isRestoring ? <LoadingState />
      : !owner ? <EmptyState title="로그인이 필요해요" description={tab === '시청 기록' ? '시청 기록을 보려면 로그인해 주세요.' : '저장한 영상을 보려면 로그인해 주세요.'} action="로그인" onAction={() => router.push('/auth/login')} />
      : status === 'loading' || status === 'idle' || (status === 'loaded' && !ownsCurrentList) ? <LoadingState />
      : status === 'error' ? <EmptyState title={tab === '시청 기록' ? '시청 기록을 불러오지 못했어요' : '저장한 영상을 불러오지 못했어요'} description={getErrorMessage(error)} action="다시 시도" onAction={retry} />
      : visibleItems.length === 0 ? <EmptyState title={tab === '시청 기록' ? '시청 기록이 없어요' : '저장한 영상이 없어요'} description={tab === '시청 기록' ? '영상을 시청하면 이곳에 표시돼요.' : '마음에 드는 영상을 저장해 보세요.'} />
      : <FlatList data={visibleItems} showsVerticalScrollIndicator={false} keyExtractor={(item) => item.videoUuid} renderItem={({ item }) => {
        const videoLabel = item.contentType === 'PREVIEW' ? '미리보기' : `${item.episodeNumber}화`;
        // TODO(backend): 시청 기록 응답에 진행 위치·완료 여부가 생기면 줄에 진행 막대를, 기록 삭제 API가 생기면 줄 끝에 × 지우기를 붙인다.
        return <View style={styles.row}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${item.dramaTitle} ${videoLabel}`} style={styles.rowMain} onPress={() => router.push(savedVideoRoute(item))}>
            {item.imageUrl ? <Image source={{ uri: resolveApiImageUrl(item.imageUrl) ?? undefined }} contentFit="cover" style={styles.image} /> : <View style={[styles.image, styles.imagePlaceholder]} />}
            <View style={styles.rowText}>
              <AppText weight="semibold" numberOfLines={1} style={styles.rowTitle}>{item.dramaTitle}</AppText>
              <View style={styles.metaRow}><AppText style={styles.meta}>{videoLabel}</AppText><AppText style={styles.meta}>·</AppText><AppText style={styles.meta}>{formatSavedDuration(item.durationMs)}</AppText></View>
            </View>
          </Pressable>
          {tab === '저장한 작품' ? <Pressable accessibilityRole="button" accessibilityLabel={`${item.dramaTitle} ${videoLabel} 저장 취소`}
            accessibilityState={{ disabled: writingUuid !== null, busy: writingUuid === item.videoUuid }} disabled={writingUuid !== null}
            onPress={() => removeSaved(item as SavedVideoItem)} style={[styles.rowAction, writingUuid !== null && styles.disabled]}>
            <Icon name="bookmark" size={20} color={colors.accent} />
          </Pressable> : null}
        </View>;
      }} onEndReached={loadNextPage} onEndReachedThreshold={0.4} ListFooterComponent={nextLoading ? <LoadingState compact /> : nextError ? <View style={styles.footer}><AppText>{getErrorMessage(nextError)}</AppText><Button label="다시 시도" onPress={loadNextPage} variant="secondary" /></View> : hasNext ? <Button label="더 보기" onPress={loadNextPage} variant="secondary" /> : null} style={styles.list} contentContainerStyle={styles.listContent} />}
    {notice ? <View style={[styles.notice, notice.tone === 'warn' && styles.noticeWarn]}>
      <Icon name={notice.tone === 'warn' ? 'alert-circle' : 'check-circle'} size={18} color={notice.tone === 'warn' ? colors.danger : colors.accent} />
      <AppText style={styles.noticeText}>{notice.text}</AppText>
      {notice.undo ? <Pressable accessibilityRole="button" accessibilityLabel="되돌리기" onPress={() => undoRemove(notice.undo!)} style={styles.noticeAction}>
        <AppText weight="semibold" style={styles.noticeActionText}>되돌리기</AppText>
      </Pressable> : null}
    </View> : null}
  </Page>;
}

const useStyles = createThemedStyles((colors) => ({
  page: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: 0, gap: 0 },
  title: { color: colors.text, ...textSizes.heading24 },
  tabs: { flexDirection: 'row', gap: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, marginTop: spacing.md, marginBottom: spacing.sm },
  tab: { minHeight: 46, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: colors.accent },
  tabLabel: { ...textSizes.label14, color: colors.muted },
  activeLabel: { color: colors.text },
  list: { flex: 1 }, listContent: { paddingBottom: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  image: { width: 112, height: 63, borderRadius: radius.sm, borderCurve: 'continuous', backgroundColor: colors.elevated }, imagePlaceholder: { backgroundColor: colors.elevated },
  rowText: { flex: 1, minWidth: 0, gap: spacing.xxs },
  rowTitle: { ...textSizes.body16 },
  metaRow: { flexDirection: 'row', gap: spacing.xxs },
  meta: { color: colors.muted, ...textSizes.caption12 },
  rowAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  footer: { alignItems: 'center', paddingVertical: spacing.md, gap: spacing.sm },
  notice: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingLeft: spacing.md, paddingRight: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  noticeWarn: { backgroundColor: colors.warn },
  noticeText: { flex: 1, color: colors.text, ...textSizes.label14 },
  noticeAction: { minHeight: 44, paddingHorizontal: spacing.sm, justifyContent: 'center' },
  noticeActionText: { color: colors.accent, ...textSizes.label14 },
}));
