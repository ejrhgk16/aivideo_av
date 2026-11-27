import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText, Button, EmptyState, Icon, LoadingState, Page, Peeka, SectionTitle } from '@/components/ui';
import { AppTopBar } from '@/components/AppTopBar';
import { EpisodeUnlockDialog } from '@/components/EpisodeUnlockDialog';
import { getDramaContent, getDramaList, getGenres, type DramaContent, type DramaSummary, type GenreSummary } from '@/features/drama/dramaContent';
import { SessionChangedError } from '@/common/http/api';
import { resumeLabel, resumePoint } from '@/features/drama/resumePoint';
import { getHomeCollection, type HomeCollection, type HomeCollectionDrama } from '@/features/home/homeContent';
import { removeSavedVideo, saveVideo } from '@/features/playback/savedVideos';
import { getWatchHistory, type WatchHistoryItem } from '@/features/playback/watchHistory';
import { resolveApiImageUrl } from '@/common/media';
import { radius, spacing, textSizes } from '@/common/theme/tokens';
import { createThemedStyles, useColors } from '@/common/theme/theme';
import { useUser } from '@/features/user/UserProvider';

const tabs = ['오늘', '랭킹', '장르'] as const;

type CollectionStatus = 'loading' | 'loaded' | 'error';
type Episode = DramaContent['episodes'][number];
type HeroContent = { dramaUuid: string; status: CollectionStatus; content: DramaContent | null };
type ResumeItem = Extract<WatchHistoryItem, { contentType: 'EPISODE' }>;

function ApiDramaImage({ imageUrl, title, style }: { imageUrl: string | null; title: string; style: StyleProp<ImageStyle> }) {
  const styles = useStyles();
  return imageUrl
    ? <Image source={{ uri: resolveApiImageUrl(imageUrl) ?? undefined }} accessibilityLabel={title + ' 표지'} contentFit="cover" transition={180} style={style} />
    : <View accessibilityLabel={title + ' 표지 없음'} style={[style as StyleProp<ViewStyle>, styles.imagePlaceholder]} />;
}

function collectionDramas(collection: HomeCollection | null): HomeCollectionDrama[] {
  return [...(collection?.dramas ?? [])].sort((first, second) => first.displayOrder - second.displayOrder);
}

function genreLabel(drama: { genres: Array<{ name: string }> }): string {
  return drama.genres.map((genre) => genre.name).join(' · ') || '장르 정보 없음';
}

function ApiRankRows({ dramas: apiDramas, onPress }: { dramas: HomeCollectionDrama[]; onPress: (drama: HomeCollectionDrama) => void }) {
  const styles = useStyles();
  const colors = useColors();
  return <View>{apiDramas.map((drama, index) => (
    <Pressable key={drama.uuid} accessibilityRole="button" accessibilityLabel={(index + 1) + '위 ' + drama.title + ' 작품 소개'} style={styles.rankRow} onPress={() => onPress(drama)}>
      <AppText weight="extrabold" style={styles.rankRowNumber}>{index + 1}</AppText>
      <ApiDramaImage imageUrl={drama.imageUrls.poster} title={drama.title} style={styles.rowPoster} />
      <View style={styles.rowCopy}>
        <AppText weight="semibold" numberOfLines={1} style={styles.rowTitle}>{drama.title}</AppText>
        <AppText style={styles.rowMeta}>{genreLabel(drama)} · {drama.publishedEpisodeCount}화</AppText>
        <AppText weight="semibold" style={styles.free}>{drama.freeEpisodeCount}화까지 무료</AppText>
      </View>
      <Icon name="chevron-right" size={18} color={colors.muted} />
    </Pressable>
  ))}</View>;
}

export function HomeScreen() {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const { isRestoring, sessionVersion, isCurrentSession, user } = useUser();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<(typeof tabs)[number]>('오늘');
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroWidth, setHeroWidth] = useState(0);
  const [featured, setFeatured] = useState<HomeCollection | null>(null);
  const [featuredStatus, setFeaturedStatus] = useState<CollectionStatus>('loading');
  const [campaign, setCampaign] = useState<HomeCollection | null>(null);
  const [topThree, setTopThree] = useState<HomeCollection | null>(null);
  const [topThreeStatus, setTopThreeStatus] = useState<CollectionStatus>('loading');
  const [catalog, setCatalog] = useState<DramaSummary[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<CollectionStatus>('loading');
  const [genres, setGenres] = useState<GenreSummary[]>([]);
  const [genresStatus, setGenresStatus] = useState<CollectionStatus>('loading');
  const [history, setHistory] = useState<ResumeItem[]>([]);
  const [historyStatus, setHistoryStatus] = useState<CollectionStatus>('loading');
  const [heroContent, setHeroContent] = useState<HeroContent | null>(null);
  const [focusKey, setFocusKey] = useState(0);
  const [lockedEpisode, setLockedEpisode] = useState<Episode | null>(null);
  const [savedOverrides, setSavedOverrides] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const savePending = useRef(false);
  const generation = useRef(0);
  const inFlight = useRef(false);

  const loadCatalog = useCallback(async (requestGeneration: number, version: number) => {
    if (inFlight.current || isRestoring) return;
    inFlight.current = true;
    const isCurrent = () => generation.current === requestGeneration && isCurrentSession(version);
    setCatalog([]);
    setCatalogStatus('loading');
    try {
      const result = await getDramaList({ page: 1 });
      if (!isCurrent()) return;
      setCatalog(result.items);
      setCatalogStatus('loaded');
    } catch (error) {
      if (!isCurrent() || error instanceof SessionChangedError) return;
      setCatalogStatus('error');
    } finally {
      if (isCurrent()) inFlight.current = false;
    }
  }, [isCurrentSession, isRestoring]);

  useFocusEffect(useCallback(() => {
    let active = true;
    const version = sessionVersion;
    const requestGeneration = ++generation.current;
    inFlight.current = false;
    savePending.current = false;
    setFeatured(null); setCampaign(null); setTopThree(null); setCatalog([]);
    setFeaturedStatus('loading'); setTopThreeStatus('loading'); setCatalogStatus('loading');
    setGenres([]); setGenresStatus('loading');
    setHistory([]); setHistoryStatus('loading');
    setHeroContent(null); setSavedOverrides({}); setSaving(false); setLockedEpisode(null);
    if (isRestoring) return () => { active = false; generation.current += 1; inFlight.current = false; };
    setHeroIndex(0);
    setFocusKey(requestGeneration);
    const isCurrent = () => active && isCurrentSession(version);
    void getHomeCollection('HOME_FEATURED').then(
      (collection) => { if (isCurrent()) { setFeatured(collection); setFeaturedStatus('loaded'); } },
      () => { if (isCurrent()) setFeaturedStatus('error'); },
    );
    void getHomeCollection('EDITORIAL_TOP_3').then(
      (collection) => { if (isCurrent()) { setTopThree(collection); setTopThreeStatus('loaded'); } },
      () => { if (isCurrent()) setTopThreeStatus('error'); },
    );
    void getHomeCollection('HOME_CAMPAIGN').then(
      (collection) => { if (isCurrent()) setCampaign(collection); },
      () => undefined,
    );
    void loadCatalog(requestGeneration, version);
    void getGenres().then(
      (result) => { if (isCurrent() && generation.current === requestGeneration) { setGenres(result); setGenresStatus('loaded'); } },
      () => { if (isCurrent() && generation.current === requestGeneration) setGenresStatus('error'); },
    );
    if (user) {
      // 이어보기는 회차 기록만, 작품마다 가장 최근 것 하나만 쓴다.
      void getWatchHistory(1).then(
        (result) => {
          if (!isCurrent()) return;
          const seen = new Set<string>();
          setHistory(result.items.filter((item): item is ResumeItem => {
            if (item.contentType !== 'EPISODE' || seen.has(item.dramaUuid)) return false;
            seen.add(item.dramaUuid);
            return true;
          }));
          setHistoryStatus('loaded');
        },
        () => { if (isCurrent()) setHistoryStatus('error'); },
      );
    } else {
      setHistoryStatus('loaded');
    }
    return () => { active = false; generation.current += 1; inFlight.current = false; };
  }, [isRestoring, sessionVersion, user?.uuid, isCurrentSession, loadCatalog]));

  const featuredDramas = collectionDramas(featured);
  const topThreeDramas = collectionDramas(topThree);
  const campaignImage = collectionDramas(campaign)[0]?.imageUrls.campaigns[0] ?? null;
  const hero = featuredDramas[heroIndex];
  const heroPreview = hero?.previewVideos[0];
  const heroUuid = hero?.uuid;

  // 주 버튼 문구와 회차는 작품 상세의 회차·시청 진행으로 정한다.
  useEffect(() => {
    if (!heroUuid || isRestoring || focusKey === 0) return;
    let active = true;
    const version = sessionVersion;
    setHeroContent({ dramaUuid: heroUuid, status: 'loading', content: null });
    void getDramaContent(heroUuid).then(
      (content) => { if (active && isCurrentSession(version)) setHeroContent({ dramaUuid: heroUuid, status: 'loaded', content }); },
      () => { if (active && isCurrentSession(version)) setHeroContent({ dramaUuid: heroUuid, status: 'error', content: null }); },
    );
    return () => { active = false; };
  }, [heroUuid, isRestoring, sessionVersion, isCurrentSession, focusKey]);

  const currentHeroContent = heroContent?.dramaUuid === heroUuid ? heroContent : null;
  const heroResume = currentHeroContent?.content ? resumePoint(currentHeroContent.content) : null;
  const heroLoading = !currentHeroContent || currentHeroContent.status === 'loading';
  const heroLabel = resumeLabel(heroResume, hero?.freeEpisodeCount ?? 0, heroLoading);
  const heroSaved = heroPreview ? savedOverrides[heroPreview.uuid] ?? heroPreview.isSaved : false;

  const openDetail = (drama: { uuid: string }) => router.push({ pathname: '/drama/[id]', params: { id: drama.uuid } });
  const openGenre = (genre: string) => router.push({ pathname: '/search', params: { genre } });
  const openEpisode = (episode: Episode, dramaUuid: string) => {
    if (episode.pricePoints > 0 && !episode.isUnlocked) {
      setLockedEpisode(episode);
      return;
    }
    router.push({ pathname: '/episode/[id]', params: { id: episode.uuid, dramaId: dramaUuid } });
  };
  const startHero = () => {
    if (!hero || isRestoring || heroLoading) return;
    if (heroResume) openEpisode(heroResume.episode, hero.uuid);
    else openDetail(hero);
  };
  const toggleHeroSaved = async () => {
    if (!heroPreview || isRestoring || savePending.current) return;
    if (!user) { router.push('/auth/login'); return; }
    const version = sessionVersion;
    const videoUuid = heroPreview.uuid;
    const nextSaved = !heroSaved;
    savePending.current = true;
    setSaving(true);
    try {
      if (nextSaved) await saveVideo(videoUuid, 'PREVIEW');
      else await removeSavedVideo(videoUuid);
      if (isCurrentSession(version)) setSavedOverrides((current) => ({ ...current, [videoUuid]: nextSaved }));
    } catch {
      // 저장 상태를 바꾸지 않고 다시 누를 수 있게 둔다.
    } finally {
      if (isCurrentSession(version)) { savePending.current = false; setSaving(false); }
    }
  };
  const retryGenres = () => {
    const requestGeneration = generation.current;
    const version = sessionVersion;
    setGenresStatus('loading');
    void getGenres().then(
      (result) => { if (generation.current === requestGeneration && isCurrentSession(version)) { setGenres(result); setGenresStatus('loaded'); } },
      () => { if (generation.current === requestGeneration && isCurrentSession(version)) setGenresStatus('error'); },
    );
  };
  const retryCatalog = () => void loadCatalog(generation.current, sessionVersion);

  const heroResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gestureState) => featuredDramas.length > 1 && Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
    onPanResponderRelease: (_event, gestureState) => {
      if (heroWidth === 0 || Math.abs(gestureState.dx) < heroWidth * 0.15) return;
      setHeroIndex((index) => Math.max(0, Math.min(featuredDramas.length - 1, index + (gestureState.dx < 0 ? 1 : -1))));
    },
  }), [featuredDramas.length, heroWidth]);
  const contentWidth = Math.min(width, 960);
  const posterWidth = Math.round(Math.min(Math.max(contentWidth * 0.3, 104), 160));
  const rankPosterWidth = Math.round(Math.min(contentWidth * 0.2, 112));
  const contentLoading = isRestoring || (tab === '오늘'
    ? featuredStatus === 'loading' || topThreeStatus === 'loading' || catalogStatus === 'loading' || historyStatus === 'loading'
    : tab === '랭킹' ? topThreeStatus === 'loading'
      : genresStatus === 'loading');

  const tabBar = <View style={styles.tabs} accessibilityRole="tablist">{tabs.map((item) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: item === tab }} style={[styles.tab, item === tab && styles.selectedTab]} onPress={() => setTab(item)}><AppText weight="semibold" style={[styles.tabText, item === tab && styles.selectedText]}>{item}</AppText></Pressable>)}</View>;
  const collectionState = (status: CollectionStatus, title: string, emptyDescription: string) => status === 'loading'
    ? <LoadingState />
    : status === 'error'
      ? <EmptyState title={title + '을 불러오지 못했어요'} description="잠시 후 다시 확인해 주세요." />
      : <EmptyState title={title + ' 작품이 없어요'} description={emptyDescription} />;

  const heroSection = <View style={[styles.hero, hero ? { minHeight: Math.max(Math.round(contentWidth * 1.25), 480) } : styles.heroBlank]} onLayout={(event) => setHeroWidth(event.nativeEvent.layout.width)} {...heroResponder.panHandlers}>
    {hero ? <ApiDramaImage imageUrl={hero.imageUrls.homeHero ?? hero.imageUrls.poster ?? hero.imageUrls.detailCover} title={hero.title} style={StyleSheet.absoluteFill as ImageStyle} /> : null}
    {hero ? <LinearGradient pointerEvents="none" colors={['transparent', colors.mediaBack, colors.night]} locations={[0.3, 0.6, 1]} style={StyleSheet.absoluteFill} /> : null}
    {hero ? <View style={styles.heroContent}>
      <AppText style={styles.heroMeta}>{genreLabel(hero)}  ·  {hero.publishedEpisodeCount}화  ·  {hero.freeEpisodeCount}화까지 무료</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel={hero.title + ' 작품 소개'} style={styles.heroTitleButton} onPress={() => openDetail(hero)}>
        <AppText weight="bold" style={styles.heroTitle}>{hero.title}</AppText><Icon name="chevron-right" size={22} color={colors.onMedia} />
      </Pressable>
      {width >= 701 && hero.shortDescription ? <AppText style={styles.heroDescription}>{hero.shortDescription}</AppText> : null}
      <View style={styles.heroActions}>
        <Button style={styles.heroButton} label={heroLabel} disabled={isRestoring || heroLoading} icon={<Icon name="play" size={18} color={colors.onYolk} />} onPress={startHero} />
        <Pressable accessibilityRole="button" accessibilityLabel="저장" accessibilityState={{ selected: heroSaved, disabled: !heroPreview || isRestoring || saving, busy: saving }} disabled={!heroPreview || isRestoring || saving} onPress={() => void toggleHeroSaved()} style={[styles.saveButton, heroSaved && styles.saveButtonActive, !heroPreview && styles.disabled]}>
          <Icon name="bookmark" size={22} color={heroSaved ? colors.lavender : colors.onMedia} />
        </Pressable>
      </View>
      {featuredDramas.length > 1 ? <View style={styles.heroPagination}>
        {featuredDramas.map((drama, index) => <Pressable key={drama.uuid} style={styles.heroPageButton} accessibilityRole="button" accessibilityLabel={`${drama.title} 대표 작품으로 보기, ${featuredDramas.length}편 중 ${index + 1}번째`} accessibilityState={{ selected: heroIndex === index }} onPress={() => setHeroIndex(index)}><View style={[styles.heroPageLine, heroIndex === index && styles.activePageLine]} /></Pressable>)}
        <AppText accessible={false} style={styles.heroPageNumber}>{heroIndex + 1} / {featuredDramas.length}</AppText>
      </View> : null}
    </View> : <View style={styles.heroEmpty}>{collectionState(featuredStatus, '추천 작품', '추천 작품이 없습니다.')}</View>}
  </View>;

  const resumeSection = history.length > 0 ? <View style={styles.groupStart}>
    <View style={styles.sectionHead}><SectionTitle title="이어보기" action="전체보기" onAction={() => router.push({ pathname: '/library', params: { tab: 'history' } })} /></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>{history.map((item) => (
      <Pressable key={item.dramaUuid} accessibilityRole="button" accessibilityLabel={`${item.dramaTitle} ${item.episodeNumber}화 이어보기`} style={{ width: Math.round(contentWidth * 0.6), gap: spacing.xs }} onPress={() => router.push({ pathname: '/episode/[id]', params: { id: item.episodeUuid, dramaId: item.dramaUuid } })}>
        <View style={styles.wideThumb}><ApiDramaImage imageUrl={item.imageUrl} title={item.dramaTitle} style={StyleSheet.absoluteFill} /></View>
        <AppText weight="semibold" numberOfLines={1} style={styles.cardTitle}>{item.dramaTitle}</AppText>
        <AppText style={styles.cardMeta}>{item.episodeNumber}화</AppText>
      </Pressable>
    ))}</ScrollView>
  </View> : null;

  const topThreeSection = <View style={styles.groupStart}>
    <View style={styles.sectionHead}><SectionTitle title="지금 눈여겨볼 TOP 3" action="전체보기" onAction={() => setTab('랭킹')} /></View>
    {topThreeStatus === 'loaded' && topThreeDramas.length > 0
      ? <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="지금 눈여겨볼 TOP 3, 옆으로 넘겨 볼 수 있어요" contentContainerStyle={styles.rail}>{topThreeDramas.map((drama, index) => (
        <Pressable key={drama.uuid} accessibilityRole="button" accessibilityLabel={`${index + 1}위 ${drama.title} 작품 소개`} style={styles.rankItem} onPress={() => openDetail(drama)}>
          <AppText weight="extrabold" style={styles.rankNumber}>{index + 1}</AppText>
          <View style={{ width: rankPosterWidth, gap: spacing.xs }}>
            <View style={[styles.poster, { height: Math.round(rankPosterWidth * 1.5) }]}><ApiDramaImage imageUrl={drama.imageUrls.poster} title={drama.title} style={StyleSheet.absoluteFill} /></View>
            <AppText weight="semibold" numberOfLines={1} style={styles.cardTitle}>{drama.title}</AppText>
          </View>
        </Pressable>
      ))}</ScrollView>
      : <View style={styles.section}>{collectionState(topThreeStatus, 'TOP 3', '새로운 작품을 준비하고 있어요.')}</View>}
  </View>;

  const peekStrip = <Pressable accessibilityRole="button" accessibilityLabel="빼꼼에서 넘겨보기, 미리보기로 다음 작품을 골라보세요." style={styles.peekStrip} onPress={() => router.push('/recommend')}>
    <View style={styles.flex}><AppText weight="bold" style={styles.peekTitle}>빼꼼에서 넘겨보기</AppText><AppText style={styles.peekCopy}>미리보기로 다음 작품을 골라보세요.</AppText></View>
    <Peeka slot="strip" size={88} />
  </Pressable>;

  const newest = catalog.slice(0, 5);
  const freeDramas = catalog.filter((drama) => drama.freeEpisodeCount > 0).slice(0, 4);
  const browseSections = catalogStatus === 'error'
    ? <View style={[styles.groupStart, styles.section]}><EmptyState title="작품을 불러오지 못했어요" description="잠시 후 다시 확인해 주세요." action="다시 시도" onAction={retryCatalog} /></View>
    : <>
      {newest.length > 0 ? <View style={styles.groupStart}>
        <View style={styles.sectionHead}><SectionTitle title="새로 올라온 이야기" action="전체보기" onAction={() => router.push('/search')} /></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>{newest.map((drama) => (
          <Pressable key={drama.uuid} accessibilityRole="button" accessibilityLabel={drama.title + ' 작품 소개'} style={{ width: posterWidth, gap: spacing.xs }} onPress={() => openDetail(drama)}>
            <View style={[styles.poster, { height: Math.round(posterWidth * 1.5) }]}><ApiDramaImage imageUrl={drama.imageUrls.poster} title={drama.title} style={StyleSheet.absoluteFill} /></View>
            <AppText weight="semibold" numberOfLines={1} style={styles.cardTitle}>{drama.title}</AppText>
            <AppText numberOfLines={1} style={styles.cardMeta}>{genreLabel(drama)}</AppText>
          </Pressable>
        ))}</ScrollView>
      </View> : null}
      {freeDramas.length > 0 ? <View style={newest.length > 0 ? styles.groupInner : styles.groupStart}>
        <View style={styles.sectionHead}><SectionTitle title="무료로 시작하기 좋은 이야기" action="전체보기" onAction={() => router.push('/search')} /></View>
        <View style={styles.section}>{freeDramas.map((drama) => (
          <Pressable key={drama.uuid} accessibilityRole="button" accessibilityLabel={`${drama.title} 작품 소개, ${drama.freeEpisodeCount}화까지 무료`} style={styles.listRow} onPress={() => openDetail(drama)}>
            <ApiDramaImage imageUrl={drama.imageUrls.poster} title={drama.title} style={styles.rowPoster} />
            <View style={styles.rowCopy}>
              <AppText weight="semibold" numberOfLines={1} style={styles.rowTitle}>{drama.title}</AppText>
              <AppText style={styles.rowMeta}><AppText weight="semibold" style={styles.free}>{drama.freeEpisodeCount}화까지 무료</AppText> · {genreLabel(drama)}</AppText>
            </View>
          </Pressable>
        ))}</View>
      </View> : null}
    </>;

  const genreBanner = campaignImage ? <Pressable accessibilityRole="button" accessibilityLabel="로맨스 만나기" onPress={() => openGenre('ROMANCE')} style={[styles.campaignBanner, { height: Math.round((contentWidth - 32) / 2) }]}>
    <ApiDramaImage imageUrl={campaignImage} title="로맨스 캠페인" style={StyleSheet.absoluteFill} />
    <LinearGradient pointerEvents="none" colors={['transparent', colors.mediaBack]} style={StyleSheet.absoluteFill} />
    <View style={styles.campaignCopy}>
      <AppText weight="bold" style={styles.campaignTitle}>퇴근길을 채울 로맨스 한 편</AppText>
      <View style={styles.campaignLink}><AppText weight="semibold" style={styles.campaignLinkText}>로맨스 만나기</AppText><Icon name="arrow-right" size={16} color={colors.onMedia} /></View>
    </View>
  </Pressable> : null;

  const ranks = topThreeStatus === 'loaded' && topThreeDramas.length > 0
    ? <ApiRankRows dramas={topThreeDramas} onPress={openDetail} />
    : collectionState(topThreeStatus, 'TOP 3', '새로운 작품을 준비하고 있어요.');
  const genreContent = genresStatus === 'error'
    ? <EmptyState title="장르를 불러오지 못했어요" description="잠시 후 다시 확인해 주세요." action="다시 시도" onAction={retryGenres} />
    : genres.length === 0
      ? <EmptyState title="장르가 없어요" description="작품 장르를 준비하고 있어요." />
      : <View style={styles.genreList}>{genres.map((genre) => {
        const drama = catalog.find((item) => item.genres.some((itemGenre) => itemGenre.code === genre.code));
        const imageUrl = drama?.imageUrls.posterLandscape ?? drama?.imageUrls.poster ?? null;
        return <Pressable key={genre.id} style={styles.genreTile} accessibilityRole="button" accessibilityLabel={`${genre.name} 작품 찾기`} onPress={() => openGenre(genre.code)}>
          <ApiDramaImage imageUrl={imageUrl} title={genre.name} style={StyleSheet.absoluteFill} />
          <LinearGradient pointerEvents="none" colors={[colors.mediaBack, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          <View style={styles.genreContent}><AppText weight="bold" style={styles.genreTitle}>{genre.name}</AppText><Icon name="arrow-up-right" color={colors.onMedia} size={24} /></View>
        </Pressable>;
      })}</View>;

  return (
    <Page header={<AppTopBar />} scroll={!contentLoading} contentStyle={contentLoading ? [styles.page, { flex: 1 }] : styles.page}>
      {tabBar}
      {contentLoading ? <LoadingState /> : tab === '오늘' ? <>
        {heroSection}
        {resumeSection}
        {topThreeSection}
        {peekStrip}
        {browseSections}
        {genreBanner}
      </> : tab === '랭킹' ? <View style={styles.section}>{ranks}</View> : <View style={styles.section}>{genreContent}</View>}
      {hero ? <EpisodeUnlockDialog
        episode={lockedEpisode}
        dramaTitle={hero.title}
        onClose={() => setLockedEpisode(null)}
        onCharge={() => {
          setLockedEpisode(null);
          router.push(user === null ? '/auth/login' : '/points');
        }}
        onPurchased={(episode) => {
          setHeroContent((current) => current?.content ? {
            ...current,
            content: { ...current.content, episodes: current.content.episodes.map((item) => item.uuid === episode.uuid ? { ...item, isUnlocked: true } : item) },
          } : current);
          router.push({ pathname: '/episode/[id]', params: { id: episode.uuid, dramaId: hero.uuid } });
        }}
      /> : null}
    </Page>
  );
}

const useStyles = createThemedStyles((colors) => ({
  page: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: spacing.xl, gap: 0 }, flex: { flex: 1 },
  tabs: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  tab: { minHeight: 40, paddingHorizontal: spacing.md, justifyContent: 'center', borderRadius: radius.pill, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  selectedTab: { backgroundColor: colors.text, borderColor: colors.text }, tabText: { ...textSizes.label14, color: colors.text }, selectedText: { color: colors.surface },
  hero: { justifyContent: 'flex-end', overflow: 'hidden', backgroundColor: colors.night },
  heroBlank: { backgroundColor: colors.background }, heroEmpty: { paddingHorizontal: spacing.md },
  imagePlaceholder: { backgroundColor: colors.elevated },
  heroContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs },
  heroMeta: { ...textSizes.label14, color: colors.onMediaMuted },
  heroTitleButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, alignSelf: 'flex-start' },
  heroTitle: { ...textSizes.heading24, color: colors.onMedia }, heroDescription: { ...textSizes.label14, color: colors.onMediaMuted },
  heroActions: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs }, heroButton: { flex: 1 },
  saveButton: { width: 48, height: 48, borderRadius: radius.md, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.mediaLineStrong, backgroundColor: colors.mediaFill, alignItems: 'center', justifyContent: 'center' },
  saveButtonActive: { borderColor: colors.lavender }, disabled: { opacity: 0.45 },
  heroPagination: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  heroPageButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  heroPageLine: { width: 20, height: 3, borderRadius: radius.pill, backgroundColor: colors.mediaTrack }, activePageLine: { width: 28, backgroundColor: colors.onMedia },
  heroPageNumber: { ...textSizes.caption12, color: colors.onMediaMuted, marginLeft: spacing.xs },
  groupStart: { paddingTop: spacing.xl }, groupInner: { paddingTop: spacing.lg },
  sectionHead: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxs },
  section: { paddingHorizontal: spacing.md },
  rail: { paddingHorizontal: spacing.md, gap: spacing.xs },
  poster: { overflow: 'hidden', borderRadius: radius.sm, borderCurve: 'continuous', backgroundColor: colors.elevated },
  wideThumb: { aspectRatio: 16 / 9, overflow: 'hidden', borderRadius: radius.sm, borderCurve: 'continuous', backgroundColor: colors.elevated },
  cardTitle: { ...textSizes.label14 }, cardMeta: { ...textSizes.caption12, color: colors.muted },
  rankItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xxs },
  rankNumber: { fontSize: 96, lineHeight: 104, letterSpacing: -4, color: colors.rank },
  rankRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  rankRowNumber: { width: 28, fontSize: 24, lineHeight: 36, color: colors.rank, textAlign: 'center' },
  listRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', paddingVertical: spacing.xs },
  rowPoster: { width: 56, height: 84, borderRadius: radius.sm, borderCurve: 'continuous' },
  rowCopy: { flex: 1, minWidth: 0, gap: spacing.xxs }, rowTitle: { ...textSizes.body16 }, rowMeta: { ...textSizes.caption12, color: colors.muted },
  free: { ...textSizes.caption12, color: colors.accent },
  peekStrip: { marginHorizontal: spacing.md, marginTop: spacing.lg, paddingLeft: spacing.md, paddingRight: spacing.xs, minHeight: 96, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, borderCurve: 'continuous', backgroundColor: colors.strip, overflow: 'hidden' },
  peekTitle: { ...textSizes.body16, color: colors.text }, peekCopy: { ...textSizes.label14, color: colors.text },
  campaignBanner: { marginHorizontal: spacing.md, marginTop: spacing.lg, borderRadius: radius.md, borderCurve: 'continuous', overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: colors.night },
  campaignCopy: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.xxs },
  campaignTitle: { ...textSizes.body18, color: colors.onMedia }, campaignLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, minHeight: 40 }, campaignLinkText: { ...textSizes.label14, color: colors.onMedia },
  genreList: { gap: spacing.sm, paddingTop: spacing.xs }, genreTile: { minHeight: 176, borderRadius: radius.md, borderCurve: 'continuous', overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: colors.night }, genreContent: { padding: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, genreTitle: { ...textSizes.heading24, color: colors.onMedia },
}));
