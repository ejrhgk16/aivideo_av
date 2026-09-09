import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, EmptyState, Icon, Page, Poster, SectionTitle } from '@/components/ui';
import { dramas } from '@/features/drama/catalog';
import { colors, typography } from '@/theme/tokens';

const genres = ['전체', '미스터리', '로맨스', 'SF'] as const;

export function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ genre?: string }>();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  useEffect(() => setSelectedGenre(null), [params.genre]);
  const genre = selectedGenre ?? (genres.some((item) => item === params.genre) ? params.genre : '전체');
  const term = query.trim().toLocaleLowerCase();
  const results = dramas.filter((drama) => (genre === '전체' || drama.tag === genre) && `${drama.title} ${drama.english} ${drama.tag} ${drama.mood}`.toLocaleLowerCase().includes(term));
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
        {genres.map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: genre === item }} style={[styles.filter, genre === item && styles.activeFilter]} onPress={() => setSelectedGenre(item)}><AppText weight={genre === item ? 'semibold' : 'regular'} style={[styles.filterLabel, genre === item && styles.activeFilterLabel]}>{item}</AppText></Pressable>)}
      </ScrollView>
      <View style={styles.resultHeading}><AppText weight="semibold" style={styles.resultTitle}>{term ? `'${query.trim()}' 검색 결과` : genre === '전체' ? '모든 이야기' : `${genre} 이야기`}</AppText><AppText style={styles.count}>{results.length}개 작품</AppText></View>
      {results.length > 0 ? <View style={styles.grid}>{results.map((drama) => <Poster key={drama.id} drama={drama} width={posterWidth} onPress={() => router.push({ pathname: '/drama/[id]', params: { id: drama.id } })} />)}</View> : <EmptyState title="아직 찾는 이야기가 없어요" description="다른 제목을 검색하거나 장르를 바꿔보세요." action="모든 작품 보기" onAction={() => { setQuery(''); setSelectedGenre('전체'); }} />}
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
});
