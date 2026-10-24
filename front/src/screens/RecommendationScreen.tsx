import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, Share, StyleSheet, View } from 'react-native';
import { AppText, EmptyState, Icon, Page } from '@/components/ui';
import { resolveApiImageUrl } from '@/common/media';
import { colors } from '@/common/theme/tokens';
import { getHomeCollection, type HomeCollection, type HomeCollectionDrama } from '@/features/home/homeContent';

type CollectionStatus = 'loading' | 'loaded' | 'error';

function imageFor(drama: HomeCollectionDrama) {
  return drama.imageUrls.poster ? resolveApiImageUrl(drama.imageUrls.poster) : null;
}

export function RecommendationScreen({ initialId }: { initialId?: string }) {
  const router = useRouter();
  const [collection, setCollection] = useState<HomeCollection | null>(null);
  const [status, setStatus] = useState<CollectionStatus>('loading');
  const [cardHeight, setCardHeight] = useState(0);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    void getHomeCollection('RECOMMENDATION_DAILY').then(
      (result) => { if (active) { setCollection(result); setStatus('loaded'); } },
      () => { if (active) setStatus('error'); },
    );
    return () => { active = false; };
  }, []);

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
              renderItem={({ item: drama }) => {
                const posterUrl = imageFor(drama);
                const genres = drama.genres.map((genre) => genre.name).join(' · ') || '장르 정보 없음';
                const saved = savedIds.includes(drama.uuid);
                return <View style={[styles.card, { height: cardHeight }]}>
                  {posterUrl ? <Image source={{ uri: posterUrl }} accessibilityLabel={`${drama.title} 표지`} contentFit="cover" style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, styles.placeholder]} />}
                  <LinearGradient pointerEvents="none" colors={['#03060BAA', 'transparent', '#070C13A8', '#070C13']} locations={[0, 0.33, 0.65, 1]} style={StyleSheet.absoluteFill} />
                  <View style={styles.topBar}>
                    <View>
                      <AppText weight="bold" style={styles.screenTitle}>추천</AppText>
                      <AppText style={styles.previewLabel}>예고 · 1화</AppText>
                    </View>
                    <View style={styles.previewBadge}><Icon name="film" size={14} color={colors.text} /><AppText style={styles.previewBadgeText}>표지 미리보기 · 영상 연결 전</AppText></View>
                  </View>
                  <Pressable style={styles.playMark} accessibilityRole="button" accessibilityLabel={`${drama.title} 회차 목록 열기`} onPress={() => openEpisodes(drama)}>
                    <Icon name="play" size={29} color={colors.text} />
                  </Pressable>
                  <View style={styles.sideActions}>
                    <Pressable accessibilityRole="button" accessibilityLabel={saved ? `${drama.title} 저장 해제` : `${drama.title} 저장`} accessibilityState={{ selected: saved }} style={styles.action} onPress={() => toggleSave(drama.uuid)}>
                      <Icon name="bookmark" size={25} color={saved ? colors.accent : colors.text} />
                      <AppText style={styles.actionLabel}>{saved ? '저장됨' : '저장'}</AppText>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${drama.title} 회차 목록`} style={styles.action} onPress={() => openEpisodes(drama)}>
                      <Icon name="layers" size={25} color={colors.text} />
                      <AppText style={styles.actionLabel}>회차</AppText>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${drama.title} 공유`} style={styles.action} onPress={() => { void shareDrama(drama); }}>
                      <Icon name="share-2" size={24} color={colors.text} />
                      <AppText style={styles.actionLabel}>공유</AppText>
                    </Pressable>
                  </View>
                  <View style={styles.bottomInfo}>
                    <AppText style={styles.meta}><AppText style={styles.freeBadge}>{drama.freeEpisodeCount}화 무료</AppText>  ·  {genres}</AppText>
                    <AppText weight="bold" numberOfLines={1} style={styles.title}>{drama.title}</AppText>
                    <AppText numberOfLines={2} style={styles.description}>{drama.shortDescription || '새로운 이야기를 만나보세요.'}</AppText>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${drama.title} 전체 회차 보기`} style={styles.watchButton} onPress={() => openEpisodes(drama)}>
                      <Icon name="play" size={16} color={colors.background} />
                      <AppText weight="semibold" style={styles.watchLabel}>1화부터 본편 보기</AppText>
                      <AppText style={styles.watchMeta}>{drama.freeEpisodeCount}화 무료</AppText>
                    </Pressable>
                  </View>
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
  placeholder: { backgroundColor: colors.surface },
  topBar: { position: 'absolute', top: 17, left: 22, right: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  screenTitle: { fontSize: 23, lineHeight: 30, letterSpacing: -0.7 },
  previewLabel: { color: '#DEE7E8', fontSize: 12, lineHeight: 18, marginTop: 1 },
  previewBadge: { maxWidth: '68%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 7, backgroundColor: '#07121CCC' },
  previewBadgeText: { color: '#DFE7EA', fontSize: 10, lineHeight: 15 },
  playMark: { alignSelf: 'center', width: 66, height: 66, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFFFFF40', borderRadius: 40, backgroundColor: '#0005' },
  sideActions: { position: 'absolute', right: 12, bottom: 205, gap: 15 },
  action: { minWidth: 48, minHeight: 49, alignItems: 'center', justifyContent: 'center', gap: 4 },
  actionLabel: { fontSize: 11, lineHeight: 16, color: colors.text, textShadowColor: '#000A', textShadowRadius: 5 },
  bottomInfo: { position: 'absolute', left: 21, right: 75, bottom: 18, gap: 7 },
  meta: { color: '#BCC8D3', fontSize: 11, lineHeight: 17 },
  freeBadge: { color: '#D0E8B6', fontSize: 11, lineHeight: 17 },
  title: { fontSize: 28, lineHeight: 36, letterSpacing: -0.9 },
  description: { minHeight: 38, color: '#C0CCD4', fontSize: 13, lineHeight: 19 },
  watchButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6, paddingHorizontal: 13, borderRadius: 12, backgroundColor: colors.accent },
  watchLabel: { color: colors.background, fontSize: 13, lineHeight: 19 },
  watchMeta: { marginLeft: 'auto', paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#16200733', color: colors.background, fontSize: 10, lineHeight: 15 },
});
