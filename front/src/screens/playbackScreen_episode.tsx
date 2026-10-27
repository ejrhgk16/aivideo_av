import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import Slider from '@react-native-community/slider';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button, EmptyState, Icon, Page } from '@/components/ui';
import { EpisodeUnlockDialog } from '@/components/EpisodeUnlockDialog';
import { colors } from '@/common/theme/tokens';
import { getDramaContent, type DramaContent } from '@/features/drama/dramaContent';
import { getEpisodePlayback, type EpisodePlayback } from '@/features/playback/episodePlayback';

type LoadState = 'loading' | 'loaded' | 'not-found' | 'error';
type Props = { id: string; dramaId?: string };

export function PlaybackScreenEpisode({ id, dramaId }: Props) {
  const router = useRouter();
  const [playback, setPlayback] = useState<EpisodePlayback | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');

  useEffect(() => {
    let active = true;
    setPlayback(null);
    setLoadState('loading');
    getEpisodePlayback(id).then((result) => {
      if (!active) return;
      setPlayback(result);
      setLoadState('loaded');
    }).catch((error: unknown) => {
      if (!active) return;
      const message = error instanceof Error ? error.message : '';
      setLoadState(/:\s*404\b/.test(message) ? 'not-found' : 'error');
    });
    return () => { active = false; };
  }, [id]);

  const back = () => router.canGoBack() ? router.back() : router.replace('/');
  if (loadState === 'loading') {
    return <Page><EmptyState title="영상을 불러오는 중이에요" description="잠시만 기다려 주세요." /></Page>;
  }
  if (loadState === 'not-found') {
    return <Page><EmptyState title="재생할 영상을 찾을 수 없어요" description="공개된 회차가 아니거나 영상이 없어요." action="뒤로 가기" onAction={back} /></Page>;
  }
  if (loadState === 'error' || !playback) {
    return <Page><EmptyState title="영상 정보를 불러오지 못했어요" description="네트워크를 확인한 뒤 다시 시도해 주세요." action="뒤로 가기" onAction={back} /></Page>;
  }

  return <PlaybackVideo id={id} playback={playback} dramaId={dramaId} onBack={back} />;
}

function PlaybackVideo({ id, playback, dramaId, onBack }: {
  id: string; playback: EpisodePlayback; dramaId?: string; onBack: () => void;
}) {
  const router = useRouter();
  const [drama, setDrama] = useState<DramaContent | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lockedEpisode, setLockedEpisode] = useState<DramaContent['episodes'][number] | null>(null);
  const player = useVideoPlayer(playback.url, (videoPlayer) => {
    videoPlayer.currentTime = 0;
    videoPlayer.play();
  });
  const [videoFailed, setVideoFailed] = useState(player.status === 'error');
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isPlaying, setIsPlaying] = useState(player.playing);
  const [position, setPosition] = useState(player.currentTime);
  const [duration, setDuration] = useState(player.duration);
  const [saved, setSaved] = useState(false);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(player.playbackRate);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seeking = useRef(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!dramaId) return;
    let active = true;
    void getDramaContent(dramaId).then((result) => {
      if (active) setDrama(result);
    }).catch(() => {
      if (active) setDrama(null);
    });
    return () => { active = false; };
  }, [dramaId]);

  const episodes = [...(drama?.episodes ?? [])].sort((first, second) => first.episodeNumber - second.episodeNumber);
  const currentIndex = episodes.findIndex((episode) => episode.uuid === id);
  const previousEpisode = currentIndex > 0 ? episodes[currentIndex - 1] : null;
  const nextEpisode = currentIndex >= 0 ? episodes[currentIndex + 1] ?? null : null;

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

  useFocusEffect(useCallback(() => () => player.pause(), [player]));
  useEffect(() => {
    const subscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'error') setVideoFailed(true);
      if (status === 'readyToPlay') {
        const videoDuration = player.duration;
        if (Number.isFinite(videoDuration) && videoDuration > 0) setDuration(videoDuration);
      }
    });
    return () => subscription.remove();
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
    const playing = player.addListener('playingChange', ({ isPlaying: playingNow }) => setIsPlaying(playingNow));
    const rate = player.addListener('playbackRateChange', ({ playbackRate: rateNow }) => setPlaybackRate(rateNow));
    return () => {
      time.remove();
      source.remove();
      playing.remove();
      rate.remove();
    };
  }, [player]);
  useEffect(() => {
    showControls();
    return clearHideTimer;
  }, [clearHideTimer, showControls]);

  const formatTime = (seconds: number) => {
    const whole = Math.floor(Math.max(0, seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  };
  const openEpisodes = () => {
    if (!dramaId) return;
    player.pause();
    router.push({ pathname: '/drama/[id]', params: { id: dramaId, tab: 'episodes' } });
  };
  const openDrama = () => {
    if (!dramaId) return;
    player.pause();
    router.push({ pathname: '/drama/[id]', params: { id: dramaId } });
  };
  const selectEpisode = (episode: DramaContent['episodes'][number] | null) => {
    if (!episode || !dramaId) return;
    player.pause();
    if (episode.pricePoints > 0) {
      setLockedEpisode(episode);
      return;
    }
    router.replace({ pathname: '/episode/[id]', params: {
      id: episode.uuid,
      dramaId,
    } });
  };
  const shareEpisode = () => {
    void Share.share({ message: `${drama?.title ? `${drama.title} · ` : ''}${playback.title || `${playback.episodeNumber}화`}` });
  };

  return <View style={styles.fullscreen}>
    <StatusBar hidden />
    {videoFailed ? <View style={styles.error}><EmptyState title="영상을 재생할 수 없어요" description="잠시 후 다시 시도해 주세요." action="뒤로 가기" onAction={onBack} /></View> : <>
      <VideoView player={player} nativeControls={false} contentFit="contain" style={[StyleSheet.absoluteFill, styles.video]} />
      <Pressable style={StyleSheet.absoluteFill} onPress={toggleControls} accessibilityLabel="재생 컨트롤 표시 또는 숨기기" />
      {controlsVisible && <>
        <View style={[styles.topControls, { paddingTop: insets.top + 6 }]}>
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="닫기" style={styles.iconButton}>
            <Icon name="x" color="#fff" />
          </Pressable>
          <View style={styles.heading}>
            <AppText style={styles.episodeTitle}>{playback.episodeNumber}화</AppText>
          </View>
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
            <Icon name={saved ? 'bookmark' : 'bookmark'} color={saved ? colors.accent : '#fff'} />
            <AppText style={styles.actionLabel}>{saved ? '저장됨' : '저장'}</AppText>
          </Pressable>
          {dramaId ? <Pressable onPress={openEpisodes} accessibilityRole="button" accessibilityLabel="전체 회차" style={styles.sideAction}>
            <Icon name="layers" color="#fff" />
            <AppText style={styles.actionLabel}>회차</AppText>
          </Pressable> : null}
          <Pressable onPress={shareEpisode} accessibilityRole="button" accessibilityLabel="회차 공유" style={styles.sideAction}>
            <Icon name="share-2" color="#fff" />
            <AppText style={styles.actionLabel}>공유</AppText>
          </Pressable>
        </View>
        <Pressable
          style={styles.playPause}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? '일시정지' : '재생'}
          onPress={() => {
            if (isPlaying) player.pause(); else player.play();
            showControls();
          }}
        >
          <Icon name={isPlaying ? 'pause' : 'play'} size={34} color="#fff" />
        </Pressable>
        <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 12 }]}>
          {drama?.productionCompany ? <AppText style={styles.studio}>{drama.productionCompany}</AppText> : null}
          {dramaId ? <Pressable onPress={openDrama} accessibilityRole="button" accessibilityLabel={`${drama?.title ?? playback.title ?? `${playback.episodeNumber}화`} 작품 상세 보기`} style={styles.bottomTitleButton}>
            <AppText weight="bold" numberOfLines={1} style={styles.bottomTitle}>{drama?.title ?? playback.title ?? `${playback.episodeNumber}화`}</AppText>
            <Icon name="chevron-right" color="#fff" size={21} />
          </Pressable> : <AppText weight="bold" numberOfLines={1} style={styles.bottomTitle}>{playback.title ?? `${playback.episodeNumber}화`}</AppText>}
          <View style={styles.episodeInfo}>
            <AppText style={styles.episodeText}>
              {[drama?.genres.map((genre) => genre.name).join(' · '), `${playback.episodeNumber}화${episodes.length > 0 ? ` / 총 ${episodes.length}화` : ''}`].filter(Boolean).join(' · ')}
            </AppText>
            <AppText style={styles.time}>{formatTime(position)} / {formatTime(duration)}</AppText>
          </View>
          <View style={styles.episodeNavigation}>
            <Pressable disabled={!previousEpisode} onPress={() => selectEpisode(previousEpisode)} accessibilityRole="button" accessibilityLabel="이전 화" accessibilityState={{ disabled: !previousEpisode }} style={[styles.episodeButton, !previousEpisode && styles.disabledEpisodeButton]}>
              <Icon name="chevron-left" size={16} color="#fff" /><AppText style={styles.episodeButtonText}>이전 화</AppText>
            </Pressable>
            <Pressable disabled={!nextEpisode} onPress={() => selectEpisode(nextEpisode)} accessibilityRole="button" accessibilityLabel="다음 화" accessibilityState={{ disabled: !nextEpisode }} style={[styles.episodeButton, !nextEpisode && styles.disabledEpisodeButton]}>
              <AppText style={styles.episodeButtonText}>다음 화</AppText><Icon name="chevron-right" size={16} color="#fff" />
            </Pressable>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={Math.max(duration, 1)}
            value={position}
            disabled={duration <= 0}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor="rgba(255,255,255,0.45)"
            thumbTintColor={colors.accent}
            onSlidingStart={() => {
              seeking.current = true;
              clearHideTimer();
            }}
            onValueChange={setPosition}
            onSlidingComplete={(value) => {
              player.currentTime = value;
              seeking.current = false;
              showControls();
            }}
          />
        </View>
      </>}
    </>}
    <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)} statusBarTranslucent>
      <View style={styles.settingsBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setSettingsOpen(false)} accessibilityRole="button" accessibilityLabel="더보기 메뉴 닫기" />
        <View style={styles.settingsDialog} accessibilityRole="alert" accessibilityLabel="재생 설정">
          <View style={styles.settingsHeader}>
            <AppText weight="bold" style={styles.settingsTitle}>재생 설정</AppText>
            <Pressable onPress={() => setSettingsOpen(false)} accessibilityRole="button" accessibilityLabel="닫기" style={styles.settingsClose}><Icon name="x" color={colors.muted} /></Pressable>
          </View>
          <View style={styles.settingsRow}>
            <View style={styles.settingsCopy}><AppText weight="semibold">자막 표시</AppText><AppText style={styles.settingsNote}>자막 정보를 준비하고 있어요.</AppText></View>
            <AppText style={styles.settingsDisabled}>준비 중</AppText>
          </View>
          <View style={styles.settingsRow}>
            <View style={styles.settingsCopy}><AppText weight="semibold">다음 화 자동 재생</AppText><AppText style={styles.settingsNote}>자동 재생 기능을 준비하고 있어요.</AppText></View>
            <AppText style={styles.settingsDisabled}>준비 중</AppText>
          </View>
          <View style={[styles.settingsRow, styles.lastSettingsRow]}>
            <View style={styles.settingsCopy}><AppText weight="semibold">신고</AppText><AppText style={styles.settingsNote}>신고 기능을 준비하고 있어요.</AppText></View>
            <AppText style={styles.settingsDisabled}>준비 중</AppText>
          </View>
          <Button label="닫기" variant="secondary" onPress={() => setSettingsOpen(false)} style={styles.settingsDismiss} />
        </View>
      </View>
    </Modal>
    <EpisodeUnlockDialog
      episode={lockedEpisode}
      dramaTitle={drama?.title ?? '작품'}
      onClose={() => setLockedEpisode(null)}
      onCharge={() => {
        setLockedEpisode(null);
        router.push('/points');
      }}
      onPurchased={(episode) => {
        if (!dramaId) return;
        router.replace({
          pathname: '/episode/[id]',
          params: { id: episode.uuid, dramaId },
        });
      }}
    />
  </View>;
}

const styles = StyleSheet.create({
  fullscreen: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  video: { width: '100%', height: '100%' },
  error: { flex: 1, justifyContent: 'center', padding: 22 },
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
  sideActions: { position: 'absolute', right: 15, bottom: 190, alignItems: 'center', gap: 19 },
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
  episodeNavigation: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  episodeButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8 },
  disabledEpisodeButton: { opacity: 0.38 },
  episodeButtonText: { color: '#D4DDD8', fontSize: 12 },
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
