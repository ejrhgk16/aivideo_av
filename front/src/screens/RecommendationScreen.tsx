import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { AppText, EmptyState, Page, SectionTitle } from '@/components/ui';
import { resolveApiImageUrl } from '@/common/media';
import { colors } from '@/common/theme/tokens';
import { getHomeCollection, type HomeCollection, type HomeCollectionDrama } from '@/features/home/homeContent';

type CollectionStatus = 'loading' | 'loaded' | 'error';

function imageFor(drama: HomeCollectionDrama) {
  return drama.imageUrls.poster ? resolveApiImageUrl(drama.imageUrls.poster) : null;
}

export function RecommendationScreen({ initialId }: { initialId?: string }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [collection, setCollection] = useState<HomeCollection | null>(null);
  const [status, setStatus] = useState<CollectionStatus>('loading');
  const posterWidth = Math.min(Math.max((Math.min(width, 960) - 58) / 2, 140), 230);

  useEffect(() => {
    let active = true;
    void getHomeCollection('RECOMMENDATION_DAILY').then(
      (result) => { if (active) { setCollection(result); setStatus('loaded'); } },
      () => { if (active) setStatus('error'); },
    );
    return () => { active = false; };
  }, []);

  const dramas = [...(collection?.dramas ?? [])].sort((first, second) => {
    if (first.id === initialId) return -1;
    if (second.id === initialId) return 1;
    return first.displayOrder - second.displayOrder;
  });
  const openDetail = (id: string) => router.push({ pathname: '/drama/[id]', params: { id } });

  return <Page>
    <SectionTitle title="오늘의 추천" eyebrow="DAILY PICKS" />
    {status === 'loading' ? <EmptyState title="추천 작품 불러오는 중" description="잠시만 기다려 주세요." />
      : status === 'error' ? <EmptyState title="추천 작품을 불러오지 못했어요" description="잠시 후 다시 확인해 주세요." />
        : dramas.length === 0 ? <EmptyState title="오늘의 추천 작품이 없어요" description="새로운 작품을 준비하고 있어요." />
          : <View style={styles.grid}>{dramas.map((drama) => <Pressable key={drama.id} accessibilityRole="button" accessibilityLabel={`${drama.title} 작품 소개`} style={{ width: posterWidth, gap: 10 }} onPress={() => openDetail(drama.id)}>
            <View style={[styles.poster, { height: posterWidth * 1.48 }]}>
              {imageFor(drama) ? <Image source={{ uri: imageFor(drama) ?? undefined }} accessibilityLabel={`${drama.title} 표지`} contentFit="cover" style={StyleSheet.absoluteFill} /> : <View accessibilityLabel={`${drama.title} 표지 없음`} style={styles.placeholder} />}
            </View>
            <AppText weight="semibold" numberOfLines={1}>{drama.title}</AppText>
            <AppText style={styles.meta}>{drama.genres.map((genre) => genre.name).join(' · ') || '장르 정보 없음'} · {drama.freeEpisodeCount}화 무료</AppText>
          </Pressable>)}</View>}
  </Page>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  poster: { overflow: 'hidden', borderRadius: 14, borderCurve: 'continuous', backgroundColor: colors.surface },
  placeholder: { flex: 1, backgroundColor: colors.surface },
  meta: { fontSize: 13, lineHeight: 19, color: colors.muted },
});
