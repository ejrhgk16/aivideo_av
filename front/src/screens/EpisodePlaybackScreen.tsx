import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import Slider from '@react-native-community/slider';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, EmptyState, Icon, Page } from '@/components/ui';
import { colors } from '@/common/theme/tokens';
import { getEpisodePlayback, type EpisodePlayback } from '@/features/playback/episodePlayback';

type LoadState = 'loading' | 'loaded' | 'not-found' | 'error';

export function EpisodePlaybackScreen({ id }: { id: string }) {
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

  return <PlaybackVideo playback={playback} onBack={back} />;
}

function PlaybackVideo({ playback, onBack }: { playback: EpisodePlayback; onBack: () => void }) {
  const player = useVideoPlayer(playback.url, (videoPlayer) => {
    videoPlayer.currentTime = 0;
    videoPlayer.play();
  });
  const [videoFailed, setVideoFailed] = useState(player.status === 'error');
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isPlaying, setIsPlaying] = useState(player.playing);
  const [position, setPosition] = useState(player.currentTime);
  const [duration, setDuration] = useState(player.duration);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seeking = useRef(false);
  const insets = useSafeAreaInsets();

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  }, []);

  const showControls = useCallback(() => {
    clearHideTimer();
    setControlsVisible(true);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
  }, [clearHideTimer]);

  const toggleControls = useCallback(() => {
    if (controlsVisible) {
      clearHideTimer();
      setControlsVisible(false);
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
    return () => {
      time.remove();
      source.remove();
      playing.remove();
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

  return <View style={styles.fullscreen}>
    <StatusBar hidden />
    {videoFailed ? <View style={styles.error}><EmptyState title="영상을 재생할 수 없어요" description="잠시 후 다시 시도해 주세요." action="뒤로 가기" onAction={onBack} /></View> : <>
      <VideoView player={player} nativeControls={false} contentFit="contain" style={[StyleSheet.absoluteFill, styles.video]} />
      <Pressable style={StyleSheet.absoluteFill} onPress={toggleControls} accessibilityLabel="재생 컨트롤 표시 또는 숨기기" />
      {controlsVisible && <>
        <View style={[styles.topControls, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="뒤로 가기" style={styles.back}>
            <Icon name="chevron-left" color="#fff" />
          </Pressable>
          <AppText weight="semibold" numberOfLines={1} style={styles.title}>{playback.title || `${playback.episodeNumber}화`}</AppText>
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
        <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 8 }]}>
          <AppText style={styles.time}>{formatTime(position)} / {formatTime(duration)}</AppText>
          <Slider
            style={{ width: '100%' }}
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
  </View>;
}

const styles = StyleSheet.create({
  fullscreen: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  video: { width: '100%', height: '100%' },
  error: { flex: 1, justifyContent: 'center', padding: 22 },
  topControls: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 28, backgroundColor: 'rgba(0,0,0,0.45)' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 16, color: '#fff' },
  playPause: { alignSelf: 'center', width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(0,0,0,0.48)', alignItems: 'center', justifyContent: 'center' },
  bottomControls: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 28, backgroundColor: 'rgba(0,0,0,0.5)' },
  time: { color: '#fff', fontSize: 13 },
});
