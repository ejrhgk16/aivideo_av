import { useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, Button, EmptyState, Icon, Page, SectionTitle } from '@/components/ui';
import { AppTopBar } from '@/components/AppTopBar';
import { getDramaList, getGenres, type DramaSummary, type GenreSummary } from '@/features/drama/dramaContent';
import { SessionChangedError } from '@/common/http/api';
import { getErrorMessage } from '@/common/http/errorMessages';
import { resolveApiImageUrl } from '@/common/media';
import { colors, typography } from '@/common/theme/tokens';
import { useUser } from '@/features/user/UserProvider';

type ListStatus = 'loading' | 'loaded' | 'error';
type GenreStatus = 'loading' | 'loaded' | 'error';

export function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ genre?: string }>();
  const { width } = useWindowDimensions();
  const { user, isRestoring, sessionVersion, isCurrentSession } = useUser();
  const [query, setQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [genres, setGenres] = useState<GenreSummary[]>([]);
  const [genresStatus, setGenresStatus] = useState<GenreStatus>('loading');
  const [dramas, setDramas] = useState<DramaSummary[]>([]);
  const [status, setStatus] = useState<ListStatus>('loading');
  const [hasNext, setHasNext] = useState(false);
  const [nextLoading, setNextLoading] = useState(false);
  const [nextError, setNextError] = useState(false);
  const [listError, setListError] = useState<unknown>(null);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const nextPage = useRef(2);
  const focused = useRef(false);
  const genresReady = useRef(false);
  const routeGenreInitialized = useRef(false);
  const routeGenreParam = useRef<string | undefined>(undefined);
  const conditions = useRef({ q: '', genre: 'all' });
  const pendingQuery = useRef<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versionRef = useRef(sessionVersion);
  const isRestoringRef = useRef(isRestoring);
  versionRef.current = sessionVersion;
  isRestoringRef.current = isRestoring;

  const loadPage = useCallback(async (page: number, replace: boolean, requestGeneration: number, version: number) => {
    if (inFlight.current || !focused.current || isRestoringRef.current || !genresReady.current) return;
    inFlight.current = true;
    const isCurrent = () => generation.current === requestGeneration && isCurrentSession(version);
    if (replace) {
      setDramas([]);
      setStatus('loading');
      setListError(null);
      setHasNext(false);
    } else {
      setNextLoading(true);
    }
    setNextError(false);
    try {
      const { q, genre } = conditions.current;
      const result = await getDramaList({ page, ...(q ? { q } : {}), ...(genre !== 'all' ? { genre } : {}) });
      if (!isCurrent()) return;
      setDramas((current) => {
        if (!isCurrent()) return current;
        if (replace) return result.items;
        const merged = [...current];
        const seen = new Set(current.map((drama) => drama.uuid));
        result.items.forEach((drama) => {
          if (!seen.has(drama.uuid)) { seen.add(drama.uuid); merged.push(drama); }
        });
        return merged;
      });
      nextPage.current = result.page + 1;
      setHasNext(result.hasNext);
      setStatus('loaded');
    } catch (error) {
      if (!isCurrent() || error instanceof SessionChangedError) return;
      if (replace) { setStatus('error'); setListError(error); }
      else setNextError(true);
    } finally {
      if (isCurrent()) {
        inFlight.current = false;
        setNextLoading(false);
      }
    }
  }, [isCurrentSession]);

  const applyRouteGenre = useCallback((availableGenres: GenreSummary[]) => {
    if (routeGenreInitialized.current && routeGenreParam.current === params.genre) return;
    routeGenreInitialized.current = true;
    routeGenreParam.current = params.genre;
    const routeGenre = availableGenres.find((item) => item.code === params.genre || item.name === params.genre)?.code ?? 'all';
    setSelectedGenre(routeGenre);
    conditions.current = { ...conditions.current, genre: routeGenre };
  }, [params.genre]);

  const preservePendingQuery = useCallback(() => {
    if (pendingQuery.current !== null) conditions.current = { ...conditions.current, q: pendingQuery.current };
    pendingQuery.current = null;
    if (searchTimer.current !== null) clearTimeout(searchTimer.current);
    searchTimer.current = null;
  }, []);

  useFocusEffect(useCallback(() => {
    const requestGeneration = ++generation.current;
    const version = sessionVersion;
    inFlight.current = false;
    focused.current = true;
    genresReady.current = false;
    preservePendingQuery();
    setGenres([]);
    setGenresStatus('loading');
    setDramas([]);
    setStatus('loading');
    setHasNext(false);
    setNextError(false);
    setNextLoading(false);
    setListError(null);
    nextPage.current = 2;
    if (isRestoring) return () => {
      focused.current = false;
      preservePendingQuery();
      generation.current += 1;
      inFlight.current = false;
    };

    void getGenres().then((result) => {
      if (generation.current !== requestGeneration || !isCurrentSession(version)) return;
      setGenres(result);
      setGenresStatus('loaded');
      genresReady.current = true;
      applyRouteGenre(result);
      if (pendingQuery.current === null) void loadPage(1, true, requestGeneration, version);
    }, () => {
      if (generation.current !== requestGeneration || !isCurrentSession(version)) return;
      genresReady.current = false;
      setGenresStatus('error');
    });

    return () => {
      focused.current = false;
      preservePendingQuery();
      generation.current += 1;
      inFlight.current = false;
    };
  }, [applyRouteGenre, isCurrentSession, isRestoring, loadPage, params.genre, preservePendingQuery, sessionVersion, user?.uuid]));

  useEffect(() => () => {
    if (searchTimer.current !== null) clearTimeout(searchTimer.current);
  }, []);

  const applySearchText = (value: string) => {
    setQuery(value);
    const q = value.trim();
    const currentDesiredQuery = pendingQuery.current ?? conditions.current.q;
    if (q === currentDesiredQuery) return;
    if (searchTimer.current !== null) clearTimeout(searchTimer.current);
    searchTimer.current = null;
    pendingQuery.current = q;
    let requestGeneration = generation.current;
    if (genresReady.current) {
      requestGeneration = ++generation.current;
      inFlight.current = false;
      setDramas([]);
      setStatus('loading');
      setListError(null);
      setHasNext(false);
      setNextError(false);
      setNextLoading(false);
      nextPage.current = 2;
    }
    searchTimer.current = setTimeout(() => {
      searchTimer.current = null;
      if (pendingQuery.current !== q) return;
      pendingQuery.current = null;
      conditions.current = { ...conditions.current, q };
      if (genresReady.current && focused.current) {
        void loadPage(1, true, requestGeneration, versionRef.current);
      }
    }, 300);
  };

  const applyGenre = (genre: string, queryOverride?: string) => {
    if (!genresReady.current) return;
    if (searchTimer.current !== null) clearTimeout(searchTimer.current);
    searchTimer.current = null;
    pendingQuery.current = null;
    const q = queryOverride ?? query.trim();
    conditions.current = { q, genre };
    setSelectedGenre(genre);
    const requestGeneration = ++generation.current;
    inFlight.current = false;
    setDramas([]);
    setStatus('loading');
    setListError(null);
    setHasNext(false);
    setNextError(false);
    setNextLoading(false);
    nextPage.current = 2;
    if (genresReady.current && focused.current) void loadPage(1, true, requestGeneration, versionRef.current);
  };

  const retryGenres = () => {
    const requestGeneration = ++generation.current;
    const version = versionRef.current;
    setGenresStatus('loading');
    void getGenres().then((result) => {
      if (generation.current !== requestGeneration || !isCurrentSession(version)) return;
      setGenres(result);
      genresReady.current = true;
      setGenresStatus('loaded');
      applyRouteGenre(result);
      if (pendingQuery.current === null) void loadPage(1, true, requestGeneration, version);
    }, () => {
      if (generation.current === requestGeneration && isCurrentSession(version)) setGenresStatus('error');
    });
  };

  const retryList = () => void loadPage(1, true, generation.current, versionRef.current);
  const loadNextPage = () => {
    if (!hasNext || nextLoading || status !== 'loaded' || isRestoring) return;
    void loadPage(nextPage.current, false, generation.current, sessionVersion);
  };
  const currentGenre = genres.find((item) => item.code === selectedGenre);
  const posterWidth = Math.min(Math.max((Math.min(width, 960) - 58) / 2, 140), 230);
  const term = query.trim();

  return (
    <Page header={<AppTopBar />} contentStyle={styles.page}>
      <SectionTitle eyebrow="FIND YOUR NEXT STORY" title="어떤 이야기를 찾으세요?" />
      <View style={styles.searchField}>
        <Icon name="search" size={21} color={colors.muted} />
        <TextInput style={styles.input} accessibilityLabel="작품 제목이나 장르 검색" placeholder="작품 제목이나 장르를 검색해요" placeholderTextColor={colors.muted} value={query} onChangeText={applySearchText} returnKeyType="search" autoCapitalize="none" autoCorrect={false} />
        {query.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="검색어 지우기" style={styles.clear} onPress={() => applySearchText('')}><Icon name="x" size={18} color={colors.muted} /></Pressable> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {[{ code: 'all', name: '전체' }, ...genres].map((item) => <Pressable key={item.code} accessibilityRole="button" accessibilityState={{ disabled: !genresReady.current, selected: selectedGenre === item.code }} disabled={!genresReady.current} style={[styles.filter, selectedGenre === item.code && styles.activeFilter]} onPress={() => applyGenre(item.code)}><AppText weight={selectedGenre === item.code ? 'semibold' : 'regular'} style={[styles.filterLabel, selectedGenre === item.code && styles.activeFilterLabel]}>{item.name}</AppText></Pressable>)}
      </ScrollView>
      <View style={styles.resultHeading}><AppText weight="semibold" style={styles.resultTitle}>{term ? `'${term}' 검색 결과` : selectedGenre === 'all' ? '모든 이야기' : `${currentGenre?.name ?? ''} 이야기`}</AppText><AppText style={styles.count}>{status === 'loaded' ? `불러온 작품 ${dramas.length}개` : ''}</AppText></View>
      {genresStatus === 'loading' ? <EmptyState title="작품을 불러오는 중" description="잠시만 기다려 주세요." />
        : genresStatus === 'error' ? <EmptyState title="장르를 불러오지 못했어요" description="잠시 후 다시 확인해 주세요." action="다시 시도" onAction={retryGenres} />
          : status === 'loading' ? <EmptyState title="작품을 불러오는 중" description="잠시만 기다려 주세요." />
            : status === 'error' ? <EmptyState title="작품을 불러오지 못했어요" description={getErrorMessage(listError)} action="다시 시도" onAction={retryList} />
              : dramas.length > 0 ? <>
                <View style={styles.grid}>{dramas.map((drama) => <Pressable key={drama.uuid} accessibilityRole="button" accessibilityLabel={drama.title + ' 작품 소개'} style={{ width: posterWidth, gap: 10 }} onPress={() => router.push({ pathname: '/drama/[id]', params: { id: drama.uuid } })}><View style={[styles.poster, { height: posterWidth * 1.48 }]}>{drama.imageUrls.poster ? <Image source={{ uri: resolveApiImageUrl(drama.imageUrls.poster) ?? undefined }} accessibilityLabel={drama.title + ' 표지'} contentFit="cover" style={StyleSheet.absoluteFill} /> : <View accessibilityLabel={drama.title + ' 표지 없음'} style={[StyleSheet.absoluteFill, styles.placeholder]} />}</View><AppText weight="semibold" numberOfLines={1}>{drama.title}</AppText><AppText style={styles.genreText}>{drama.genres.map((item) => item.name).join(' · ') || '장르 정보 없음'}</AppText></Pressable>)}</View>
                {nextLoading ? <AppText style={styles.footer}>더 불러오는 중이에요</AppText> : nextError ? <View style={styles.footer}><AppText>작품을 더 불러오지 못했어요</AppText><Button label="다시 시도" variant="secondary" onPress={loadNextPage} /></View> : hasNext ? <Button label="더 보기" variant="secondary" onPress={loadNextPage} /> : null}
              </> : <EmptyState title="아직 찾는 이야기가 없어요" description="다른 제목을 검색하거나 장르를 바꿔보세요." action="모든 작품 보기" onAction={() => { setQuery(''); applyGenre('all', ''); }} />}
    </Page>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 22, paddingTop: 26, paddingBottom: 30, gap: 0 },
  searchField: { marginTop: 25, minHeight: 54, paddingLeft: 15, paddingRight: 7, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, fontFamily: typography.regular, color: colors.text, fontSize: 14, paddingVertical: 14, minWidth: 0 },
  clear: { width: 40, height: 44, justifyContent: 'center', alignItems: 'center' },
  filters: { gap: 8, paddingTop: 18, paddingBottom: 28 },
  filter: { paddingHorizontal: 18, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 23, borderCurve: 'continuous' },
  activeFilter: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterLabel: { fontSize: 12, lineHeight: 18, color: colors.muted },
  activeFilterLabel: { color: colors.background },
  resultHeading: { flexDirection: 'row', alignItems: 'center', gap: 15, justifyContent: 'space-between', marginBottom: 20 },
  resultTitle: { fontSize: 16, flex: 1 },
  count: { fontSize: 11, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  footer: { marginTop: 20, alignItems: 'center', gap: 10 },
  poster: { overflow: 'hidden', borderRadius: 14, borderCurve: 'continuous', backgroundColor: colors.surface },
  placeholder: { backgroundColor: colors.surface },
  genreText: { fontSize: 11, color: colors.muted },
});
