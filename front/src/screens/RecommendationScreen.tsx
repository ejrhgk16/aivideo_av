import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { createVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlatList, Modal, Pressable, Share, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { AppText, Button, EmptyState, Icon, Page } from '@/components/ui';
import { EpisodeUnlockDialog } from '@/components/EpisodeUnlockDialog';
import { resolveApiImageUrl } from '@/common/media';
import { colors } from '@/common/theme/tokens';
import { getDramaContent, type DramaContent } from '@/features/drama/dramaContent';
import { getHomeCollection, type HomeCollection, type HomeCollectionDrama } from '@/features/home/homeContent';
import { getPreviewPlayback } from '@/features/playback/previewPlayback';
import { createRecommendationPreviewBuffer, recommendationPreviewKey, type RecommendationPreviewEntry } from '@/features/playback/recommendationPreviewBuffer';

type CollectionStatus = 'loading' | 'loaded' | 'error';
function RecommendationPreviewPlayer({
  player,
  trackListener,
  drama,
  content,
  saved,
  onError,
  onToggleSave,
  onOpenEpisodes,
  onShare,
}: {
  player: VideoPlayer;
  trackListener: (subscription: { remove(): void }) => { remove(): void };
  drama: HomeCollectionDrama;
  content: DramaContent | null;
  saved: boolean;
  onError: () => void;
  onToggleSave: () => void;
  onOpenEpisodes: () => void;
  onShare: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isPlaying, setIsPlaying] = useState(player.playing);
  const [position, setPosition] = useState(player.currentTime);
  const [duration, setDuration] = useState(player.duration);
  const [playbackRate, setPlaybackRate] = useState(player.playbackRate);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [lockedEpisode, setLockedEpisode] = useState<DramaContent['episodes'][number] | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onErrorRef = useRef(onError);
  const seeking = useRef(false);
  onErrorRef.current = onError;
  const episodes = [...(content?.episodes ?? [])].sort((first, second) => first.episodeNumber - second.episodeNumber);
  const firstEpisode = episodes[0] ?? null;
  const genres = drama.genres.map((genre) => genre.name).join(' · ') || '장르 정보 없음';
  const productionCompany = content?.productionCompany ?? null;

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  }, []);
  const showControls = useCallback(() => {
    clearHideTimer();
    setControlsVisible(true);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 4000);
  }, [clearHideTimer]);

  useEffect(() => {
    const playing = trackListener(player.addListener('playingChange', ({ isPlaying: next }) => setIsPlaying(next)));
    const status = trackListener(player.addListener('statusChange', ({ status: next }) => {
      if (next === 'error') onErrorRef.current();
      if (next === 'readyToPlay' && Number.isFinite(player.duration) && player.duration > 0) setDuration(player.duration);
    }));
    const time = trackListener(player.addListener('timeUpdate', ({ currentTime }) => {
      if (!seeking.current && Number.isFinite(currentTime)) setPosition(currentTime);
      if (Number.isFinite(player.duration) && player.duration > 0) setDuration(player.duration);
    }));
    const source = trackListener(player.addListener('sourceLoad', ({ duration: videoDuration }) => {
      if (Number.isFinite(videoDuration) && videoDuration > 0) setDuration(videoDuration);
    }));
    const rate = trackListener(player.addListener('playbackRateChange', ({ playbackRate: next }) => setPlaybackRate(next)));
    player.timeUpdateEventInterval = 0.5;
    showControls();
    return () => {
      playing.remove();
      status.remove();
      time.remove();
      source.remove();
      rate.remove();
      clearHideTimer();
    };
  }, [clearHideTimer, player, showControls]);

  const formatTime = (seconds: number) => {
    const whole = Math.floor(Math.max(0, seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  };
  const toggleControls = () => {
    if (controlsVisible) {
      clearHideTimer();
      setControlsVisible(false);
      setSpeedMenuOpen(false);
    } else showControls();
  };
  const togglePlayback = () => {
    if (isPlaying) player.pause();
    else player.play();
    showControls();
  };
  const watchFirstEpisode = () => {
    player.pause();
    if (!firstEpisode) {
      onOpenEpisodes();
    } else if (firstEpisode.pricePoints > 0) {
      setLockedEpisode(firstEpisode);
    } else {
      router.push({ pathname: '/episode/[id]', params: { id: firstEpisode.uuid, dramaId: drama.uuid } });
    }
  };
  const close = () => {
    player.pause();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return <>
    <LinearGradient pointerEvents="none" colors={['#03060BAA', 'transparent', '#070C13A8', '#070C13']} locations={[0, 0.33, 0.65, 1]} style={StyleSheet.absoluteFill} />
    <Pressable style={StyleSheet.absoluteFill} onPress={toggleControls} accessibilityLabel="재생 컨트롤 표시 또는 숨기기" />
    {controlsVisible && <>
      <View style={[styles.playerTopBar, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="닫기" style={styles.playerIconButton}><Icon name="x" color="#fff" /></Pressable>
        <View style={styles.playerHeading}><AppText style={styles.playerSubheading}>미리보기</AppText><AppText weight="semibold" numberOfLines={1} style={styles.playerHeadingTitle}>{drama.title}</AppText></View>
        <Pressable onPress={() => setSpeedMenuOpen((open) => !open)} accessibilityRole="button" accessibilityLabel="재생 속도" style={styles.playerSpeedButton}><AppText weight="semibold" style={styles.playerSpeedText}>{playbackRate}x</AppText></Pressable>
        <Pressable onPress={() => { setSpeedMenuOpen(false); setSettingsOpen(true); }} accessibilityRole="button" accessibilityLabel="더보기 설정" style={styles.playerIconButton}><Icon name="more-horizontal" color="#fff" size={24} /></Pressable>
      </View>
      {speedMenuOpen && <View style={[styles.playerSpeedMenu, { top: insets.top + 60 }]}>
        {[1, 1.25, 1.5, 2].map((rate) => <Pressable key={rate} onPress={() => { player.playbackRate = rate; setSpeedMenuOpen(false); showControls(); }} style={styles.playerSpeedOption} accessibilityRole="button" accessibilityLabel={`${rate}배속`}>
          <AppText style={[styles.playerSpeedOptionText, playbackRate === rate && styles.playerActiveSpeed]}>{rate}x</AppText>
        </Pressable>)}
      </View>}
      <View style={styles.playerSideActions}>
        <Pressable onPress={onToggleSave} accessibilityRole="button" accessibilityLabel={saved ? '저장 해제' : '작품 저장'} style={styles.playerSideAction}><Icon name="bookmark" color={saved ? colors.accent : '#fff'} /><AppText style={styles.playerActionLabel}>{saved ? '저장됨' : '저장'}</AppText></Pressable>
        <Pressable onPress={onOpenEpisodes} accessibilityRole="button" accessibilityLabel="전체 회차" style={styles.playerSideAction}><Icon name="layers" color="#fff" /><AppText style={styles.playerActionLabel}>회차</AppText></Pressable>
        <Pressable onPress={onShare} accessibilityRole="button" accessibilityLabel="작품 공유" style={styles.playerSideAction}><Icon name="share-2" color="#fff" /><AppText style={styles.playerActionLabel}>공유</AppText></Pressable>
      </View>
      <Pressable style={styles.playerPlayPause} accessibilityRole="button" accessibilityLabel={isPlaying ? '일시정지' : '재생'} onPress={togglePlayback}><Icon name={isPlaying ? 'pause' : 'play'} size={34} color="#fff" /></Pressable>
      <View style={[styles.playerBottomControls, { paddingBottom: insets.bottom + 12 }]}>
        {productionCompany ? <AppText style={styles.playerStudio}>{productionCompany}</AppText> : null}
        <Pressable onPress={() => { player.pause(); router.push({ pathname: '/drama/[id]', params: { id: drama.uuid } }); }} accessibilityRole="button" accessibilityLabel={`${drama.title} 작품 상세 보기`} style={styles.playerTitleButton}><AppText weight="bold" numberOfLines={1} style={styles.playerTitle}>{drama.title}</AppText><Icon name="chevron-right" color="#fff" size={21} /></Pressable>
        <View style={styles.playerEpisodeInfo}><AppText style={styles.playerEpisodeText}>{`${genres} · 미리보기`}</AppText><AppText style={styles.playerTime}>{formatTime(position)} / {formatTime(duration)}</AppText></View>
        <Pressable onPress={watchFirstEpisode} accessibilityRole="button" accessibilityLabel="1화부터 본편 보기" style={styles.playerWatchButton}><Icon name="play" size={16} color={colors.background} /><AppText weight="semibold" style={styles.playerWatchLabel}>1화부터 본편 보기</AppText><AppText style={styles.playerWatchMeta}>{firstEpisode ? `${firstEpisode.episodeNumber}화` : '회차 목록'}</AppText></Pressable>
        <Slider style={styles.playerSlider} minimumValue={0} maximumValue={Math.max(duration, 1)} value={position} disabled={duration <= 0} minimumTrackTintColor={colors.accent} maximumTrackTintColor="rgba(255,255,255,0.45)" thumbTintColor={colors.accent}
          onSlidingStart={() => { seeking.current = true; clearHideTimer(); }} onValueChange={setPosition} onSlidingComplete={(value) => { player.currentTime = value; seeking.current = false; showControls(); }} />
      </View>
    </>}
    <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)} statusBarTranslucent>
      <View style={styles.settingsBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setSettingsOpen(false)} accessibilityRole="button" accessibilityLabel="더보기 메뉴 닫기" />
        <View style={styles.settingsDialog} accessibilityRole="alert" accessibilityLabel="재생 설정">
          <View style={styles.settingsHeader}><AppText weight="bold" style={styles.settingsTitle}>재생 설정</AppText><Pressable onPress={() => setSettingsOpen(false)} accessibilityRole="button" accessibilityLabel="닫기" style={styles.settingsClose}><Icon name="x" color={colors.muted} /></Pressable></View>
          <View style={styles.settingsRow}><View style={styles.settingsCopy}><AppText weight="semibold">자막 표시</AppText><AppText style={styles.settingsNote}>자막 정보를 준비하고 있어요.</AppText></View><AppText style={styles.settingsDisabled}>준비 중</AppText></View>
          <View style={styles.settingsRow}><View style={styles.settingsCopy}><AppText weight="semibold">다음 화 자동 재생</AppText><AppText style={styles.settingsNote}>자동 재생 기능을 준비하고 있어요.</AppText></View><AppText style={styles.settingsDisabled}>준비 중</AppText></View>
          <View style={[styles.settingsRow, styles.lastSettingsRow]}><View style={styles.settingsCopy}><AppText weight="semibold">신고</AppText><AppText style={styles.settingsNote}>신고 기능을 준비하고 있어요.</AppText></View><AppText style={styles.settingsDisabled}>준비 중</AppText></View>
          <Button label="닫기" variant="secondary" onPress={() => setSettingsOpen(false)} style={styles.settingsDismiss} />
        </View>
      </View>
    </Modal>
    <EpisodeUnlockDialog
      episode={lockedEpisode}
      dramaTitle={drama.title}
      onClose={() => setLockedEpisode(null)}
      onCharge={() => { setLockedEpisode(null); router.push('/points'); }}
      onPurchased={(episode) => router.push({
        pathname: '/episode/[id]',
        params: { id: episode.uuid, dramaId: drama.uuid },
      })}
    />
  </>;
}

export function RecommendationScreen({ initialId }: { initialId?: string }) {
  const router = useRouter();
  const [collection, setCollection] = useState<HomeCollection | null>(null);
  const [status, setStatus] = useState<CollectionStatus>('loading');
  const [cardHeight, setCardHeight] = useState(0);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDrama, setActiveDrama] = useState<DramaContent | null>(null);
  const [screenFocused, setScreenFocused] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [buffer, setBuffer] = useState<ReturnType<typeof createRecommendationPreviewBuffer<VideoPlayer>> | null>(null);
  const [bufferEntries, setBufferEntries] = useState<RecommendationPreviewEntry<VideoPlayer>[]>([]);
  const [preparedPlayers, setPreparedPlayers] = useState<Map<string, VideoPlayer>>(() => new Map());
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollY = useRef(0);
  const settleGeneration = useRef(0);
  const activeIdRef = useRef<string | null>(null);
  const dramasRef = useRef<HomeCollectionDrama[]>([]);
  const cardHeightRef = useRef(0);
  const listRef = useRef<FlatList<HomeCollectionDrama>>(null);
  const pageInput = useRef<{
    startIndex: number;
    dragging: boolean;
    momentum: boolean;
    correcting: boolean;
    committed: boolean;
    targetIndex: number | null;
  } | null>(null);
  const settlePageRef = useRef<(offsetY: number) => void>(() => {});
  const scrollingRef = useRef(false);
  const focusedRef = useRef(false);
  const bufferRef = useRef(buffer);
  activeIdRef.current = activeId;
  scrollingRef.current = scrolling;
  focusedRef.current = screenFocused;
  bufferRef.current = buffer;
  cardHeightRef.current = cardHeight;

  useFocusEffect(useCallback(() => {
    const nextBuffer = createRecommendationPreviewBuffer<VideoPlayer>(
      (dramaId, videoId) => getPreviewPlayback(dramaId, videoId),
      (url) => createVideoPlayer(url),
      () => setBufferEntries(nextBuffer.snapshot()),
    );
    setBuffer(nextBuffer);
    setScreenFocused(true);
    focusedRef.current = true;
    return () => {
      focusedRef.current = false;
      clearSettleTimer();
      nextBuffer.invalidate();
      nextBuffer.pauseAll();
      setScreenFocused(false);
      pageInput.current = null;
      scrollingRef.current = false;
      setScrolling(false);
      setBuffer(null);
    };
  }, []));

  useEffect(() => {
    if (!buffer) {
      setBufferEntries([]);
      return;
    }
    const unsubscribe = buffer.subscribe(() => setBufferEntries(buffer.snapshot()));
    setBufferEntries(buffer.snapshot());
    return () => {
      unsubscribe();
      buffer.dispose();
    };
  }, [buffer]);

  useEffect(() => {
    buffer?.releasePending();
  }, [buffer, bufferEntries]);

  useEffect(() => {
    let active = true;
    void getHomeCollection('RECOMMENDATION_DAILY').then(
      (result) => {
        if (active) {
          const ordered = [...result.dramas].sort((first, second) => {
            if (first.uuid === initialId) return -1;
            if (second.uuid === initialId) return 1;
            return first.displayOrder - second.displayOrder;
          });
          setCollection(result);
          setActiveId(ordered[0]?.uuid ?? null);
          setStatus('loaded');
        }
      },
      () => { if (active) setStatus('error'); },
    );
    return () => { active = false; };
  }, [initialId]);

  const dramas = useMemo(() => [...(collection?.dramas ?? [])].sort((first, second) => {
    if (first.uuid === initialId) return -1;
    if (second.uuid === initialId) return 1;
    return first.displayOrder - second.displayOrder;
  }), [collection, initialId]);
  dramasRef.current = dramas;
  const initialIndex = Math.max(0, dramas.findIndex((drama) => drama.uuid === initialId));
  const openEpisodes = (drama: HomeCollectionDrama) => router.push({
    pathname: '/drama/[id]',
    params: { id: drama.uuid, tab: 'episodes' },
  });
  const toggleSave = (id: string) => setSavedIds((ids) =>
    ids.includes(id) ? ids.filter((savedId) => savedId !== id) : [...ids, id]);
  const shareDrama = (drama: HomeCollectionDrama) => Share.share({
    title: drama.title,
    message: [drama.title, drama.shortDescription].filter(Boolean).join('\n'),
  });

  const previewTargets = useMemo(() => {
    const index = dramas.findIndex((drama) => drama.uuid === activeId);
    if (index < 0) return [];
    return dramas.slice(Math.max(0, index - 1), index + 2).flatMap((drama) => {
      const preview = drama.previewVideos[0];
      return preview ? [{ dramaId: drama.uuid, videoId: preview.uuid }] : [];
    });
  }, [activeId, dramas]);

  useEffect(() => {
    if (screenFocused) buffer?.retain(previewTargets);
  }, [buffer, previewTargets, screenFocused]);

  useEffect(() => {
    const retainedPlayers = new Map(bufferEntries.flatMap((entry) => entry.player
      ? [[recommendationPreviewKey(entry.target), entry.player] as const]
      : []));
    setPreparedPlayers((previous) => {
      const next = new Map([...previous].filter(([key, player]) => retainedPlayers.get(key) === player));
      let changed = next.size !== previous.size;
      for (const entry of bufferEntries) {
        if (entry.player?.status === 'readyToPlay') {
          const key = recommendationPreviewKey(entry.target);
          if (next.get(key) !== entry.player) {
            next.set(key, entry.player);
            changed = true;
          }
        }
      }
      return changed ? next : previous;
    });
    const subscriptions = bufferEntries.flatMap((entry) => entry.player ? [
      buffer?.trackSubscription(entry.target, entry.player, entry.player.addListener('statusChange', ({ status }) => {
        const key = recommendationPreviewKey(entry.target);
        if (status === 'readyToPlay') {
          setPreparedPlayers((players) => players.get(key) === entry.player ? players : new Map(players).set(key, entry.player!));
        } else if (status === 'error') {
          buffer?.setUnavailable(entry.target, entry.player!);
        }
      })),
    ] : []);
    return () => { for (const subscription of subscriptions) subscription?.remove(); };
  }, [buffer, bufferEntries]);

  useEffect(() => {
    if (!activeId) {
      setActiveDrama(null);
      return;
    }
    let current = true;
    setActiveDrama(null);
    void getDramaContent(activeId).then(
      (drama) => { if (current) setActiveDrama(drama); },
      () => { if (current) setActiveDrama(null); },
    );
    return () => { current = false; };
  }, [activeId]);

  const clearSettleTimer = () => {
    settleGeneration.current += 1;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = null;
  };
  const beginPageInput = (dragging = false) => {
    if (pageInput.current?.committed && dragging) {
      clearSettleTimer();
      pageInput.current = null;
    }
    if (pageInput.current) {
      if (dragging) pageInput.current.dragging = true;
      return;
    }
    const startIndex = dramasRef.current.findIndex((drama) => drama.uuid === activeIdRef.current);
    if (startIndex < 0) return;
    pageInput.current = { startIndex, dragging, momentum: false, correcting: false, committed: false, targetIndex: null };
    scrollingRef.current = true;
    setScrolling(true);
  };
  const settleOnPage = (offsetY: number) => {
    const input = pageInput.current;
    const latestDramas = dramasRef.current;
    const latestCardHeight = cardHeightRef.current;
    if (!input || input.committed || input.dragging || input.momentum || latestCardHeight <= 0 || latestDramas.length === 0) return;
    const proposedIndex = Math.round(offsetY / latestCardHeight);
    const index = input.correcting && input.targetIndex !== null ? input.targetIndex
      : Math.max(0, Math.min(latestDramas.length - 1,
        Math.max(input.startIndex - 1, Math.min(input.startIndex + 1, proposedIndex))));
    const targetOffset = index * latestCardHeight;
    if (Math.abs(offsetY - targetOffset) > 1 && listRef.current) {
      input.correcting = true;
      input.targetIndex = index;
      listRef.current.scrollToOffset({ offset: targetOffset, animated: true });
      return;
    }
    const nextId = latestDramas[index]?.uuid ?? null;
    const previousId = activeIdRef.current;
    if (nextId && nextId !== previousId) {
      const previousDrama = latestDramas.find((drama) => drama.uuid === previousId);
      const previousPreview = previousDrama?.previewVideos[0];
      if (previousPreview) bufferRef.current?.resetToBeginning({ dramaId: previousDrama.uuid, videoId: previousPreview.uuid });
      activeIdRef.current = nextId;
      setActiveId(nextId);
    }
    lastScrollY.current = targetOffset;
    input.committed = true;
    input.targetIndex = index;
    scrollingRef.current = false;
    setScrolling(false);
    scheduleSettle(targetOffset);
  };
  settlePageRef.current = settleOnPage;
  const scheduleSettle = (offsetY: number) => {
    lastScrollY.current = offsetY;
    clearSettleTimer();
    const generation = settleGeneration.current;
    settleTimer.current = setTimeout(() => {
      if (generation !== settleGeneration.current || !focusedRef.current) return;
      settleTimer.current = null;
      if (pageInput.current?.committed) {
        pageInput.current = null;
        return;
      }
      if (pageInput.current?.dragging || pageInput.current?.momentum) return;
      settlePageRef.current(lastScrollY.current);
    }, 150);
  };
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    let offsetY = event.nativeEvent.contentOffset.y;
    if (!pageInput.current && offsetY !== lastScrollY.current) beginPageInput();
    const input = pageInput.current;
    if (input?.committed) {
      const committedOffset = (input.targetIndex ?? input.startIndex) * cardHeightRef.current;
      if (Math.abs(offsetY - committedOffset) > 1) listRef.current?.scrollToOffset({ offset: committedOffset, animated: false });
      offsetY = committedOffset;
      scheduleSettle(offsetY);
      return;
    }
    if (input && !input.correcting && cardHeightRef.current > 0) {
      const minOffset = Math.max(0, input.startIndex - 1) * cardHeightRef.current;
      const maxOffset = Math.min(dramasRef.current.length - 1, input.startIndex + 1) * cardHeightRef.current;
      const boundedOffset = Math.max(minOffset, Math.min(maxOffset, offsetY));
      if (Math.abs(offsetY - boundedOffset) > 1) {
        listRef.current?.scrollToOffset({ offset: boundedOffset, animated: false });
        offsetY = boundedOffset;
      }
    }
    lastScrollY.current = offsetY;
    if (!pageInput.current?.dragging && !pageInput.current?.momentum) scheduleSettle(offsetY);
  };
  const handleScrollEndDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageInput.current?.committed) return;
    if (pageInput.current) pageInput.current.dragging = false;
    scheduleSettle(event.nativeEvent.contentOffset.y);
  };
  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    clearSettleTimer();
    const input = pageInput.current;
    if (input?.committed) {
      const targetOffset = (input.targetIndex ?? input.startIndex) * cardHeightRef.current;
      if (Math.abs(event.nativeEvent.contentOffset.y - targetOffset) > 1) {
        listRef.current?.scrollToOffset({ offset: targetOffset, animated: false });
      }
      lastScrollY.current = targetOffset;
      scheduleSettle(targetOffset);
      return;
    }
    if (input) input.momentum = false;
    settleOnPage(event.nativeEvent.contentOffset.y);
  };

  useEffect(() => () => clearSettleTimer(), []);

  const activeDramaForPreview = dramas.find((drama) => drama.uuid === activeId);
  const activePreviewTarget = useMemo(() => activeDramaForPreview?.previewVideos[0]
    ? { dramaId: activeDramaForPreview.uuid, videoId: activeDramaForPreview.previewVideos[0].uuid }
    : null, [activeDramaForPreview]);
  const activeEntry = activePreviewTarget ? buffer?.get(activePreviewTarget) : undefined;
  const activePlayer = activeEntry?.kind === 'ready' ? activeEntry.player : undefined;
  const cardState = useMemo(() => ({
    screenFocused,
    scrolling,
    activeId,
    activeEntry,
    activePlayer,
    activeDrama,
    savedIds,
    buffer,
    bufferEntries,
    preparedPlayers,
  }), [screenFocused, scrolling, activeId, activeEntry, activePlayer, activeDrama, savedIds, buffer, bufferEntries, preparedPlayers]);

  useEffect(() => {
    if (!buffer || !activePreviewTarget || !activePlayer || !screenFocused) return;
    const manager = buffer;
    const entry = activeEntry;
    const player = activePlayer;
    let live = true;
    let started = false;
    const startWhenReady = (status: VideoPlayer['status']) => {
      if (!live || started || !focusedRef.current) return;
      if (activeIdRef.current !== activePreviewTarget.dramaId || bufferRef.current !== manager) return;
      if (manager.get(activePreviewTarget) !== entry || entry?.player !== player || status !== 'readyToPlay') return;
      started = true;
      player.play();
    };
    const handleError = () => {
      if (!live || !focusedRef.current || activeIdRef.current !== activePreviewTarget.dramaId || bufferRef.current !== manager) return;
      if (manager.get(activePreviewTarget) === entry) manager.setUnavailable(activePreviewTarget, player);
    };
    if (player.status === 'error') {
      handleError();
      return;
    }
    const status = manager.trackSubscription(activePreviewTarget, player, player.addListener('statusChange', ({ status: next }) => {
      if (next === 'error') handleError();
      else startWhenReady(next);
    }));
    startWhenReady(player.status);
    return () => {
      live = false;
      status.remove();
    };
  }, [activeEntry, activePlayer, activePreviewTarget, buffer, screenFocused]);

  return <Page scroll={false} contentStyle={styles.pageContent}>
    {status === 'loading' ? <EmptyState title="추천 작품 불러오는 중" description="잠시만 기다려 주세요." />
      : status === 'error' ? <EmptyState title="추천 작품을 불러오지 못했어요" description="잠시 후 다시 확인해 주세요." />
        : dramas.length === 0 ? <EmptyState title="오늘의 추천 작품이 없어요" description="새로운 작품을 준비하고 있어요." />
          : <View style={styles.feed} onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}>
            {cardHeight > 0 ? <FlatList
              ref={listRef}
              data={dramas}
              keyExtractor={(drama) => drama.uuid}
              initialScrollIndex={initialIndex}
              getItemLayout={(_, index) => ({ length: cardHeight, offset: cardHeight * index, index })}
              snapToInterval={cardHeight}
              disableIntervalMomentum
              decelerationRate="fast"
              showsVerticalScrollIndicator={false}
              extraData={cardState}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              onScrollBeginDrag={() => { clearSettleTimer(); beginPageInput(true); }}
              onScrollEndDrag={handleScrollEndDrag}
              onMomentumScrollBegin={() => {
                clearSettleTimer();
                if (pageInput.current?.committed) {
                  scheduleSettle(lastScrollY.current);
                  return;
                }
                beginPageInput();
                if (pageInput.current) pageInput.current.momentum = true;
              }}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              renderItem={({ item: drama }) => {
                const posterUrl = resolveApiImageUrl(drama.imageUrls.poster);
                const preview = drama.previewVideos[0];
                const previewTarget = preview ? { dramaId: drama.uuid, videoId: preview.uuid } : null;
                const entry = previewTarget ? buffer?.get(previewTarget) : undefined;
                const key = previewTarget ? recommendationPreviewKey(previewTarget) : '';
                const player = entry?.kind === 'ready' ? entry.player : undefined;
                const mountVideo = screenFocused && Boolean(player);
                const showVideo = mountVideo && preparedPlayers.get(key) === player;
                const showControls = showVideo && !scrolling && activeId === drama.uuid && activePlayer === player;
                const showPoster = !screenFocused || !preview || entry?.kind === 'unavailable';
                return <View style={[styles.card, { height: cardHeight }, showVideo && styles.cardPreview]}>
                  {mountVideo && player ? <VideoView
                    key={key}
                    player={player}
                    nativeControls={false}
                    contentFit="contain"
                    surfaceType="textureView"
                    pointerEvents="none"
                    style={[StyleSheet.absoluteFill, styles.playerVideo, { opacity: showVideo ? 1 : 0 }]}
                  /> : null}
                  {showPoster && (posterUrl
                    ? <Image source={{ uri: posterUrl }} accessibilityLabel={`${drama.title} 표지`} contentFit="cover" style={StyleSheet.absoluteFill} />
                    : <View style={[StyleSheet.absoluteFill, styles.placeholder]} />)}
                  {showControls && activeDramaForPreview && activePreviewTarget && <RecommendationPreviewPlayer
                    key={recommendationPreviewKey(activePreviewTarget)}
                    player={activePlayer!}
                    trackListener={(subscription) => buffer!.trackSubscription(activePreviewTarget, activePlayer!, subscription)}
                    drama={drama}
                    content={activeDrama}
                    saved={savedIds.includes(drama.uuid)}
                    onError={() => {
                      if (focusedRef.current && activeIdRef.current === drama.uuid && bufferRef.current === buffer) {
                        buffer?.setUnavailable(activePreviewTarget, activePlayer!);
                      }
                    }}
                    onToggleSave={() => toggleSave(drama.uuid)}
                    onOpenEpisodes={() => openEpisodes(drama)}
                    onShare={() => { void shareDrama(drama); }}
                  />}
                </View>;
              }}
            /> : <View style={styles.feedPlaceholder} />}
          </View>}
  </Page>;
}

const styles = StyleSheet.create({
  pageContent: { flex: 1, maxWidth: '100%', alignSelf: 'stretch', padding: 0, paddingBottom: 0, gap: 0 },
  feed: { flex: 1, overflow: 'hidden', backgroundColor: colors.background },
  feedPlaceholder: { flex: 1, backgroundColor: colors.background },
  card: { width: '100%', maxWidth: 500, alignSelf: 'center', overflow: 'hidden', justifyContent: 'space-between', backgroundColor: '#000' },
  cardPreview: { backgroundColor: 'transparent' },
  placeholder: { backgroundColor: '#000' },
  playerVideo: { width: '100%', height: '100%' },
  playerTopBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 18, backgroundColor: 'rgba(0,0,0,0.45)' },
  playerIconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  playerHeading: { flex: 1, gap: 1 },
  playerSubheading: { color: '#D2D5D9', fontSize: 11 },
  playerHeadingTitle: { color: '#fff', fontSize: 13 },
  playerSpeedButton: { minWidth: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  playerSpeedText: { color: '#fff', fontSize: 13 },
  playerSpeedMenu: { position: 'absolute', right: 67, zIndex: 5, backgroundColor: '#15171B', borderRadius: 12, padding: 5 },
  playerSpeedOption: { minWidth: 68, minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  playerSpeedOptionText: { color: '#fff', fontSize: 13 },
  playerActiveSpeed: { color: colors.accent },
  playerSideActions: { position: 'absolute', right: 12, bottom: 224, alignItems: 'center', gap: 15 },
  playerSideAction: { minWidth: 50, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 4 },
  playerActionLabel: { color: '#fff', fontSize: 10, lineHeight: 14 },
  playerPlayPause: { position: 'absolute', top: '43%', alignSelf: 'center', width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(0,0,0,0.48)', alignItems: 'center', justifyContent: 'center' },
  playerBottomControls: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 25, backgroundColor: 'rgba(0,0,0,0.55)' },
  playerStudio: { color: '#C4CDC1', fontSize: 9, lineHeight: 14, letterSpacing: 1.2 },
  playerTitleButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7 },
  playerTitle: { flex: 1, color: '#fff', fontSize: 21, lineHeight: 28 },
  playerEpisodeInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  playerEpisodeText: { color: '#fff', fontSize: 12 },
  playerTime: { color: '#fff', fontSize: 12, fontVariant: ['tabular-nums'] },
  playerWatchButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 7, paddingHorizontal: 12, backgroundColor: colors.accent, borderRadius: 8 },
  playerWatchLabel: { color: colors.background, fontSize: 12 },
  playerWatchMeta: { marginLeft: 'auto', paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#16200733', color: colors.background, fontSize: 10 },
  playerSlider: { width: '100%', height: 34, marginTop: 2 },
  settingsBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22, backgroundColor: '#000B' },
  settingsDialog: { width: '100%', maxWidth: 420, padding: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, borderCurve: 'continuous' },
  settingsHeader: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  settingsTitle: { fontSize: 20, lineHeight: 28 },
  settingsClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  settingsRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  lastSettingsRow: { borderBottomWidth: 0 },
  settingsCopy: { flex: 1, gap: 3 },
  settingsNote: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  settingsDisabled: { color: colors.muted, fontSize: 11 },
  settingsDismiss: { marginTop: 10 },
});
