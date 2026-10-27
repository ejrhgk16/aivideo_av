import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, EmptyState, Icon, Page } from '@/components/ui';
import { EpisodeUnlockDialog } from '@/components/EpisodeUnlockDialog';
import { resolveApiImageUrl } from '@/common/media';
import { colors } from '@/common/theme/tokens';
import { getDramaContent, type DramaContent } from '@/features/drama/dramaContent';
import { useUser } from '@/features/user/UserProvider';

type LoadState = 'loading' | 'loaded' | 'not-found' | 'error';

export function DramaDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useUser();
  const userUuid = user?.uuid;
  const params = useLocalSearchParams<{ tab?: string }>();
  const [drama, setDrama] = useState<DramaContent | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [imageFailed, setImageFailed] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'소개' | '회차' | null>(null);
  const [lockedEpisode, setLockedEpisode] = useState<DramaContent['episodes'][number] | null>(null);
  const tab = selectedTab ?? (params.tab === 'episodes' || params.tab === '회차' ? '회차' : '소개');

  useEffect(() => {
    let active = true;
    setDrama(null);
    setLockedEpisode(null);
    setImageFailed(false);
    setLoadState('loading');

    getDramaContent(id, userUuid).then((content) => {
      if (!active) return;
      setDrama(content);
      setLoadState('loaded');
    }).catch((error: unknown) => {
      if (!active) return;
      const message = error instanceof Error ? error.message : '';
      setLoadState(/:\s*404\b/.test(message) ? 'not-found' : 'error');
    });

    return () => { active = false; };
  }, [id, userUuid]);

  const back = () => router.canGoBack() ? router.back() : router.replace('/');
  if (loadState === 'loading') {
    return <Page><EmptyState title="작품 정보를 불러오는 중이에요" description="잠시만 기다려 주세요." /></Page>;
  }
  if (loadState === 'not-found') {
    return <Page><EmptyState title="작품을 찾을 수 없어요" description="공개된 작품이 아니거나 삭제되었어요." action="홈으로" onAction={() => router.replace('/')} /></Page>;
  }
  if (loadState === 'error' || !drama) {
    return <Page><EmptyState title="작품 정보를 불러오지 못했어요" description="네트워크를 확인한 뒤 다시 시도해 주세요." action="홈으로" onAction={() => router.replace('/')} /></Page>;
  }

  const coverUrl = resolveApiImageUrl(drama.imageUrls.detailCover);
  const genres = drama.genres.map((genre) => genre.name).join(' · ');
  const episodes = [...drama.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber);
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
    <Page contentStyle={styles.page}>
      <View style={styles.hero}>
        {coverUrl && !imageFailed ? <Image source={{ uri: coverUrl }} accessibilityLabel={`${drama.title} 상세 표지`} contentFit="cover" style={StyleSheet.absoluteFill} onError={() => setImageFailed(true)} /> : <View style={[StyleSheet.absoluteFill, styles.imagePlaceholder]}><Icon name="image" size={30} color={colors.muted} /><AppText style={styles.imagePlaceholderText}>표지 이미지가 없어요</AppText></View>}
        <View pointerEvents="none" style={styles.heroShade} />
        <Pressable style={styles.back} accessibilityRole="button" accessibilityLabel="뒤로 가기" onPress={back}><Icon name="chevron-left" size={27} color={colors.text} /></Pressable>
        {drama.productionCompany ? <AppText weight="medium" style={styles.studio}>{drama.productionCompany}</AppText> : null}
      </View>
      <View style={styles.heading}>
        {genres ? <AppText style={styles.genres}>{genres}</AppText> : null}
        <AppText weight="bold" style={styles.title}>{drama.title}</AppText>
        <AppText style={styles.meta}>{episodes.length}화 공개</AppText>
      </View>
      <View style={styles.tabs} accessibilityRole="tablist">{(['소개', '회차'] as const).map((item) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }} style={[styles.tab, tab === item && styles.activeTab]} onPress={() => setSelectedTab(item)}><AppText weight={tab === item ? 'semibold' : 'regular'} style={[styles.tabLabel, tab === item && styles.activeTabLabel]}>{item === '소개' ? '작품 소개' : `전체 회차  ${episodes.length}`}</AppText></Pressable>)}</View>
      {tab === '소개' ? <View style={styles.section}>
        <AppText style={styles.synopsis}>{drama.synopsis || drama.shortDescription}</AppText>
        <Pressable disabled={!firstPreview} onPress={openPreview} accessibilityRole="button" accessibilityLabel="분위기 미리보기" accessibilityState={{ disabled: !firstPreview }} style={[styles.previewButton, !firstPreview && styles.disabledPreviewButton]}>
          <Icon name="film" size={18} color={colors.text} />
          <AppText weight="semibold" style={styles.previewButtonText}>분위기 미리보기</AppText>
          <Icon name="arrow-up-right" size={16} color={colors.text} />
        </Pressable>
        {drama.productionCompany ? <View style={styles.production}><AppText style={styles.productionLabel}>제작사</AppText><AppText weight="medium" style={styles.productionValue}>{drama.productionCompany}</AppText></View> : null}
      </View> : <View style={styles.episodes}>
        {episodes.length === 0 ? <AppText style={styles.emptyEpisodes}>공개된 회차가 아직 없어요.</AppText> : <View style={styles.episodeGrid}>{episodes.map((episode) => (
          <Pressable key={episode.uuid} style={styles.episode} accessibilityRole="button" accessibilityLabel={`${episode.episodeNumber}화${episode.pricePoints === 0 ? ' 무료' : episode.isUnlocked ? '' : ` ${episode.pricePoints}포인트`}`} onPress={() => openEpisode(episode)}>
            <AppText weight="medium" style={styles.episodeNumber}>{episode.episodeNumber}화</AppText>
            {episode.pricePoints === 0 ? <AppText style={styles.freeLabel}>무료</AppText> : episode.isUnlocked ? null : <AppText style={styles.priceLabel}>{episode.pricePoints}P</AppText>}
          </Pressable>
        ))}</View>}
      </View>}
      <EpisodeUnlockDialog
        episode={lockedEpisode}
        dramaTitle={drama.title}
        onClose={() => setLockedEpisode(null)}
        onCharge={() => {
          setLockedEpisode(null);
          router.push('/points');
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

const styles = StyleSheet.create({
  page: { paddingHorizontal: 22, paddingTop: 0, paddingBottom: 34, gap: 24 },
  hero: { height: 290, marginHorizontal: -22, justifyContent: 'flex-end', overflow: 'hidden', backgroundColor: colors.surface },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: '#0B0C0F40' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  imagePlaceholderText: { color: colors.muted, fontSize: 12 },
  back: { position: 'absolute', top: 14, left: 14, width: 44, height: 44, backgroundColor: '#0B0C0F99', borderRadius: 24, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  studio: { fontSize: 10, lineHeight: 16, letterSpacing: 1.2, marginHorizontal: 22, marginBottom: 15 },
  heading: { gap: 9 },
  genres: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  title: { fontSize: 30, lineHeight: 40, letterSpacing: -1 },
  meta: { fontSize: 12, lineHeight: 18, color: colors.muted },
  tabs: { flexDirection: 'row', gap: 28, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { minHeight: 47, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: colors.accent },
  tabLabel: { fontSize: 13, color: colors.muted },
  activeTabLabel: { color: colors.text },
  section: { gap: 14, paddingTop: 3 },
  synopsis: { fontSize: 14, lineHeight: 25, color: '#C2C7CD' },
  previewButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 15, marginTop: 9, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, borderRadius: 11, borderCurve: 'continuous' },
  disabledPreviewButton: { opacity: 0.45 },
  previewButtonText: { flex: 1, fontSize: 12, lineHeight: 18 },
  production: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingTop: 5 },
  productionLabel: { width: 45, color: colors.muted, fontSize: 11, lineHeight: 18 },
  productionValue: { color: '#C2C7CD', fontSize: 12, lineHeight: 19 },
  episodes: { paddingTop: 3 },
  emptyEpisodes: { color: colors.muted, fontSize: 13, lineHeight: 21, paddingVertical: 10 },
  episodeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  episode: { width: '17.5%', minHeight: 63, paddingVertical: 10, gap: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 9, borderCurve: 'continuous' },
  episodeNumber: { color: colors.text, fontSize: 13, lineHeight: 19 },
  freeLabel: { color: colors.accent, fontSize: 9, lineHeight: 13 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  priceLabel: { color: colors.muted, fontSize: 9, lineHeight: 13 },
});
