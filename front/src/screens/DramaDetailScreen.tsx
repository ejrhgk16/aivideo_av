import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, EmptyState, Icon, LoadingState, Page } from '@/components/ui';
import { EpisodeUnlockDialog } from '@/components/EpisodeUnlockDialog';
import { ApiError, SessionChangedError } from '@/common/http/api';
import { resolveApiImageUrl } from '@/common/media';
import { createThemedStyles, useColors } from '@/common/theme/theme';
import { radius, spacing, textSizes } from '@/common/theme/tokens';
import { getErrorMessage } from '@/common/http/errorMessages';
import { getDramaContent, type DramaContent } from '@/features/drama/dramaContent';
import { useUser } from '@/features/user/UserProvider';

type LoadState = 'loading' | 'loaded' | 'not-found' | 'error';
type Episode = DramaContent['episodes'][number];
type WatchingScroll = { pending: boolean; listY: number | null; row: { y: number; height: number } | null };

const GRID_COLUMNS = 4;

/** 마지막으로 재생한 회차. 시청 기록이 같은 시각이면 앞 회차를 고른다. */
function findWatchingEpisode(episodes: Episode[]) {
  let watching: Episode | null = null;
  for (const episode of episodes) {
    const playedAt = episode.watchProgress?.lastPlayedAt;
    if (playedAt && (!watching || playedAt > watching.watchProgress!.lastPlayedAt)) watching = episode;
  }
  return watching;
}

function episodeLabel(episode: Episode, watching: boolean) {
  const title = episode.title && episode.title !== `${episode.episodeNumber}화` ? ` ${episode.title}` : '';
  const state = episode.pricePoints === 0 ? '무료' : episode.isUnlocked ? '열림' : `잠김, ${episode.pricePoints}포인트로 열기`;
  return [`${episode.episodeNumber}화${title}`, watching ? '보는 중' : null, state].filter(Boolean).join(', ');
}

export function DramaDetailScreen({ id }: { id: string }) {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const { isRestoring, sessionVersion, isCurrentSession, user } = useUser();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [drama, setDrama] = useState<DramaContent | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [imageFailed, setImageFailed] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'소개' | '회차' | null>(null);
  const [lockedEpisode, setLockedEpisode] = useState<DramaContent['episodes'][number] | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const tab = selectedTab ?? (params.tab === 'episodes' || params.tab === '회차' ? '회차' : '소개');
  const { height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  // 회차 목록이 열릴 때마다 한 번 '보는 중' 칸을 화면 가운데로 스크롤한다. 포커스는 옮기지 않는다.
  // 목록과 보는 중 줄의 onLayout 순서는 정해져 있지 않아 둘 다 잰 뒤에 움직인다.
  const watchingScroll = useRef<WatchingScroll>({ pending: true, listY: null, row: null });
  const selectTab = (item: '소개' | '회차') => {
    if (item === '회차' && tab !== '회차') watchingScroll.current = { pending: true, listY: null, row: null };
    setSelectedTab(item);
  };
  const measureWatching = (layout: Partial<Pick<WatchingScroll, 'listY' | 'row'>>) => {
    const next = { ...watchingScroll.current, ...layout };
    watchingScroll.current = next;
    if (!next.pending || next.listY === null || next.row === null) return;
    next.pending = false;
    const y = next.listY + next.row.y + next.row.height / 2 - windowHeight / 2;
    scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: false });
  };

  useEffect(() => {
    if (isRestoring) {
      setDrama(null);
      setLockedEpisode(null);
      setLoadState('loading');
      return;
    }
    let active = true;
    const version = sessionVersion;
    setDrama(null);
    setLockedEpisode(null);
    setImageFailed(false);
    setErrorMessage('');
    setLoadState('loading');
    watchingScroll.current = { pending: true, listY: null, row: null };

    getDramaContent(id).then((content) => {
      if (!active || !isCurrentSession(version)) return;
      setDrama(content);
      setLoadState('loaded');
    }).catch((error: unknown) => {
      if (!active || !isCurrentSession(version) || error instanceof SessionChangedError) return;
      setErrorMessage(getErrorMessage(error));
      setLoadState(error instanceof ApiError && error.status === 404 ? 'not-found' : 'error');
    });

    return () => { active = false; };
  }, [id, isRestoring, sessionVersion, retryCount, isCurrentSession]);

  const back = () => router.canGoBack() ? router.back() : router.replace('/');
  if (isRestoring || loadState === 'loading') {
    return <Page scroll={false}><LoadingState /></Page>;
  }
  if (loadState === 'not-found') {
    return <Page><EmptyState title="작품을 찾을 수 없어요" description="공개된 작품이 아니거나 삭제되었어요." action="홈으로" onAction={() => router.replace('/')} /></Page>;
  }
  if (loadState === 'error' || !drama) {
    return <Page><EmptyState title="작품 정보를 불러오지 못했어요" description={errorMessage || '요청을 처리하지 못했습니다. 다시 시도해 주세요.'} action="다시 시도" onAction={() => setRetryCount((count) => count + 1)} /></Page>;
  }

  const coverUrl = resolveApiImageUrl(drama.imageUrls.detailCover);
  const genres = drama.genres.map((genre) => genre.name).join(' · ');
  const episodes = [...drama.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber);
  const watching = findWatchingEpisode(episodes);
  const rows: Episode[][] = [];
  for (let index = 0; index < episodes.length; index += GRID_COLUMNS) rows.push(episodes.slice(index, index + GRID_COLUMNS));
  const firstPreview = drama.previewVideos[0];
  const openEpisode = (episode: DramaContent['episodes'][number]) => {
    if (episode.pricePoints > 0 && !episode.isUnlocked) {
      setLockedEpisode(episode);
      return;
    }
    router.push({ pathname: '/episode/[id]', params: { id: episode.uuid, dramaId: drama.uuid } });
  };
  const openPreview = () => {
    if (!firstPreview) return;
    router.push({ pathname: '/preview/[dramaId]/[videoId]', params: { dramaId: drama.uuid, videoId: firstPreview.uuid } });
  };

  return (
    <Page contentStyle={styles.page} scrollRef={scrollRef}>
      <View style={styles.hero}>
        {coverUrl && !imageFailed ? <Image source={{ uri: coverUrl }} accessibilityLabel={`${drama.title} 상세 표지`} contentFit="cover" style={StyleSheet.absoluteFill} onError={() => setImageFailed(true)} /> : <View style={[StyleSheet.absoluteFill, styles.imagePlaceholder]}><Icon name="image" size={30} color={colors.muted} /><AppText style={styles.imagePlaceholderText}>표지 이미지가 없어요</AppText></View>}
        <View pointerEvents="none" style={styles.heroShade} />
        <Pressable style={styles.back} accessibilityRole="button" accessibilityLabel="뒤로 가기" onPress={back}><Icon name="chevron-left" size={27} color={colors.onMedia} /></Pressable>
        {drama.productionCompany ? <AppText weight="medium" style={styles.studio}>{drama.productionCompany}</AppText> : null}
      </View>
      <View style={styles.heading}>
        {genres ? <AppText style={styles.genres}>{genres}</AppText> : null}
        <AppText weight="bold" style={styles.title}>{drama.title}</AppText>
        <AppText style={styles.meta}>{episodes.length}화 공개</AppText>
      </View>
      <View style={styles.tabs} accessibilityRole="tablist">{(['소개', '회차'] as const).map((item) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }} style={[styles.tab, tab === item && styles.activeTab]} onPress={() => selectTab(item)}><AppText weight={tab === item ? 'semibold' : 'medium'} style={[styles.tabLabel, tab === item && styles.activeTabLabel]}>{item === '소개' ? '작품 소개' : `전체 회차 ${episodes.length}`}</AppText></Pressable>)}</View>
      {tab === '소개' ? <View style={styles.section}>
        <AppText style={styles.synopsis}>{drama.synopsis || drama.shortDescription}</AppText>
        <Pressable disabled={!firstPreview} onPress={openPreview} accessibilityRole="button" accessibilityLabel="분위기 미리보기" accessibilityState={{ disabled: !firstPreview }} style={[styles.previewButton, !firstPreview && styles.disabledPreviewButton]}>
          <Icon name="film" size={18} color={colors.text} />
          <AppText weight="semibold" style={styles.previewButtonText}>분위기 미리보기</AppText>
          <Icon name="arrow-up-right" size={16} color={colors.text} />
        </Pressable>
        {drama.productionCompany ? <View style={styles.production}><AppText style={styles.productionLabel}>제작사</AppText><AppText weight="medium" style={styles.productionValue}>{drama.productionCompany}</AppText></View> : null}
      </View> : <View testID="episode-list" style={styles.episodes} onLayout={(event) => measureWatching({ listY: event.nativeEvent.layout.y })}>
        {episodes.length === 0 ? <AppText style={styles.emptyEpisodes}>공개된 회차가 아직 없어요.</AppText> : rows.map((row) => (
          <View key={row[0].uuid} style={styles.episodeRow}
            onLayout={watching && row.includes(watching) ? (event) => measureWatching({ row: event.nativeEvent.layout }) : undefined}>
            {row.map((episode) => {
              const isWatching = episode === watching;
              const available = episode.pricePoints === 0 || episode.isUnlocked;
              return <Pressable key={episode.uuid} style={[styles.episode, available && styles.availableEpisode, isWatching && styles.watchingEpisode]} accessibilityRole="button" accessibilityLabel={episodeLabel(episode, isWatching)} onPress={() => openEpisode(episode)}>
                <AppText weight="semibold" style={[styles.episodeNumber, available && styles.availableEpisodeNumber, isWatching && styles.watchingEpisodeText]}>{episode.episodeNumber}</AppText>
                {isWatching ? <AppText weight="semibold" style={styles.episodeState}>보는 중</AppText>
                  : episode.pricePoints === 0 ? <AppText weight="semibold" style={styles.episodeState}>무료</AppText>
                  : episode.isUnlocked ? <AppText weight="semibold" style={styles.episodeState}>열림</AppText>
                  : <View style={styles.lockedState}><Icon name="lock" size={11} color={colors.accent} /><AppText weight="semibold" style={styles.episodeState}>{episode.pricePoints}P</AppText></View>}
              </Pressable>;
            })}
            {Array.from({ length: GRID_COLUMNS - row.length }, (_, index) => <View key={`empty-${index}`} style={styles.emptyCell} />)}
          </View>
        ))}
      </View>}
      <EpisodeUnlockDialog
        episode={lockedEpisode}
        dramaTitle={drama.title}
        onClose={() => setLockedEpisode(null)}
        onCharge={() => {
          setLockedEpisode(null);
          router.push(user === null ? '/auth/login' : '/points');
        }}
        onPurchased={(episode) => {
          setDrama((current) => current === null ? null : {
            ...current,
            episodes: current.episodes.map((item) => item.uuid === episode.uuid
              ? { ...item, isUnlocked: true }
              : item),
          });
          router.push({
            pathname: '/episode/[id]',
            params: { id: episode.uuid, dramaId: drama.uuid },
          });
        }}
      />
    </Page>
  );
}

const useStyles = createThemedStyles((colors) => ({
  page: { paddingHorizontal: 22, paddingTop: 0, paddingBottom: 34, gap: 24 },
  hero: { height: 290, marginHorizontal: -22, justifyContent: 'flex-end', overflow: 'hidden', backgroundColor: colors.surface },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: colors.mediaScrim },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  imagePlaceholderText: { color: colors.muted, fontSize: 12 },
  back: { position: 'absolute', top: 14, left: 14, width: 44, height: 44, backgroundColor: colors.mediaBack, borderRadius: 24, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  studio: { color: colors.onMedia, fontSize: 12, lineHeight: 18, marginHorizontal: 22, marginBottom: 15 },
  heading: { gap: 9 },
  genres: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  title: { fontSize: 30, lineHeight: 40, letterSpacing: -1 },
  meta: { fontSize: 12, lineHeight: 18, color: colors.muted },
  tabs: { flexDirection: 'row', gap: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { minHeight: 46, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: colors.accent },
  tabLabel: { ...textSizes.label14, color: colors.muted },
  activeTabLabel: { color: colors.text },
  section: { gap: 14, paddingTop: 3 },
  synopsis: { fontSize: 14, lineHeight: 25, color: colors.text },
  previewButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 15, marginTop: 9, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, borderRadius: 11, borderCurve: 'continuous' },
  disabledPreviewButton: { opacity: 0.45 },
  previewButtonText: { flex: 1, fontSize: 12, lineHeight: 18 },
  production: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingTop: 5 },
  productionLabel: { width: 45, color: colors.muted, fontSize: 11, lineHeight: 18 },
  productionValue: { color: colors.text, fontSize: 12, lineHeight: 19 },
  episodes: { gap: spacing.xs, paddingTop: 3 },
  emptyEpisodes: { color: colors.muted, fontSize: 13, lineHeight: 21, paddingVertical: 10 },
  // 한 줄 4칸. 칸에는 번호와 상태(무료 / 보는 중 / 열림 / 자물쇠 NP) 하나만 적는다.
  episodeRow: { flexDirection: 'row', gap: spacing.xs },
  emptyCell: { flex: 1 },
  episode: { flex: 1, minHeight: 62, gap: spacing.xxs, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, borderCurve: 'continuous' },
  availableEpisode: { backgroundColor: colors.surface },
  watchingEpisode: { backgroundColor: colors.elevated, borderColor: colors.accent },
  episodeNumber: { ...textSizes.label14, color: colors.muted, fontVariant: ['tabular-nums'] },
  availableEpisodeNumber: { color: colors.text },
  watchingEpisodeText: { color: colors.accent },
  episodeState: { ...textSizes.caption12, color: colors.accent },
  lockedState: { flexDirection: 'row', alignItems: 'center', gap: 2 },
}));
