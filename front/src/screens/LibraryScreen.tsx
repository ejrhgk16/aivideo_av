import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, DramaImage, EmptyState, Icon, Page, Poster, SectionTitle } from '@/components/ui';
import { getDrama } from '@/features/drama/catalog';
import { useExperience } from '@/features/drama/ExperienceProvider';
import { colors } from '@/theme/tokens';

export function LibraryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { width } = useWindowDimensions();
  const { state, ready, storageError, toggleSave } = useExperience();
  const [selectedTab, setSelectedTab] = useState<'저장한 작품' | '시청 기록' | null>(null);
  useEffect(() => setSelectedTab(null), [params.tab]);
  const tab = selectedTab ?? (params.tab === 'history' || params.tab === '시청 기록' ? '시청 기록' : '저장한 작품');
  const posterWidth = Math.min(Math.max((Math.min(width, 960) - 58) / 2, 140), 230);

  return (
    <Page contentStyle={styles.page}>
      <SectionTitle eyebrow="MY COLLECTION" title="다음 이야기도, 여기서" />
      <View style={styles.tabs} accessibilityRole="tablist">
        {(['저장한 작품', '시청 기록'] as const).map((item) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }} style={[styles.tab, tab === item && styles.activeTab]} onPress={() => setSelectedTab(item)}><AppText weight={tab === item ? 'semibold' : 'regular'} style={[styles.tabLabel, tab === item && styles.activeLabel]}>{item}</AppText><AppText style={[styles.tabCount, tab === item && styles.activeLabel]}>{item === '저장한 작품' ? state.saved.length : state.history.length}</AppText></Pressable>)}
      </View>
      {!ready ? <ActivityIndicator style={styles.loading} accessibilityLabel="보관함 불러오는 중" color={colors.accent} /> : tab === '저장한 작품' ? (
        state.saved.length > 0 ? <View style={styles.grid}>{state.saved.map((id) => { const drama = getDrama(id); return drama ? <View key={id} style={{ width: posterWidth }}><Poster drama={drama} width={posterWidth} onPress={() => router.push({ pathname: '/drama/[id]', params: { id } })} /><Pressable accessibilityRole="button" accessibilityLabel={`${drama.title} 저장 취소`} style={styles.remove} onPress={() => toggleSave(id)}><Icon name="bookmark" size={18} color={colors.accent} /></Pressable></View> : null; })}</View> : <EmptyState title="다음에 볼 이야기를 담아보세요" description="작품의 + 버튼을 누르면 여기에 모아드려요." action="드라마 둘러보기" onAction={() => router.push('/')} />
      ) : (
        state.history.length > 0 ? <View>{state.history.map((entry) => { const drama = getDrama(entry.id); return drama ? <Pressable key={entry.id} style={styles.historyRow} accessibilityRole="button" accessibilityLabel={`${drama.title} ${entry.ep}화 ${Math.floor(entry.time)}초부터 이어보기`} onPress={() => router.push({ pathname: '/player/[id]', params: { id: entry.id, ep: entry.ep } })}><DramaImage drama={drama} style={styles.historyImage} /><View style={styles.historyCopy}><AppText weight="semibold" style={styles.historyTitle}>{drama.title}</AppText><AppText style={styles.historySubtitle}>{entry.ep}화 · {Math.floor(entry.time)}초 시청</AppText><View style={styles.progress}><View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, entry.time / 60 * 100))}%` }]} /></View></View><Icon name="play" size={21} color={colors.accent} /></Pressable> : null; })}</View> : <EmptyState title="첫 번째 이야기를 시작해 볼까요?" description="보다 멈춘 회차도 여기서 이어볼 수 있어요." action="드라마 둘러보기" onAction={() => router.push('/')} />
      )}
      <AppText style={styles.note}>{storageError ? '기록을 기기에 저장하지 못했어요. 지금 이용하는 동안에는 유지돼요.' : '저장한 작품과 시청 기록은 현재 기기에 보관돼요.'}</AppText>
    </Page>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 22, paddingTop: 26, paddingBottom: 30, gap: 0 },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, borderCurve: 'continuous', padding: 4, marginTop: 25, marginBottom: 24 },
  tab: { flex: 1, minHeight: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, borderRadius: 9, borderCurve: 'continuous' },
  activeTab: { backgroundColor: colors.elevated },
  tabLabel: { fontSize: 13, color: colors.muted },
  tabCount: { fontSize: 10, color: colors.muted },
  activeLabel: { color: colors.text },
  loading: { marginVertical: 60 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  remove: { position: 'absolute', right: 8, top: 8, width: 38, height: 38, backgroundColor: '#0B0C0FD9', borderRadius: 20, borderCurve: 'continuous', justifyContent: 'center', alignItems: 'center' },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: colors.border },
  historyImage: { width: 66, height: 91, borderRadius: 8, borderCurve: 'continuous' },
  historyCopy: { flex: 1, gap: 8 },
  historyTitle: { fontSize: 16 },
  historySubtitle: { fontSize: 12, lineHeight: 18, color: colors.muted },
  progress: { height: 3, backgroundColor: colors.border, marginTop: 5, borderRadius: 2, borderCurve: 'continuous', overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: colors.accent },
  note: { color: colors.muted, fontSize: 10, lineHeight: 17, marginTop: 30, textAlign: 'center' },
});
