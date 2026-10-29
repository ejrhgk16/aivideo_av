import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { createVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlatList, Modal, PanResponder, Platform, Pressable, Share, StyleSheet, View, type GestureResponderEvent, type NativeScrollEvent, type NativeSyntheticEvent, type PanResponderGestureState } from 'react-native';
import { AppText, Button, EmptyState, Icon, Page } from '@/components/ui';
import { EpisodeUnlockDialog } from '@/components/EpisodeUnlockDialog';
import { resolveApiImageUrl } from '@/common/media';
import { colors } from '@/common/theme/tokens';
import { getDramaContent, type DramaContent } from '@/features/drama/dramaContent';
import { getHomeCollection, type HomeCollection, type HomeCollectionDrama } from '@/features/home/homeContent';
import { getPreviewPlayback } from '@/features/playback/previewPlayback';
import { createRecommendationPreviewBuffer, recommendationPreviewKey, type RecommendationPreviewEntry } from '@/features/playback/recommendationPreviewBuffer';

type CollectionStatus = 'loading' | 'loaded' | 'error';
const PAGE_SETTLE_TOLERANCE = 4;
const PAGE_TRANSITION_MS = 220;
const WHEEL_QUIET_MS = 150;
const DRAG_ACTIVATION_PX = 10;
const FAST_SWIPE_MIN_DISTANCE = 50;
const FAST_SWIPE_MIN_VELOCITY = 0.5;
const FAST_SWIPE_FRESH_MS = 100;
const WHEEL_THRESHOLD_PX = 100;
type FeedEventTarget = {
  addEventListener(name: 'wheel', listener: (event: WheelEvent) => void, options: AddEventListenerOptions): void;
  removeEventListener(name: 'wheel', listener: (event: WheelEvent) => void): void;
};
function RecommendationPreviewPlayer({
  player,
  moving,
  trackListener,
  drama,
  content,
  saved,
  onError,
  onToggleSave,
  onOpenEpisodes,
  onShare,
  onSeekTouch,
}: {
  player: VideoPlayer;
  moving: boolean;
  trackListener: (subscription: { remove(): void }) => { remove(): void };
  drama: HomeCollectionDrama;
  content: DramaContent | null;
  saved: boolean;
  onError: () => void;
  onToggleSave: () => void;
  onOpenEpisodes: () => void;
  onShare: () => void;
  onSeekTouch: (active: boolean) => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isPlaying, setIsPlaying] = useState(player.playing);
  const [position, setPosition] = useState(player.currentTime);
  const [duration, setDuration] = useState(player.duration);
  const [playbackRate, setPlaybackRate] = useState(player.playbackRate);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [touchActive, setTouchActive] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [lockedEpisode, setLockedEpisode] = useState<DramaContent['episodes'][number] | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retainTouchControls = useRef(false);
  const onErrorRef = useRef(onError);
  const seeking = useRef(false);
  const seekTouchActive = useRef(false);
  onErrorRef.current = onError;
  const episodes = [...(content?.episodes ?? [])].sort((first, second) => first.episodeNumber - second.episodeNumber);
  const firstEpisode = episodes[0] ?? null;
  const genres = drama.genres.map((genre) => genre.name).join(' · ') || '장르 정보 없음';
  const productionCompany = content?.productionCompany ?? null;
  const updateSeekTouch = (active: boolean) => {
    seekTouchActive.current = active;
    onSeekTouch(active || seeking.current);
  };
  const seekTouchHandlers = {
    onTouchStart: () => updateSeekTouch(true),
    onTouchEnd: () => updateSeekTouch(false),
    onTouchCancel: () => {
      seeking.current = false;
      updateSeekTouch(false);
    },
  };
  useEffect(() => () => onSeekTouch(false), []);

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  }, []);
  const beginTouch = () => {
    if (touchTimer.current) clearTimeout(touchTimer.current);
    touchTimer.current = null;
    retainTouchControls.current = controlsVisible;
    setTouchActive(true);
  };
  const finishTouch = () => {
    if (touchTimer.current) clearTimeout(touchTimer.current);
    touchTimer.current = setTimeout(() => {
      touchTimer.current = null;
      retainTouchControls.current = false;
      setTouchActive(false);
    }, 0);
  };
  useEffect(() => () => {
    if (touchTimer.current) clearTimeout(touchTimer.current);
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

  return <View style={[StyleSheet.absoluteFill, { opacity: controlsVisible && !moving ? 1 : 0 }]}
    pointerEvents={moving && !touchActive ? 'none' : 'box-none'} onTouchStart={beginTouch} onTouchEnd={finishTouch} onTouchCancel={finishTouch}>
    <LinearGradient pointerEvents="none" colors={['#03060BAA', 'transparent', '#070C13A8', '#070C13']} locations={[0, 0.33, 0.65, 1]} style={StyleSheet.absoluteFill} />
    <Pressable style={StyleSheet.absoluteFill} onPress={toggleControls} accessibilityLabel="재생 컨트롤 표시 또는 숨기기" />
    {(controlsVisible || (touchActive && retainTouchControls.current)) && <>
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
        <Slider {...seekTouchHandlers} style={styles.playerSlider} minimumValue={0} maximumValue={Math.max(duration, 1)} value={position} disabled={duration <= 0} minimumTrackTintColor={colors.accent} maximumTrackTintColor="rgba(255,255,255,0.45)" thumbTintColor={colors.accent}
          onSlidingStart={() => { seeking.current = true; onSeekTouch(true); clearHideTimer(); }} onValueChange={setPosition} onSlidingComplete={(value) => { player.currentTime = value; seeking.current = false; updateSeekTouch(false); showControls(); }} />
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
  </View>;
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
  const activeIdRef = useRef<string | null>(null);
  const dramasRef = useRef<HomeCollectionDrama[]>([]);
  const cardHeightRef = useRef(0);
  const listRef = useRef<FlatList<HomeCollectionDrama>>(null);
  const feedRef = useRef<View | null>(null);
  const actualOffsetRef = useRef(0);
  const requestedOffsetRef = useRef(0);
  const committedIndexRef = useRef(0);
  const contentHeightRef = useRef(0);
  const pendingAlignmentRef = useRef<{ height: number; generation: number; requested: boolean } | null>(null);
  const generationRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const motionRef = useRef<{ from: number; targetIndex: number; generation: number; framesDone: boolean } | null>(null);
  const gestureRef = useRef<{ startIndex: number; startOffset: number; active: boolean; handled: boolean; lastMoveAt: number | null; lastVelocityY: number } | null>(null);
  const gestureBlockedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const wheelRef = useRef({ accumulated: 0, consumed: false, quiet: true });
  const wheelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelGenerationRef = useRef(0);
  const panCallbacksRef = useRef<{ shouldStart: (event: GestureResponderEvent, gesture: PanResponderGestureState) => boolean; grant: (event: GestureResponderEvent, gesture: PanResponderGestureState) => void; move: (event: GestureResponderEvent, gesture: PanResponderGestureState) => void; release: (event: GestureResponderEvent, gesture: PanResponderGestureState) => void; terminate: (event: GestureResponderEvent, gesture: PanResponderGestureState) => void }>({ shouldStart: () => false, grant: () => {}, move: () => {}, release: () => {}, terminate: () => {} });
  const wheelCallbackRef = useRef<(event: WheelEvent) => void>(() => {});
  const focusedRef = useRef(false);
  const bufferRef = useRef(buffer);
  activeIdRef.current = activeId;
  focusedRef.current = screenFocused;
  bufferRef.current = buffer;
  cardHeightRef.current = cardHeight;

  const clearWheelTimer = () => {
    wheelGenerationRef.current += 1;
    if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    wheelTimerRef.current = null;
  };
  const stopMotion = () => {
    generationRef.current += 1;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    motionRef.current = null;
    gestureRef.current = null;
    pendingAlignmentRef.current = null;
    gestureBlockedRef.current = false;
    suppressClickRef.current = false;
    clearWheelTimer();
    wheelRef.current = { accumulated: 0, consumed: false, quiet: true };
    setScrolling(false);
  };
  const commitPage = (index: number) => {
    const latestDramas = dramasRef.current;
    const nextIndex = Math.max(0, Math.min(latestDramas.length - 1, index));
    const nextId = latestDramas[nextIndex]?.uuid ?? null;
    const previousId = activeIdRef.current;
    if (nextId && nextId !== previousId) {
      const previousDrama = latestDramas.find((drama) => drama.uuid === previousId);
      const previousPreview = previousDrama?.previewVideos[0];
      if (previousPreview) bufferRef.current?.resetToBeginning({ dramaId: previousDrama.uuid, videoId: previousPreview.uuid });
      activeIdRef.current = nextId;
      committedIndexRef.current = nextIndex;
      setActiveId(nextId);
    }
    requestedOffsetRef.current = nextIndex * cardHeightRef.current;
    if (wheelRef.current.quiet) wheelRef.current = { accumulated: 0, consumed: false, quiet: true };
    motionRef.current = null;
    frameRef.current = null;
    setScrolling(false);
  };
  const finishIfArrived = () => {
    const motion = motionRef.current;
    const targetOffset = motion ? motion.targetIndex * cardHeightRef.current : 0;
    if (!motion || !motion.framesDone || Math.abs(actualOffsetRef.current - targetOffset) > PAGE_SETTLE_TOLERANCE) return;
    commitPage(motion.targetIndex);
  };
  const setRequestedOffset = (offset: number) => {
    const nextOffset = Math.max(0, offset);
    requestedOffsetRef.current = nextOffset;
    listRef.current?.scrollToOffset({ offset: nextOffset, animated: false });
  };
  const animateToPage = (target: number) => {
    if (motionRef.current || pendingAlignmentRef.current || cardHeightRef.current <= 0 || dramasRef.current.length === 0) return;
    const targetIndex = Math.max(0, Math.min(dramasRef.current.length - 1, target));
    const targetOffset = targetIndex * cardHeightRef.current;
    if (Math.abs(actualOffsetRef.current - targetOffset) <= PAGE_SETTLE_TOLERANCE
      && Math.abs(requestedOffsetRef.current - targetOffset) <= PAGE_SETTLE_TOLERANCE) {
      commitPage(targetIndex);
      return;
    }
    const motion = { from: requestedOffsetRef.current, targetIndex, generation: ++generationRef.current, framesDone: false };
    motionRef.current = motion;
    setScrolling(true);
    const startedAt = performance.now();
    const frame = (now: number) => {
      if (!focusedRef.current || motionRef.current !== motion || generationRef.current !== motion.generation) return;
      const progress = Math.min(1, Math.max(0, (now - startedAt) / PAGE_TRANSITION_MS));
      const eased = 1 - Math.pow(1 - progress, 3);
      setRequestedOffset(motion.from + (targetOffset - motion.from) * eased);
      motion.framesDone = progress === 1;
      if (motion.framesDone) {
        frameRef.current = null;
        finishIfArrived();
      } else frameRef.current = requestAnimationFrame(frame);
    };
    frameRef.current = requestAnimationFrame(frame);
  };
  const isWebInteractiveTarget = (target: EventTarget | null) => {
    if (Platform.OS !== 'web' || typeof Element === 'undefined' || !(target instanceof Element)) return false;
    return Boolean(target.closest('button, a, input, textarea, select, [role="button"], [role="slider"], [role="alert"], [data-feed-interactive]'));
  };
  const handleWheel = (event: WheelEvent) => {
    if (!focusedRef.current || Platform.OS !== 'web' || isWebInteractiveTarget(event.target)
      || Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.deltaY === 0) return;
    event.preventDefault();
    if (pendingAlignmentRef.current) return;
    if (gestureRef.current?.active) return;
    const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? cardHeightRef.current : 1;
    const wheel = wheelRef.current;
    wheel.quiet = false;
    clearWheelTimer();
    const wheelGeneration = wheelGenerationRef.current;
    wheelTimerRef.current = setTimeout(() => {
      if (wheelGeneration !== wheelGenerationRef.current || !focusedRef.current) return;
      wheelTimerRef.current = null;
      wheel.quiet = true;
      if (!motionRef.current) wheelRef.current = { accumulated: 0, consumed: false, quiet: true };
    }, WHEEL_QUIET_MS);
    if (motionRef.current) {
      wheel.consumed = true;
      return;
    }
    if (wheel.consumed) return;
    const delta = event.deltaY * scale;
    wheel.accumulated = Math.sign(wheel.accumulated) === Math.sign(delta) ? wheel.accumulated + delta : delta;
    if (Math.abs(wheel.accumulated) < WHEEL_THRESHOLD_PX) return;
    wheel.consumed = true;
    animateToPage(committedIndexRef.current + Math.sign(wheel.accumulated));
  };
  wheelCallbackRef.current = handleWheel;
  panCallbacksRef.current = {
    shouldStart: (_event, gesture) => !motionRef.current && !pendingAlignmentRef.current && focusedRef.current
      && !gestureBlockedRef.current
      && !(wheelRef.current.consumed && !wheelRef.current.quiet)
      && Math.abs(gesture.dy) >= DRAG_ACTIVATION_PX && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    grant: () => {
      if (motionRef.current || pendingAlignmentRef.current) return;
      clearWheelTimer();
      wheelRef.current = { accumulated: 0, consumed: false, quiet: true };
      gestureRef.current = { startIndex: committedIndexRef.current, startOffset: requestedOffsetRef.current, active: true, handled: false, lastMoveAt: null, lastVelocityY: 0 };
      if (Platform.OS === 'web') suppressClickRef.current = true;
      setScrolling(true);
    },
    move: (_event, gesture) => {
      const current = gestureRef.current;
      if (!current?.active || motionRef.current || cardHeightRef.current <= 0) return;
      current.lastMoveAt = performance.now();
      current.lastVelocityY = Number.isFinite(gesture.vy) ? gesture.vy : 0;
      const minIndex = Math.max(0, current.startIndex - 1);
      const maxIndex = Math.min(dramasRef.current.length - 1, current.startIndex + 1);
      const minOffset = minIndex * cardHeightRef.current;
      const maxOffset = maxIndex * cardHeightRef.current;
      const offset = Math.max(minOffset, Math.min(maxOffset, current.startOffset - gesture.dy));
      setRequestedOffset(offset);
    },
    release: (_event, gesture) => {
      const current = gestureRef.current;
      if (!current?.active || current.handled) return;
      current.handled = true;
      current.active = false;
      const distance = Math.abs(gesture.dy);
      const moveAge = current.lastMoveAt === null ? Infinity : performance.now() - current.lastMoveAt;
      const quickSwipe = distance >= FAST_SWIPE_MIN_DISTANCE
        && moveAge >= 0 && moveAge <= FAST_SWIPE_FRESH_MS
        && Math.abs(current.lastVelocityY) >= FAST_SWIPE_MIN_VELOCITY
        && Math.sign(current.lastVelocityY) === Math.sign(gesture.dy);
      const destination = distance >= cardHeightRef.current / 2 || quickSwipe
        ? current.startIndex + (gesture.dy < 0 ? 1 : -1)
        : current.startIndex;
      animateToPage(destination);
    },
    terminate: () => {
      const current = gestureRef.current;
      if (!current?.active || current.handled) return;
      current.handled = true;
      current.active = false;
      animateToPage(current.startIndex);
    },
  };
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (event: GestureResponderEvent, gesture: PanResponderGestureState) => panCallbacksRef.current.shouldStart(event, gesture),
    onMoveShouldSetPanResponder: (event: GestureResponderEvent, gesture: PanResponderGestureState) => panCallbacksRef.current.shouldStart(event, gesture),
    onPanResponderGrant: (event: GestureResponderEvent, gesture: PanResponderGestureState) => panCallbacksRef.current.grant(event, gesture),
    onPanResponderMove: (event: GestureResponderEvent, gesture: PanResponderGestureState) => panCallbacksRef.current.move(event, gesture),
    onPanResponderRelease: (event: GestureResponderEvent, gesture: PanResponderGestureState) => panCallbacksRef.current.release(event, gesture),
    onPanResponderTerminate: (event: GestureResponderEvent, gesture: PanResponderGestureState) => panCallbacksRef.current.terminate(event, gesture),
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => false,
  }), []);

  useFocusEffect(useCallback(() => {
    if (cardHeightRef.current > 0) {
      const expectedContentHeight = dramasRef.current.length * cardHeightRef.current;
      if (Math.abs(contentHeightRef.current - expectedContentHeight) <= PAGE_SETTLE_TOLERANCE) {
        setRequestedOffset(committedIndexRef.current * cardHeightRef.current);
      } else {
        pendingAlignmentRef.current = {
          height: cardHeightRef.current,
          generation: generationRef.current,
          requested: false,
        };
      }
    }
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
      stopMotion();
      nextBuffer.invalidate();
      nextBuffer.pauseAll();
      setScreenFocused(false);
      setBuffer(null);
    };
  }, []));

  useEffect(() => {
    if (Platform.OS !== 'web' || !screenFocused) return;
    const feedElement = feedRef.current as unknown as HTMLElement | null;
    if (!feedElement) return;
    const clearSuppression = () => {
      if (!gestureRef.current?.active) suppressClickRef.current = false;
    };
    const suppressDraggedClick = (event: MouseEvent) => {
      if (!suppressClickRef.current) return;
      suppressClickRef.current = false;
      if (event.detail === 0) return;
      event.preventDefault();
      event.stopPropagation();
    };
    feedElement.addEventListener('click', suppressDraggedClick, true);
    feedElement.addEventListener('pointerdown', clearSuppression, true);
    feedElement.addEventListener('touchstart', clearSuppression, true);
    feedElement.addEventListener('keydown', clearSuppression, true);
    return () => {
      feedElement.removeEventListener('click', suppressDraggedClick, true);
      feedElement.removeEventListener('pointerdown', clearSuppression, true);
      feedElement.removeEventListener('touchstart', clearSuppression, true);
      feedElement.removeEventListener('keydown', clearSuppression, true);
    };
  }, [screenFocused, status]);

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
  committedIndexRef.current = Math.max(0, dramas.findIndex((drama) => drama.uuid === activeId));
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

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    actualOffsetRef.current = event.nativeEvent.contentOffset.y;
    const pending = pendingAlignmentRef.current;
    if (pending) {
      const targetOffset = committedIndexRef.current * pending.height;
      if (pending.requested && pending.generation === generationRef.current
        && Math.abs(actualOffsetRef.current - targetOffset) <= PAGE_SETTLE_TOLERANCE) {
        pendingAlignmentRef.current = null;
      }
      return;
    }
    finishIfArrived();
  };
  const handleContentSizeChange = (_width: number, contentHeight: number) => {
    contentHeightRef.current = contentHeight;
    const pending = pendingAlignmentRef.current;
    if (!pending || !focusedRef.current || pending.generation !== generationRef.current || pending.requested) return;
    const expectedContentHeight = dramasRef.current.length * pending.height;
    if (Math.abs(contentHeight - expectedContentHeight) > PAGE_SETTLE_TOLERANCE) return;
    const targetOffset = committedIndexRef.current * pending.height;
    if (Math.abs(actualOffsetRef.current - targetOffset) <= PAGE_SETTLE_TOLERANCE) {
      requestedOffsetRef.current = targetOffset;
      pendingAlignmentRef.current = null;
      return;
    }
    pending.requested = true;
    setRequestedOffset(targetOffset);
  };
  useEffect(() => {
    if (!screenFocused || Platform.OS !== 'web' || !feedRef.current) return;
    const node = feedRef.current as unknown as FeedEventTarget;
    const listener = (event: WheelEvent) => wheelCallbackRef.current(event);
    node.addEventListener?.('wheel', listener, { passive: false });
    return () => node.removeEventListener?.('wheel', listener);
  }, [screenFocused, status, dramas.length, cardHeight]);

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
          : <View
            ref={feedRef}
            style={styles.feed}
            {...panResponder.panHandlers}
            onLayout={(event) => {
              const nextHeight = event.nativeEvent.layout.height;
              const previousHeight = cardHeightRef.current;
              if (nextHeight <= 0 || nextHeight === previousHeight) return;
              if (previousHeight > 0) {
                stopMotion();
                pendingAlignmentRef.current = {
                  height: nextHeight,
                  generation: generationRef.current,
                  requested: false,
                };
              } else {
                actualOffsetRef.current = committedIndexRef.current * nextHeight;
                requestedOffsetRef.current = actualOffsetRef.current;
              }
              cardHeightRef.current = nextHeight;
              setCardHeight(nextHeight);
            }}
          >
            {cardHeight > 0 ? <FlatList
              ref={listRef}
              data={dramas}
              keyExtractor={(drama) => drama.uuid}
              initialScrollIndex={initialIndex}
              getItemLayout={(_, index) => ({ length: cardHeight, offset: cardHeight * index, index })}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              extraData={cardState}
              onContentSizeChange={handleContentSizeChange}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              renderItem={({ item: drama }) => {
                const posterUrl = resolveApiImageUrl(drama.imageUrls.poster);
                const preview = drama.previewVideos[0];
                const previewTarget = preview ? { dramaId: drama.uuid, videoId: preview.uuid } : null;
                const entry = previewTarget ? buffer?.get(previewTarget) : undefined;
                const key = previewTarget ? recommendationPreviewKey(previewTarget) : '';
                const player = entry?.kind === 'ready' ? entry.player : undefined;
                const mountVideo = screenFocused && Boolean(player);
                const showVideo = mountVideo && preparedPlayers.get(key) === player;
                const mountControls = showVideo && activeId === drama.uuid && activePlayer === player;
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
                  {mountControls && activeDramaForPreview && activePreviewTarget && <RecommendationPreviewPlayer
                    key={`controls:${recommendationPreviewKey(activePreviewTarget)}`}
                    player={activePlayer!}
                    moving={scrolling}
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
                    onSeekTouch={(active) => { gestureBlockedRef.current = active; }}
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
