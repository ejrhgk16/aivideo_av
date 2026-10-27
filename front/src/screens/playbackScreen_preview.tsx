import { useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import Slider from '@react-native-community/slider';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Modal, Pressable, Share, StyleSheet, View } from 'react-native';
import { AppText, Button, EmptyState, Icon, Page } from '@/components/ui';
import { EpisodeUnlockDialog } from '@/components/EpisodeUnlockDialog';
import { resolveApiImageUrl } from '@/common/media';
import { colors } from '@/common/theme/tokens';
import { getDramaContent, type DramaContent } from '@/features/drama/dramaContent';
import { getPreviewPlayback, type PreviewPlayback } from '@/features/playback/previewPlayback';

type PreviewState =
  | { kind: 'loading' }
  | { kind: 'ready'; drama: DramaContent; playback: PreviewPlayback }
  | { kind: 'error' };

export function PlaybackScreenPreview({ dramaId, videoId }: { dramaId: string; videoId: string }) {
  const router = useRouter();
  const [state, setState] = useState<PreviewState>({ kind: 'loading' });
  const back = () => router.canGoBack() ? router.back() : router.replace('/');

  useEffect(() => {
    let active = true;
    setState({ kind: 'loading' });
    Promise.all([getDramaContent(dramaId), getPreviewPlayback(dramaId, videoId)]).then(
      ([drama, playback]) => { if (active) setState({ kind: 'ready', drama, playback }); },
      () => { if (active) setState({ kind: 'error' }); },
    );
    return () => { active = false; };
  }, [dramaId, videoId]);

  if (state.kind === 'loading') {
    return <Page><EmptyState title="영상을 불러오는 중이에요" description="잠시만 기다려 주세요." /></Page>;
  }
  if (state.kind === 'error') {
    return <Page><EmptyState title="영상을 재생할 수 없어요" description="잠시 후 다시 확인해 주세요." action="뒤로 가기" onAction={back} /></Page>;
  }
  return <PreviewVideo drama={state.drama} url={state.playback.url} onClose={back} />;
}

function PreviewVideo({ drama, url, onClose }: { drama: DramaContent; url: string; onClose: () => void }) {
  const router = useRouter();
  const player = useVideoPlayer(url, (videoPlayer) => videoPlayer.play());
  const [isPlaying, setIsPlaying] = useState(player.playing);
  const [position, setPosition] = useState(player.currentTime);
  const [duration, setDuration] = useState(player.duration);
  const [saved, setSaved] = useState(false);
  const [videoFailed, setVideoFailed] = useState(player.status === 'error');
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lockedEpisode, setLockedEpisode] = useState<DramaContent['episodes'][number] | null>(null);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(player.playbackRate);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seeking = useRef(false);
  const insets = useSafeAreaInsets();
  const posterUrl = resolveApiImageUrl(drama.imageUrls.poster);
  const genres = drama.genres.map((genre) => genre.name).join(' · ') || '장르 정보 없음';
  const episodes = [...drama.episodes].sort((first, second) => first.episodeNumber - second.episodeNumber);
  const firstEpisode = episodes[0] ?? null;

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  }, []);
  const showControls = useCallback(() => {
    clearHideTimer();
    setControlsVisible(true);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 4000);
  }, [clearHideTimer]);
  const toggleControls = useCallback(() => {
    if (controlsVisible) {
      clearHideTimer();
      setControlsVisible(false);
      setSpeedMenuOpen(false);
    } else {
      showControls();
    }
  }, [clearHideTimer, controlsVisible, showControls]);

  useFocusEffect(useCallback(() => () => {
    clearHideTimer();
    player.pause();
  }, [clearHideTimer, player]));
  useEffect(() => {
    const playing = player.addListener('playingChange', ({ isPlaying: next }) => setIsPlaying(next));
    const status = player.addListener('statusChange', ({ status: next }) => {
      if (next === 'error') setVideoFailed(true);
      if (next === 'readyToPlay') {
        const videoDuration = player.duration;
        if (Number.isFinite(videoDuration) && videoDuration > 0) setDuration(videoDuration);
      }
    });
    return () => { playing.remove(); status.remove(); };
  }, [player]);
  useEffect(() => {
    player.timeUpdateEventInterval = 0.5;
    const time = player.addListener('timeUpdate', ({ currentTime }) => {
      const videoDuration = player.duration;
      if (Number.isFinite(videoDuration) && videoDuration > 0) setDuration(videoDuration);
      if (!seeking.current && Number.isFinite(currentTime)) setPosition(currentTime);
    });
    const source = player.addListener('sourceLoad', ({ duration: videoDuration }) => {
      if (Number.isFinite(videoDuration) && videoDuration > 0) setDuration(videoDuration);
    });
    const rate = player.addListener('playbackRateChange', ({ playbackRate: next }) => setPlaybackRate(next));
    return () => { time.remove(); source.remove(); rate.remove(); };
  }, [player]);
  useEffect(() => {
    showControls();
    return clearHideTimer;
  }, [clearHideTimer, showControls]);

  const openEpisodes = () => {
    player.pause();
    router.push({ pathname: '/drama/[id]', params: { id: drama.uuid, tab: 'episodes' } });
  };
  const watchFromFirstEpisode = () => {
    if (!firstEpisode) return;
    player.pause();
    if (firstEpisode.pricePoints > 0) {
      setLockedEpisode(firstEpisode);
      return;
    }
    router.replace({ pathname: '/episode/[id]', params: { id: firstEpisode.uuid, dramaId: drama.uuid } });
  };
  const formatTime = (seconds: number) => {
    const whole = Math.floor(Math.max(0, seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  };
  const togglePlayback = () => {
    if (isPlaying) player.pause();
    else player.play();
    showControls();
  };
  const shareDrama = () => {
    void Share.share({ title: drama.title, message: [drama.title, drama.shortDescription].filter(Boolean).join('\n') });
  };

  if (videoFailed) {
    return <Page><EmptyState title="영상을 재생할 수 없어요" description="잠시 후 다시 확인해 주세요." action="뒤로 가기" onAction={onClose} /></Page>;
  }

  return <View style={styles.fullscreen}>
    <StatusBar hidden />
    <VideoView player={player} nativeControls={false} contentFit="contain" style={[StyleSheet.absoluteFill, styles.video]} onFirstFrameRender={() => setFirstFrameReady(true)} />
    {!firstFrameReady ? posterUrl
      ? <Image source={{ uri: posterUrl }} accessibilityLabel={`${drama.title} 표지`} contentFit="cover" style={StyleSheet.absoluteFill} />
      : <View style={[StyleSheet.absoluteFill, styles.placeholder]} />
      : null}
    <LinearGradient pointerEvents="none" colors={['#03060BAA', 'transparent', '#070C13A8', '#070C13']} locations={[0, 0.33, 0.65, 1]} style={StyleSheet.absoluteFill} />
    <Pressable style={StyleSheet.absoluteFill} onPress={toggleControls} accessibilityLabel="재생 컨트롤 표시 또는 숨기기" />
    {controlsVisible && <>
      <View style={[styles.topControls, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="닫기" style={styles.iconButton}>
          <Icon name="x" color="#fff" />
        </Pressable>
        <View style={styles.heading}><AppText style={styles.episodeTitle}>미리보기</AppText></View>
        <Pressable onPress={() => setSpeedMenuOpen((open) => !open)} accessibilityRole="button" accessibilityLabel="재생 속도" style={styles.speedButton}>
          <AppText weight="semibold" style={styles.speedText}>{playbackRate}x</AppText>
        </Pressable>
        <Pressable onPress={() => { setSpeedMenuOpen(false); setSettingsOpen(true); }} accessibilityRole="button" accessibilityLabel="더보기 설정" style={styles.moreButton}>
          <Icon name="more-horizontal" color="#fff" size={24} />
        </Pressable>
      </View>
      {speedMenuOpen && <View style={[styles.speedMenu, { top: insets.top + 60 }]}>
        {[1, 1.25, 1.5, 2].map((rate) => <Pressable key={rate} onPress={() => {
          player.playbackRate = rate;
          setSpeedMenuOpen(false);
          showControls();
        }} style={styles.speedOption} accessibilityRole="button" accessibilityLabel={`${rate}배속`}>
          <AppText style={[styles.speedOptionText, playbackRate === rate && styles.activeSpeed]}>{rate}x</AppText>
        </Pressable>)}
      </View>}
      <View style={styles.sideActions}>
        <Pressable onPress={() => setSaved((value) => !value)} accessibilityRole="button" accessibilityLabel={saved ? '저장 해제' : '작품 저장'} style={styles.sideAction}>
          <Icon name="bookmark" color={saved ? colors.accent : '#fff'} />
          <AppText style={styles.actionLabel}>{saved ? '저장됨' : '저장'}</AppText>
        </Pressable>
        <Pressable onPress={openEpisodes} accessibilityRole="button" accessibilityLabel="전체 회차" style={styles.sideAction}>
          <Icon name="layers" color="#fff" />
          <AppText style={styles.actionLabel}>회차</AppText>
        </Pressable>
        <Pressable onPress={shareDrama} accessibilityRole="button" accessibilityLabel="작품 공유" style={styles.sideAction}>
          <Icon name="share-2" color="#fff" />
          <AppText style={styles.actionLabel}>공유</AppText>
        </Pressable>
      </View>
      <Pressable style={styles.playPause} accessibilityRole="button" accessibilityLabel={isPlaying ? '일시정지' : '재생'} onPress={togglePlayback}>
        <Icon name={isPlaying ? 'pause' : 'play'} size={34} color="#fff" />
      </Pressable>
      <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 12 }]}>
        {drama.productionCompany ? <AppText style={styles.studio}>{drama.productionCompany}</AppText> : null}
        <Pressable onPress={() => { player.pause(); router.push({ pathname: '/drama/[id]', params: { id: drama.uuid } }); }} accessibilityRole="button" accessibilityLabel={`${drama.title} 작품 상세 보기`} style={styles.bottomTitleButton}>
          <AppText weight="bold" numberOfLines={1} style={styles.bottomTitle}>{drama.title}</AppText>
          <Icon name="chevron-right" color="#fff" size={21} />
        </Pressable>
        <View style={styles.episodeInfo}>
          <AppText style={styles.episodeText}>{`${genres} · 미리보기`}</AppText>
          <AppText style={styles.time}>{formatTime(position)} / {formatTime(duration)}</AppText>
        </View>
        <Pressable disabled={!firstEpisode} onPress={watchFromFirstEpisode} accessibilityRole="button" accessibilityLabel="1화부터 본편 보기" accessibilityState={{ disabled: !firstEpisode }} style={[styles.watchButton, !firstEpisode && styles.disabledEpisodeButton]}>
          <Icon name="play" size={16} color={colors.background} />
          <AppText weight="semibold" style={styles.watchLabel}>1화부터 본편 보기</AppText>
          <AppText style={styles.watchMeta}>{firstEpisode ? `${firstEpisode.episodeNumber}화` : '회차 없음'}</AppText>
        </Pressable>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={Math.max(duration, 1)}
          value={position}
          disabled={duration <= 0}
          minimumTrackTintColor={colors.accent}
          maximumTrackTintColor="rgba(255,255,255,0.45)"
          thumbTintColor={colors.accent}
          onSlidingStart={() => { seeking.current = true; clearHideTimer(); }}
          onValueChange={setPosition}
          onSlidingComplete={(value) => {
            player.currentTime = value;
            seeking.current = false;
            showControls();
          }}
        />
      </View>
    </>}
    <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)} statusBarTranslucent>
      <View style={styles.settingsBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setSettingsOpen(false)} accessibilityRole="button" accessibilityLabel="더보기 메뉴 닫기" />
        <View style={styles.settingsDialog} accessibilityRole="alert" accessibilityLabel="재생 설정">
          <View style={styles.settingsHeader}>
            <AppText weight="bold" style={styles.settingsTitle}>재생 설정</AppText>
            <Pressable onPress={() => setSettingsOpen(false)} accessibilityRole="button" accessibilityLabel="닫기" style={styles.settingsClose}><Icon name="x" color={colors.muted} /></Pressable>
          </View>
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
      onPurchased={(episode) => router.replace({
        pathname: '/episode/[id]',
        params: { id: episode.uuid, dramaId: drama.uuid },
      })}
    />
  </View>;
}

const styles = StyleSheet.create({
  fullscreen: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  video: { width: '100%', height: '100%' },
  placeholder: { backgroundColor: colors.surface },
  topControls: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 18, backgroundColor: 'rgba(0,0,0,0.45)' },
  iconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, gap: 1 },
  episodeTitle: { color: '#D2D5D9', fontSize: 11 },
  speedButton: { minWidth: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  speedText: { color: '#fff', fontSize: 13 },
  moreButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  speedMenu: { position: 'absolute', right: 17, zIndex: 5, backgroundColor: '#15171B', borderRadius: 12, padding: 5 },
  speedOption: { minWidth: 68, minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  speedOptionText: { color: '#fff', fontSize: 13 },
  activeSpeed: { color: colors.accent },
  sideActions: { position: 'absolute', right: 15, bottom: 205, alignItems: 'center', gap: 19 },
  sideAction: { minWidth: 50, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 4 },
  actionLabel: { color: '#fff', fontSize: 10, lineHeight: 14 },
  playPause: { alignSelf: 'center', width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(0,0,0,0.48)', alignItems: 'center', justifyContent: 'center' },
  bottomControls: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 25, backgroundColor: 'rgba(0,0,0,0.55)' },
  studio: { color: '#C4CDC1', fontSize: 9, lineHeight: 14, letterSpacing: 1.2 },
  bottomTitleButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7 },
  bottomTitle: { flex: 1, color: '#fff', fontSize: 21, lineHeight: 28 },
  episodeInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  episodeText: { color: '#fff', fontSize: 12 },
  time: { color: '#fff', fontSize: 12, fontVariant: ['tabular-nums'] },
  watchButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 7, paddingHorizontal: 12, backgroundColor: colors.accent, borderRadius: 8 },
  watchLabel: { color: colors.background, fontSize: 12 },
  watchMeta: { marginLeft: 'auto', paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#16200733', color: colors.background, fontSize: 10 },
  disabledEpisodeButton: { opacity: 0.38 },
  slider: { width: '100%', height: 34, marginTop: 2 },
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
