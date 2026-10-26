import { useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
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

type CollectionStatus = 'loading' | 'loaded' | 'error';
type ActivePreview =
  | { kind: 'loading'; dramaId: string }
  | { kind: 'ready'; dramaId: string; url: string }
  | { kind: 'unavailable'; dramaId: string };

function RecommendationPreviewPlayer({
  url,
  drama,
  content,
  saved,
  onError,
  onToggleSave,
  onOpenEpisodes,
  onShare,
}: {
  url: string;
  drama: HomeCollectionDrama;
  content: DramaContent | null;
  saved: boolean;
  onError: () => void;
  onToggleSave: () => void;
  onOpenEpisodes: () => void;
  onShare: () => void;
}) {
  const router = useRouter();
  const player = useVideoPlayer(url, (videoPlayer) => videoPlayer.play());
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
    const playing = player.addListener('playingChange', ({ isPlaying: next }) => setIsPlaying(next));
    const status = player.addListener('statusChange', ({ status: next }) => {
      if (next === 'error') onErrorRef.current();
      if (next === 'readyToPlay' && Number.isFinite(player.duration) && player.duration > 0) setDuration(player.duration);
    });
    const time = player.addListener('timeUpdate', ({ currentTime }) => {
      if (!seeking.current && Number.isFinite(currentTime)) setPosition(currentTime);
      if (Number.isFinite(player.duration) && player.duration > 0) setDuration(player.duration);
    });
    const source = player.addListener('sourceLoad', ({ duration: videoDuration }) => {
      if (Number.isFinite(videoDuration) && videoDuration > 0) setDuration(videoDuration);
    });
    const rate = player.addListener('playbackRateChange', ({ playbackRate: next }) => setPlaybackRate(next));
    player.timeUpdateEventInterval = 0.5;
    showControls();
    return () => {
      playing.remove();
      status.remove();
      time.remove();
      source.remove();
      rate.remove();
      clearHideTimer();
      player.pause();
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
    <VideoView player={player} nativeControls={false} contentFit="contain" style={[StyleSheet.absoluteFill, styles.playerVideo]} />
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
    <EpisodeUnlockDialog episode={lockedEpisode} dramaTitle={drama.title} onClose={() => setLockedEpisode(null)} onCharge={() => { setLockedEpisode(null); router.push('/points'); }} />
  </>;
}

export function RecommendationScreen({ initialId }: { initialId?: string }) {
  const router = useRouter();
  const [collection, setCollection] = useState<HomeCollection | null>(null);
  const [status, setStatus] = useState<CollectionStatus>('loading');
  const [cardHeight, setCardHeight] = useState(0);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activePreview, setActivePreview] = useState<ActivePreview | null>(null);
  const [activeDrama, setActiveDrama] = useState<DramaContent | null>(null);
  const [screenFocused, setScreenFocused] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollY = useRef(0);

  useFocusEffect(useCallback(() => {
    setScreenFocused(true);
    return () => setScreenFocused(false);
  }, []));

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

  const dramas = [...(collection?.dramas ?? [])].sort((first, second) => {
    if (first.uuid === initialId) return -1;
    if (second.uuid === initialId) return 1;
    return first.displayOrder - second.displayOrder;
  });
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

  useEffect(() => {
    if (!activeId) {
      setActivePreview(null);
      return;
    }
    const drama = dramas.find((item) => item.uuid === activeId);
    const videoId = drama?.previewVideos[0]?.uuid;
    if (!videoId) {
      setActivePreview({ kind: 'unavailable', dramaId: activeId });
      return;
    }

    let current = true;
    setActivePreview({ kind: 'loading', dramaId: activeId });
    void getPreviewPlayback(activeId, videoId).then(
      (playback) => { if (current) setActivePreview({ kind: 'ready', dramaId: activeId, url: playback.url }); },
      () => { if (current) setActivePreview({ kind: 'unavailable', dramaId: activeId }); },
    );
    return () => { current = false; };
  }, [activeId, collection]);

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

  const settleOnPage = (offsetY: number) => {
    if (cardHeight <= 0) return;
    const index = Math.max(0, Math.min(dramas.length - 1, Math.round(offsetY / cardHeight)));
    setActiveId(dramas[index]?.uuid ?? null);
  };
  const clearSettleTimer = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = null;
  };
  const scheduleSettle = (offsetY: number) => {
    lastScrollY.current = offsetY;
    clearSettleTimer();
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null;
      settleOnPage(lastScrollY.current);
    }, 150);
  };
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    if (offsetY !== lastScrollY.current) setActiveId(null);
    scheduleSettle(offsetY);
  };
  const handleScrollEndDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scheduleSettle(event.nativeEvent.contentOffset.y);
  };

  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  return <Page scroll={false} contentStyle={styles.pageContent}>
    {status === 'loading' ? <EmptyState title="추천 작품 불러오는 중" description="잠시만 기다려 주세요." />
      : status === 'error' ? <EmptyState title="추천 작품을 불러오지 못했어요" description="잠시 후 다시 확인해 주세요." />
        : dramas.length === 0 ? <EmptyState title="오늘의 추천 작품이 없어요" description="새로운 작품을 준비하고 있어요." />
          : <View style={styles.feed} onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}>
            {cardHeight > 0 ? <FlatList
              data={dramas}
              keyExtractor={(drama) => drama.uuid}
              initialScrollIndex={initialIndex}
              getItemLayout={(_, index) => ({ length: cardHeight, offset: cardHeight * index, index })}
              pagingEnabled
              showsVerticalScrollIndicator={false}
              extraData={savedIds}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              onScrollBeginDrag={() => { clearSettleTimer(); setActiveId(null); }}
              onScrollEndDrag={handleScrollEndDrag}
              onMomentumScrollBegin={clearSettleTimer}
              onMomentumScrollEnd={(event) => {
                clearSettleTimer();
                lastScrollY.current = event.nativeEvent.contentOffset.y;
                settleOnPage(lastScrollY.current);
              }}
              renderItem={({ item: drama }) => {
                const saved = savedIds.includes(drama.uuid);
                const preview = activePreview?.dramaId === drama.uuid ? activePreview : null;
                const posterUrl = resolveApiImageUrl(drama.imageUrls.poster);
                const playing = screenFocused && activeId === drama.uuid && preview?.kind === 'ready';
                return <View style={[styles.card, { height: cardHeight }]}>
                  {playing ? <RecommendationPreviewPlayer
                    key={drama.uuid}
                    url={preview.url}
                    drama={drama}
                    content={activeId === drama.uuid ? activeDrama : null}
                    saved={saved}
                    onError={() => setActivePreview((current) => current?.dramaId === drama.uuid ? { kind: 'unavailable', dramaId: drama.uuid } : current)}
                    onToggleSave={() => toggleSave(drama.uuid)}
                    onOpenEpisodes={() => openEpisodes(drama)}
                    onShare={() => { void shareDrama(drama); }}
                  /> : posterUrl
                    ? <Image source={{ uri: posterUrl }} accessibilityLabel={`${drama.title} 표지`} contentFit="cover" style={StyleSheet.absoluteFill} />
                    : <View style={[StyleSheet.absoluteFill, styles.placeholder]} />}
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
  card: { width: '100%', maxWidth: 500, alignSelf: 'center', overflow: 'hidden', justifyContent: 'space-between', backgroundColor: colors.surface },
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
