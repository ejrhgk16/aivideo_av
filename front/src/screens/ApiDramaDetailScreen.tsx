import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { AppText, EmptyState, Icon, Page } from '@/components/ui';
import { resolveApiImageUrl } from '@/common/media';
import { colors } from '@/common/theme/tokens';
import { getDramaContent, type DramaContent } from '@/features/drama/dramaContent';

type LoadState = 'loading' | 'loaded' | 'not-found' | 'error';

export function ApiDramaDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const [drama, setDrama] = useState<DramaContent | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setDrama(null);
    setImageFailed(false);
    setLoadState('loading');

    getDramaContent(id).then((content) => {
      if (!active) return;
      setDrama(content);
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
        <AppText style={styles.meta}>{drama.episodes.length}화 공개</AppText>
      </View>
      <View style={styles.section}>
        <AppText weight="semibold" style={styles.sectionTitle}>작품 소개</AppText>
        <AppText style={styles.synopsis}>{drama.synopsis || drama.shortDescription}</AppText>
        {drama.productionCompany ? <View style={styles.production}><AppText style={styles.productionLabel}>제작사</AppText><AppText weight="medium" style={styles.productionValue}>{drama.productionCompany}</AppText></View> : null}
      </View>
      <View style={styles.section}>
        <AppText weight="semibold" style={styles.sectionTitle}>공개 회차  {drama.episodes.length}</AppText>
        {drama.episodes.length === 0 ? <AppText style={styles.emptyEpisodes}>공개된 회차가 아직 없어요.</AppText> : drama.episodes.map((episode) => (
          <View key={episode.id} style={styles.episode}>
            <View style={styles.episodeHeading}>
              <AppText weight="semibold" style={styles.episodeNumber}>{episode.episodeNumber}화</AppText>
              <AppText style={episode.pricePoints === 0 ? styles.freeLabel : styles.priceLabel}>{episode.pricePoints === 0 ? '무료' : `${episode.pricePoints}P`}</AppText>
            </View>
            <AppText weight="medium" style={styles.episodeTitle}>{episode.title || `제${episode.episodeNumber}화`}</AppText>
            {episode.synopsis ? <AppText style={styles.episodeSynopsis}>{episode.synopsis}</AppText> : null}
          </View>
        ))}
      </View>
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
  section: { gap: 14 },
  sectionTitle: { fontSize: 17, lineHeight: 24 },
  synopsis: { fontSize: 14, lineHeight: 25, color: '#C2C7CD' },
  production: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingTop: 5 },
  productionLabel: { width: 45, color: colors.muted, fontSize: 11, lineHeight: 18 },
  productionValue: { color: '#C2C7CD', fontSize: 12, lineHeight: 19 },
  emptyEpisodes: { color: colors.muted, fontSize: 13, lineHeight: 21, paddingVertical: 10 },
  episode: { gap: 7, paddingVertical: 14, paddingHorizontal: 15, borderRadius: 12, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  episodeHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  episodeNumber: { fontSize: 12, lineHeight: 18, color: colors.muted },
  freeLabel: { color: colors.accent, fontSize: 11, lineHeight: 17 },
  priceLabel: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  episodeTitle: { fontSize: 14, lineHeight: 21 },
  episodeSynopsis: { color: colors.muted, fontSize: 12, lineHeight: 19 },
});
