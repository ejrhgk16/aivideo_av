import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { AppText, Button, EmptyState, Icon, Page } from '@/components/ui';
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

  useFocusEffect(useCallback(() => () => player.pause(), [player]));
  useEffect(() => {
    const subscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'error') setVideoFailed(true);
    });
    return () => subscription.remove();
  }, [player]);

  return <Page scroll={false} contentStyle={styles.page}>
    <View style={styles.header}>
      <Button label="뒤로 가기" variant="ghost" icon={<Icon name="chevron-left" size={20} />} onPress={onBack} style={styles.back} />
      <AppText weight="semibold" style={styles.title}>{playback.title || `${playback.episodeNumber}화`}</AppText>
    </View>
    {videoFailed ? <EmptyState title="영상을 재생할 수 없어요" description="잠시 후 다시 시도해 주세요." action="뒤로 가기" onAction={onBack} /> : <VideoView player={player} nativeControls style={styles.video} />}
  </Page>;
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  back: { minHeight: 44, paddingHorizontal: 8 },
  title: { flex: 1, fontSize: 16 },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.surface, borderRadius: 10, overflow: 'hidden' },
});
