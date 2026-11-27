import { useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, Button, EmptyState, Icon, LoadingState, Page } from '@/components/ui';
import { AppTopBar } from '@/components/AppTopBar';
import { getDramaList, getGenres, type DramaSummary, type GenreSummary } from '@/features/drama/dramaContent';
import { SessionChangedError } from '@/common/http/api';
import { getErrorMessage } from '@/common/http/errorMessages';
import { resolveApiImageUrl } from '@/common/media';
import { radius, spacing, textSizes, typography } from '@/common/theme/tokens';
import { createThemedStyles, useColors } from '@/common/theme/theme';
import { useUser } from '@/features/user/UserProvider';

type ListStatus = 'loading' | 'loaded' | 'error';
type GenreStatus = 'loading' | 'loaded' | 'error';

export function SearchScreen() {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ genre?: string }>();
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
  const term = query.trim();
  const genreName = currentGenre?.name ?? '';
  const resultTitle = term ? (selectedGenre === 'all' ? `‘${term}’ 검색 결과` : `‘${term}’ · ${genreName}`)
    : selectedGenre === 'all' ? '모든 작품' : genreName;
  // 목록은 쪽 단위로 받으므로, 뒤에 더 있으면 지금까지 받은 수를 "이상"으로 적는다.
  const resultCount = status === 'loaded' ? `· ${dramas.length}편${hasNext ? ' 이상' : ''}` : '';

  const contentLoading = genresStatus === 'loading' || (genresStatus === 'loaded' && status === 'loading');

  return (
    <Page header={<AppTopBar />} contentStyle={styles.page}>
      <AppText weight="bold" accessibilityRole="header" style={styles.title}>찾기</AppText>
      <View style={styles.searchField}>
        <Icon name="search" size={21} color={colors.muted} />
        <TextInput style={styles.input} accessibilityLabel="작품 제목이나 장르 검색" placeholder="작품명, 장르로 찾아보세요" placeholderTextColor={colors.muted} value={query} onChangeText={applySearchText} returnKeyType="search" autoCapitalize="none" autoCorrect={false} />
        {query.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="검색어 지우기" style={styles.clear} onPress={() => applySearchText('')}><Icon name="x" size={18} color={colors.muted} /></Pressable> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filters}>
        {[{ code: 'all', name: '전체' }, ...genres].map((item) => <Pressable key={item.code} accessibilityRole="button" accessibilityState={{ disabled: !genresReady.current, selected: selectedGenre === item.code }} disabled={!genresReady.current} style={[styles.filter, selectedGenre === item.code && styles.activeFilter]} onPress={() => applyGenre(item.code)}><AppText weight={selectedGenre === item.code ? 'semibold' : 'regular'} style={[styles.filterLabel, selectedGenre === item.code && styles.activeFilterLabel]}>{item.name}</AppText></Pressable>)}
      </ScrollView>
      {/* TODO(backend): 순위순 정렬이 생기면 결과 머리말 오른쪽에 순위순·최신순 정렬을 붙인다. 지금 목록은 최신순(sort=latest)만 있다. */}
      {/* 좁은 화면에서 긴 검색어는 머리말만 줄이고 편수는 항상 보이게 둔다. */}
      <View accessibilityLiveRegion="polite" style={styles.resultHeader}>
        <AppText weight="semibold" numberOfLines={1} style={[styles.resultHeading, styles.resultTitle]}>{resultTitle}</AppText>
        {resultCount ? <AppText weight="semibold" style={[styles.resultHeading, styles.resultCount]}>{resultCount}</AppText> : null}
      </View>
      {contentLoading ? <LoadingState />
        : genresStatus === 'error' ? <EmptyState title="장르를 불러오지 못했어요" description="잠시 후 다시 확인해 주세요." action="다시 시도" onAction={retryGenres} />
          : status === 'loading' ? <LoadingState />
            : status === 'error' ? <EmptyState title="작품을 불러오지 못했어요" description={getErrorMessage(listError)} action="다시 시도" onAction={retryList} />
              : dramas.length > 0 ? <>
                <View>{dramas.map((drama) => <Pressable key={drama.uuid} accessibilityRole="button" accessibilityLabel={drama.title + ' 작품 소개'} style={styles.row} onPress={() => router.push({ pathname: '/drama/[id]', params: { id: drama.uuid } })}>
                  {drama.imageUrls.poster ? <Image source={{ uri: resolveApiImageUrl(drama.imageUrls.poster) ?? undefined }} accessibilityLabel={drama.title + ' 표지'} contentFit="cover" style={styles.poster} /> : <View accessibilityLabel={drama.title + ' 표지 없음'} style={[styles.poster, styles.placeholder]} />}
                  <View style={styles.rowCopy}>
                    <AppText weight="bold" numberOfLines={1} style={styles.rowTitle}>{drama.title}</AppText>
                    <AppText numberOfLines={2} style={styles.rowMeta}>{drama.shortDescription || drama.genres.map((item) => item.name).join(' · ') || '장르 정보 없음'}</AppText>
                  </View>
                </Pressable>)}</View>
                {nextLoading ? <LoadingState compact /> : nextError ? <View style={styles.footer}><AppText>작품을 더 불러오지 못했어요</AppText><Button label="다시 시도" variant="secondary" onPress={loadNextPage} /></View> : hasNext ? <Button label="더 보기" variant="secondary" onPress={loadNextPage} /> : null}
              </> : <EmptyState title="아직 찾는 이야기가 없어요" description="다른 제목을 검색하거나 장르를 바꿔보세요." action="모든 작품 보기" onAction={() => { setQuery(''); applyGenre('all', ''); }} />}
    </Page>
  );
}

const useStyles = createThemedStyles((colors) => ({
  page: { flexGrow: 1, paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: 0 },
  title: { color: colors.text, ...textSizes.heading24 },
  searchField: { marginTop: spacing.md, minHeight: 54, paddingLeft: spacing.md, paddingRight: spacing.xs, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: { flex: 1, fontFamily: typography.regular, color: colors.text, ...textSizes.label14, paddingVertical: 14, minWidth: 0 },
  clear: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  filterScroll: { flexGrow: 0, flexShrink: 0 },
  filters: { alignItems: 'center', gap: spacing.xs, paddingTop: spacing.md, paddingBottom: spacing.lg },
  filter: { paddingHorizontal: spacing.md, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill, borderCurve: 'continuous', backgroundColor: colors.surface },
  activeFilter: { backgroundColor: colors.text, borderColor: colors.text },
  filterLabel: { ...textSizes.label14, color: colors.muted },
  activeFilterLabel: { color: colors.background },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, marginBottom: spacing.xxs },
  resultHeading: { ...textSizes.label14, color: colors.text },
  resultTitle: { flexShrink: 1, minWidth: 0 },
  resultCount: { flexShrink: 0 },
  footer: { marginTop: spacing.md, alignItems: 'center', gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  poster: { width: 64, height: 90, borderRadius: radius.sm, borderCurve: 'continuous', backgroundColor: colors.elevated },
  placeholder: { backgroundColor: colors.elevated },
  rowCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  rowTitle: { ...textSizes.body16, color: colors.text },
  rowMeta: { ...textSizes.label14, color: colors.muted },
}));
