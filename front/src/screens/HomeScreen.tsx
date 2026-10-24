import { useEffect, useMemo, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText, Button, EmptyState, Icon, Page, SectionTitle } from '@/components/ui';
import { AppTopBar } from '@/components/AppTopBar';
import { getDramaList, type DramaSummary } from '@/features/drama/dramaContent';
import { getHomeCollection, type HomeCollection, type HomeCollectionDrama } from '@/features/home/homeContent';
import { resolveApiImageUrl } from '@/common/media';
import { colors } from '@/common/theme/tokens';

const tabs = ['추천', '최신', '랭킹', '장르'] as const;

type CollectionStatus = 'loading' | 'loaded' | 'error';

function ApiDramaImage({ imageUrl, title, style }: { imageUrl: string | null; title: string; style: StyleProp<ImageStyle> }) {
  return imageUrl
    ? <Image source={{ uri: resolveApiImageUrl(imageUrl) ?? undefined }} accessibilityLabel={title + ' 표지'} contentFit="cover" transition={180} style={style} />
    : <View accessibilityLabel={title + ' 표지 없음'} style={[style as StyleProp<ViewStyle>, styles.imagePlaceholder]} />;
}

function collectionDramas(collection: HomeCollection | null): HomeCollectionDrama[] {
  return [...(collection?.dramas ?? [])].sort((first, second) => first.displayOrder - second.displayOrder);
}

function genreLabel(drama: HomeCollectionDrama): string {
  return drama.genres.map((genre) => genre.name).join(' · ') || '장르 정보 없음';
}

function summaryGenreLabel(drama: DramaSummary): string {
  return drama.genres.map((genre) => genre.name).join(' · ') || '장르 정보 없음';
}

function ApiRankRows({ dramas: apiDramas, onPress }: { dramas: HomeCollectionDrama[]; onPress: (drama: HomeCollectionDrama) => void }) {
  return <View>{apiDramas.map((drama, index) => (
    <Pressable key={drama.uuid} accessibilityRole="button" accessibilityLabel={(index + 1) + '위 ' + drama.title + ' 작품 소개'} style={styles.rankRow} onPress={() => onPress(drama)}>
      <AppText weight="bold" style={[styles.rankNumber, index === 0 && styles.accent]}>{index + 1}</AppText>
      <ApiDramaImage imageUrl={drama.imageUrls.posterLandscape ?? drama.imageUrls.poster} title={drama.title} style={styles.rankImage} />
      <View style={styles.rankCopy}>
        <AppText style={styles.overline}>{drama.productionCompany?.name ?? '제작사 정보 없음'}</AppText>
        <AppText weight="semibold" style={styles.rankTitle}>{drama.title}</AppText>
        <AppText style={styles.small}>{genreLabel(drama)} · {drama.publishedEpisodeCount}화</AppText>
        <AppText style={styles.free}>{drama.freeEpisodeCount}화까지 무료</AppText>
      </View>
      <Icon name="chevron-right" size={18} color={colors.muted} />
    </Pressable>
  ))}</View>;
}

function ApiPoster({ drama, width, onPress }: { drama: HomeCollectionDrama; width: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={drama.title + ' 작품 소개'} style={{ width, gap: 10 }}>
      <View style={[styles.apiPoster, { height: width * 1.48 }]}>
        <ApiDramaImage imageUrl={drama.imageUrls.poster} title={drama.title} style={StyleSheet.absoluteFill} />
      </View>
      <AppText weight="semibold" numberOfLines={1}>{drama.title}</AppText>
      <AppText style={styles.apiMeta}>{genreLabel(drama)} · {drama.freeEpisodeCount}화 무료</AppText>
    </Pressable>
  );
}

export function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<(typeof tabs)[number]>('추천');
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroWidth, setHeroWidth] = useState(0);
  const [featured, setFeatured] = useState<HomeCollection | null>(null);
  const [featuredStatus, setFeaturedStatus] = useState<CollectionStatus>('loading');
  const [daily, setDaily] = useState<HomeCollection | null>(null);
  const [dailyStatus, setDailyStatus] = useState<CollectionStatus>('loading');
  const [campaign, setCampaign] = useState<HomeCollection | null>(null);
  const [topThree, setTopThree] = useState<HomeCollection | null>(null);
  const [topThreeStatus, setTopThreeStatus] = useState<CollectionStatus>('loading');
  const [catalog, setCatalog] = useState<DramaSummary[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<CollectionStatus>('loading');

  useEffect(() => {
    let active = true;
    void getHomeCollection('HOME_FEATURED').then(
      (collection) => { if (active) { setFeatured(collection); setFeaturedStatus('loaded'); } },
      () => { if (active) setFeaturedStatus('error'); },
    );
    void getHomeCollection('RECOMMENDATION_DAILY').then(
      (collection) => { if (active) { setDaily(collection); setDailyStatus('loaded'); } },
      () => { if (active) setDailyStatus('error'); },
    );
    void getHomeCollection('EDITORIAL_TOP_3').then(
      (collection) => { if (active) { setTopThree(collection); setTopThreeStatus('loaded'); } },
      () => { if (active) setTopThreeStatus('error'); },
    );
    void getHomeCollection('HOME_CAMPAIGN').then(
      (collection) => { if (active) setCampaign(collection); },
      () => undefined,
    );
    void getDramaList().then(
      (dramaList) => { if (active) { setCatalog(dramaList); setCatalogStatus('loaded'); } },
      () => { if (active) setCatalogStatus('error'); },
    );
    return () => { active = false; };
  }, []);

  const featuredDramas = collectionDramas(featured);
  const dailyDramas = collectionDramas(daily);
  const topThreeDramas = collectionDramas(topThree);
  const campaignImage = collectionDramas(campaign)[0]?.imageUrls.campaigns[0] ?? null;
  const hero = featuredDramas[heroIndex];
  const heroResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gestureState) => featuredDramas.length > 1 && Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
    onPanResponderRelease: (_event, gestureState) => {
      if (heroWidth === 0 || Math.abs(gestureState.dx) < heroWidth * 0.15) return;
      setHeroIndex((index) => Math.max(0, Math.min(featuredDramas.length - 1, index + (gestureState.dx < 0 ? 1 : -1))));
    },
  }), [featuredDramas.length, heroWidth]);
  const posterWidth = Math.min(Math.max((Math.min(width, 960) - 58) / 2, 140), 230);
  const openDetail = (drama: DramaSummary | HomeCollectionDrama) => router.push({ pathname: '/drama/[id]', params: { id: drama.uuid } });
  const openGenre = (genre: string) => router.push({ pathname: '/search', params: { genre } });
  const collectionState = (status: CollectionStatus, title: string, emptyDescription: string) => status === 'loading'
    ? <EmptyState title={title + ' 불러오는 중'} description="잠시만 기다려 주세요." />
    : status === 'error'
      ? <EmptyState title={title + '을 불러오지 못했어요'} description="잠시 후 다시 확인해 주세요." />
      : <EmptyState title={title + ' 작품이 없어요'} description={emptyDescription} />;
  const ranks = topThreeStatus === 'loaded' && topThreeDramas.length > 0
    ? <ApiRankRows dramas={topThreeDramas} onPress={openDetail} />
    : collectionState(topThreeStatus, 'TOP 3', '새로운 작품을 준비하고 있어요.');

  return (
    <Page header={<AppTopBar />} contentStyle={styles.page}>
      <View style={styles.tabs} accessibilityRole="tablist">{tabs.map((item) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: item === tab }} style={[styles.tab, item === tab && styles.selectedTab]} onPress={() => setTab(item)}><AppText weight={item === tab ? 'bold' : 'medium'} style={[styles.tabText, item === tab && styles.selectedText]}>{item}</AppText></Pressable>)}</View>
      {tab === '추천' ? <>
        <View style={styles.hero} onLayout={(event) => setHeroWidth(event.nativeEvent.layout.width)} {...heroResponder.panHandlers}>
          {hero ? <ApiDramaImage imageUrl={hero.imageUrls.homeHero ?? hero.imageUrls.detailCover ?? hero.imageUrls.poster} title={hero.title} style={StyleSheet.absoluteFill as ImageStyle} /> : null}
          <LinearGradient pointerEvents="none" colors={['#0B0C0F00', '#0B0C0F29', '#0B0C0FE6', colors.background]} locations={[0.14, 0.35, 0.72, 1]} style={StyleSheet.absoluteFill} />
          <View style={styles.heroContent}>
            {hero ? <>
              <View style={styles.eyebrowRow}><View style={styles.liveDot} /><AppText weight="semibold" style={styles.eyebrow}>오늘의 발견  /  {hero.productionCompany?.name ?? '오늘의 추천'}</AppText></View>
              <AppText style={styles.heroCopy}>{hero.shortDescription}</AppText><AppText weight="bold" style={styles.heroTitle}>{hero.title}</AppText>
              <AppText style={styles.heroMeta}>{genreLabel(hero)}  ·  {hero.publishedEpisodeCount}화 공개  ·  {hero.freeEpisodeCount}화 무료</AppText>
              <View style={styles.heroActions}>
                <Button style={styles.heroButton} disabled label="재생 준비 중" icon={<Icon name="play" size={17} color={colors.background} />} onPress={() => undefined} />
                <Pressable disabled style={styles.saveButton} accessibilityRole="button" accessibilityLabel="저장 기능 준비 중" accessibilityState={{ disabled: true }}><Icon name="plus" size={23} color={colors.text} /></Pressable>
              </View>
              <Pressable style={styles.detailLink} accessibilityRole="button" onPress={() => openDetail(hero)}><AppText style={styles.detailLinkText}>작품 소개</AppText><Icon name="arrow-up-right" size={14} color={colors.muted} /></Pressable>
            </> : <View style={styles.heroEmpty}>{collectionState(featuredStatus, '추천 작품', '추천 작품이 없습니다.')}</View>}
          </View>
          {featuredDramas.length > 1 ? <View style={styles.heroPagination}>{featuredDramas.map((drama, index) => <Pressable key={drama.uuid} style={styles.heroPageButton} accessibilityRole="button" accessibilityLabel={drama.title + ' 추천 보기'} accessibilityState={{ selected: heroIndex === index }} onPress={() => setHeroIndex(index)}><View style={[styles.heroPageLine, heroIndex === index && styles.activePageLine]} /><AppText style={[styles.heroPageNumber, heroIndex === index && styles.accent]}>{String(index + 1).padStart(2, '0')}</AppText></Pressable>)}</View> : null}
        </View>
        {dailyStatus === 'loaded' && dailyDramas.length > 0
          ? <>
            <View style={styles.section}><SectionTitle eyebrow="QUICK ESCAPE" title="1분이면, 빠져드는 이야기" action="전체" onAction={() => setTab('최신')} /></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.posterRail}>{dailyDramas.map((drama) => <ApiPoster key={drama.uuid} drama={drama} width={posterWidth} onPress={() => openDetail(drama)} />)}</ScrollView>
          </>
          : <View style={styles.section}><SectionTitle eyebrow="QUICK ESCAPE" title="1분이면, 빠져드는 이야기" />{collectionState(dailyStatus, '오늘의 추천', '추천 작품이 없습니다.')}</View>}
        {campaignImage ? <Pressable accessibilityRole="button" accessibilityLabel="로맨스 만나기" onPress={() => openGenre('ROMANCE')} style={styles.campaignBanner}>
          <ApiDramaImage imageUrl={campaignImage} title="로맨스 캠페인" style={StyleSheet.absoluteFill} />
          <LinearGradient pointerEvents="none" colors={['#0B0C0F12', '#0B0C0FDD']} style={StyleSheet.absoluteFill} />
          <View style={styles.campaignCopy}>
            <AppText weight="semibold" style={styles.campaignEyebrow}>오늘은, 설레도 괜찮아.</AppText>
            <AppText weight="bold" style={styles.campaignTitle}>퇴근길을 채울 로맨스 한 편</AppText>
            <View style={styles.campaignLink}><AppText weight="semibold" style={styles.campaignLinkText}>로맨스 만나기</AppText><Icon name="arrow-right" size={15} color={colors.text} /></View>
          </View>
        </Pressable> : null}
        <View style={styles.section}>
          <SectionTitle eyebrow="EDITOR’S PICK" title="지금 눈여겨볼 TOP 3" action="더 보기" onAction={() => setTab('랭킹')} />{ranks}
          <Pressable style={styles.previewLink} accessibilityRole="button" onPress={() => router.push('/recommend')}><View style={styles.previewIcon}><Icon name="film" color={colors.accent} size={24} /></View><View style={styles.flex}><AppText weight="semibold" style={styles.previewTitle}>어떤 이야기가 취향인가요?</AppText><AppText style={styles.small}>넘겨보며 다음 드라마를 골라보세요.</AppText></View><Icon name="arrow-right" color={colors.text} size={19} /></Pressable>
        </View>
      </> : tab === '최신' ? <View style={styles.section}><SectionTitle eyebrow="JUST ARRIVED" title="새로운 이야기가 도착했어요" />{catalogStatus === 'loaded' && catalog.length > 0 ? <View style={styles.posterGrid}>{catalog.map((drama) => <Pressable key={drama.uuid} accessibilityRole="button" accessibilityLabel={drama.title + ' 작품 소개'} style={{ width: posterWidth, gap: 10 }} onPress={() => openDetail(drama)}><View style={[styles.apiPoster, { height: posterWidth * 1.48 }]}><ApiDramaImage imageUrl={drama.imageUrls.poster} title={drama.title} style={StyleSheet.absoluteFill} /></View><AppText weight="semibold" numberOfLines={1}>{drama.title}</AppText><AppText style={styles.apiMeta}>{summaryGenreLabel(drama)} · {drama.freeEpisodeCount}화 무료</AppText></Pressable>)}</View> : collectionState(catalogStatus, '최신 작품', '새로운 작품을 준비하고 있어요.')}</View> : tab === '랭킹' ? <View style={styles.section}><SectionTitle eyebrow="THE TOP THREE" title="지금 눈여겨볼 TOP 3" /><AppText style={styles.intro}>편집부가 고른 이번 주의 이야기</AppText>{ranks}</View> : <View style={styles.section}><SectionTitle eyebrow="FIND YOUR MOOD" title="오늘은 어떤 이야기인가요?" />{catalogStatus === 'loaded' && catalog.some((drama) => drama.genres.length > 0) ? <View style={styles.genreList}>{Array.from(new Map(catalog.flatMap((drama) => drama.genres.map((genre) => [genre.name, { genre, drama }] as const))).values()).map(({ genre, drama }) => <Pressable key={genre.id} style={styles.genreTile} accessibilityRole="button" accessibilityLabel={`${genre.name} 작품 찾기`} onPress={() => openGenre(genre.code)}><ApiDramaImage imageUrl={drama.imageUrls.posterLandscape ?? drama.imageUrls.poster} title={genre.name} style={StyleSheet.absoluteFill} /><LinearGradient pointerEvents="none" colors={['#0B0C0FDB', '#0B0C0F10']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /><View style={styles.genreContent}><AppText weight="bold" style={styles.genreTitle}>{genre.name}</AppText><Icon name="arrow-up-right" color={colors.text} size={23} /></View></Pressable>)}</View> : collectionState(catalogStatus, '장르', '작품 장르를 준비하고 있어요.')}</View>}
    </Page>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 28, gap: 0 }, flex: { flex: 1 }, heroButton: { flex: 1, paddingHorizontal: 12 },
  tabs: { flexDirection: 'row', gap: 25, paddingHorizontal: 22, marginBottom: 18 }, tab: { minHeight: 44, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' }, selectedTab: { borderBottomColor: colors.accent }, tabText: { fontSize: 15, color: colors.muted }, selectedText: { color: colors.text },
  hero: { minHeight: 550, marginHorizontal: 14, borderRadius: 20, borderCurve: 'continuous', overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: colors.surface },
  heroEmpty: { paddingHorizontal: 22, paddingTop: 240, paddingBottom: 10 },
  imagePlaceholder: { backgroundColor: colors.surface },
  apiPoster: { overflow: 'hidden', borderRadius: 14, borderCurve: 'continuous', backgroundColor: colors.surface },
  apiMeta: { fontSize: 13, lineHeight: 19, color: colors.muted },
  heroContent: { paddingHorizontal: 22, paddingTop: 240, paddingBottom: 10, gap: 12 }, eyebrowRow: { flexDirection: 'row', gap: 7, alignItems: 'center' }, liveDot: { width: 5, height: 5, borderRadius: 3, borderCurve: 'continuous', backgroundColor: colors.accent }, eyebrow: { fontSize: 9, lineHeight: 15, letterSpacing: 1.2, color: colors.text },
  heroCopy: { fontSize: 16, lineHeight: 23, color: '#E8EBE4' }, heroTitle: { fontSize: 40, lineHeight: 49, letterSpacing: -1.5 }, heroMeta: { fontSize: 11, lineHeight: 17, color: '#CAD0D0' }, heroActions: { flexDirection: 'row', gap: 8, marginTop: 7 },
  saveButton: { width: 50, minHeight: 50, borderRadius: 12, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }, savedButton: { borderColor: '#65794A' },
  detailLink: { minHeight: 35, flexDirection: 'row', gap: 6, alignItems: 'center', alignSelf: 'flex-start' }, detailLinkText: { color: colors.muted, fontSize: 11 },
  heroPagination: { flexDirection: 'row', gap: 7, alignSelf: 'center', paddingBottom: 10 }, heroPageButton: { minWidth: 34, minHeight: 35, alignItems: 'center', justifyContent: 'center', gap: 4 }, heroPageLine: { width: 20, height: 2, backgroundColor: colors.border }, activePageLine: { width: 28, backgroundColor: colors.accent }, heroPageNumber: { fontSize: 9, color: colors.muted },
  section: { paddingHorizontal: 22, paddingTop: 30 }, posterRail: { paddingHorizontal: 22, gap: 14, paddingTop: 17, paddingBottom: 6 }, posterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingTop: 20 },
  rankRow: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }, rankNumber: { width: 18, fontSize: 22, color: colors.muted }, rankImage: { width: 112, height: 63, borderRadius: 7, borderCurve: 'continuous' }, rankCopy: { flex: 1, minWidth: 0, gap: 3 }, overline: { fontSize: 8, lineHeight: 12, letterSpacing: 1, color: colors.muted }, rankTitle: { fontSize: 14 }, small: { fontSize: 10, lineHeight: 14, color: colors.muted }, free: { fontSize: 10, lineHeight: 14, color: colors.accent }, accent: { color: colors.accent },
  campaignBanner: { aspectRatio: 2, marginHorizontal: 22, marginTop: 30, borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: colors.surface }, campaignCopy: { paddingHorizontal: 18, paddingVertical: 15, gap: 5 }, campaignEyebrow: { fontSize: 11, color: '#E8EBE4' }, campaignTitle: { fontSize: 18, lineHeight: 24 }, campaignLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }, campaignLinkText: { fontSize: 11 },
  previewLink: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', padding: 17, marginTop: 30 }, previewIcon: { width: 37, height: 46, justifyContent: 'center', alignItems: 'center' }, previewTitle: { fontSize: 14, marginBottom: 5 }, intro: { color: colors.muted, fontSize: 13, marginTop: 10, marginBottom: 10 },
  genreList: { gap: 15, marginTop: 20 }, genreTile: { minHeight: 175, borderRadius: 15, borderCurve: 'continuous', overflow: 'hidden', justifyContent: 'flex-end' }, genreContent: { padding: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, genreTitle: { fontSize: 28 },
});
