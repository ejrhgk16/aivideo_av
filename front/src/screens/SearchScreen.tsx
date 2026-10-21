import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, EmptyState, Icon, Page, SectionTitle } from '@/components/ui';
import { getDramaList, type DramaSummary } from '@/features/drama/dramaContent';
import { resolveApiImageUrl } from '@/common/media';
import { colors, typography } from '@/common/theme/tokens';

type SearchStatus = 'loading' | 'loaded' | 'error';

export function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ genre?: string }>();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [dramas, setDramas] = useState<DramaSummary[]>([]);
  const [status, setStatus] = useState<SearchStatus>('loading');
  useEffect(() => {
    let active = true;
    void getDramaList().then(
      (items) => { if (active) { setDramas(items); setStatus('loaded'); } },
      () => { if (active) setStatus('error'); },
    );
    return () => { active = false; };
  }, []);
  useEffect(() => setSelectedGenre(null), [params.genre]);
  const genres = useMemo(() => Array.from(new Map(dramas.flatMap((drama) => drama.genres.map((genre) => [genre.code, genre] as const))).values()), [dramas]);
  const selectedGenreValue = selectedGenre ?? genres.find((item) => item.code === params.genre || item.name === params.genre)?.code ?? 'all';
  const term = query.trim().toLocaleLowerCase();
  const results = dramas.filter((drama) => (selectedGenreValue === 'all' || drama.genres.some((item) => item.code === selectedGenreValue)) && `${drama.title} ${drama.genres.map((item) => item.name).join(' ')}`.toLocaleLowerCase().includes(term));
  const posterWidth = Math.min(Math.max((Math.min(width, 960) - 58) / 2, 140), 230);

  return (
    <Page contentStyle={styles.page}>
      <SectionTitle eyebrow="FIND YOUR NEXT STORY" title="어떤 이야기를 찾으세요?" />
      <View style={styles.searchField}>
        <Icon name="search" size={21} color={colors.muted} />
        <TextInput style={styles.input} accessibilityLabel="작품 제목이나 장르 검색" placeholder="작품 제목이나 장르를 검색해요" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} returnKeyType="search" autoCapitalize="none" autoCorrect={false} />
        {query.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="검색어 지우기" style={styles.clear} onPress={() => setQuery('')}><Icon name="x" size={18} color={colors.muted} /></Pressable> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {[{ code: 'all', name: '전체' }, ...genres].map((item) => <Pressable key={item.code} accessibilityRole="button" accessibilityState={{ selected: selectedGenreValue === item.code }} style={[styles.filter, selectedGenreValue === item.code && styles.activeFilter]} onPress={() => setSelectedGenre(item.code)}><AppText weight={selectedGenreValue === item.code ? 'semibold' : 'regular'} style={[styles.filterLabel, selectedGenreValue === item.code && styles.activeFilterLabel]}>{item.name}</AppText></Pressable>)}
      </ScrollView>
      <View style={styles.resultHeading}><AppText weight="semibold" style={styles.resultTitle}>{term ? `'${query.trim()}' 검색 결과` : selectedGenreValue === 'all' ? '모든 이야기' : `${genres.find((item) => item.code === selectedGenreValue)?.name ?? ''} 이야기`}</AppText><AppText style={styles.count}>{status === 'loaded' ? `${results.length}개 작품` : ''}</AppText></View>
      {status === 'loading' ? <EmptyState title="작품을 불러오는 중" description="잠시만 기다려 주세요." /> : status === 'error' ? <EmptyState title="작품을 불러오지 못했어요" description="잠시 후 다시 확인해 주세요." /> : results.length > 0 ? <View style={styles.grid}>{results.map((drama) => <Pressable key={drama.id} accessibilityRole="button" accessibilityLabel={drama.title + ' 작품 소개'} style={{ width: posterWidth, gap: 10 }} onPress={() => router.push({ pathname: '/drama/[id]', params: { id: drama.id } })}><View style={[styles.poster, { height: posterWidth * 1.48 }]}>{drama.imageUrls.poster ? <Image source={{ uri: resolveApiImageUrl(drama.imageUrls.poster) ?? undefined }} accessibilityLabel={drama.title + ' 표지'} contentFit="cover" style={StyleSheet.absoluteFill} /> : <View accessibilityLabel={drama.title + ' 표지 없음'} style={[StyleSheet.absoluteFill, styles.placeholder]} />}</View><AppText weight="semibold" numberOfLines={1}>{drama.title}</AppText><AppText style={styles.genreText}>{drama.genres.map((item) => item.name).join(' · ') || '장르 정보 없음'}</AppText></Pressable>)}</View> : <EmptyState title="아직 찾는 이야기가 없어요" description="다른 제목을 검색하거나 장르를 바꿔보세요." action="모든 작품 보기" onAction={() => { setQuery(''); setSelectedGenre('all'); }} />}
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
  poster: { overflow: 'hidden', borderRadius: 14, borderCurve: 'continuous', backgroundColor: colors.surface },
  placeholder: { backgroundColor: colors.surface },
  genreText: { fontSize: 11, color: colors.muted },
});
