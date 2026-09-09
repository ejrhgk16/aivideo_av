import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText, Button, DramaImage, EmptyState, Icon, Page } from '@/components/ui';
import { getDrama } from '@/features/drama/catalog';
import { useExperience } from '@/features/drama/ExperienceProvider';
import { shareDrama } from '@/services/share-drama';
import { colors } from '@/theme/tokens';

export function DramaDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { state, ready, toggleSave } = useExperience();
  const [selectedTab, setSelectedTab] = useState<'소개' | '회차' | null>(null);
  const tab = selectedTab ?? (params.tab === 'episodes' || params.tab === '회차' ? '회차' : '소개');
  const drama = getDrama(id);
  const back = () => router.canGoBack() ? router.back() : router.replace('/');
  if (!drama) return <Page><EmptyState title="작품을 찾을 수 없어요" description="다른 이야기를 둘러보세요." action="홈으로" onAction={() => router.replace('/')} /></Page>;
  const saved = state.saved.includes(id);
  const history = state.history.find((entry) => entry.id === id);
  const openEpisode = (ep: number) => router.push({ pathname: '/player/[id]', params: { id, ep } });
  const share = async () => {
    try { await shareDrama(drama); } catch { Alert.alert('공유하지 못했어요', '잠시 후 다시 시도해 주세요.'); }
  };

  return (
    <Page contentStyle={styles.page}>
      <View style={styles.hero}>
        <DramaImage drama={drama} style={StyleSheet.absoluteFill} contentPosition="top" />
        <LinearGradient pointerEvents="none" colors={['#0B0C0F1A', '#0B0C0F66', colors.background]} locations={[0.25, 0.58, 1]} style={StyleSheet.absoluteFill} />
        <Pressable style={styles.back} accessibilityRole="button" accessibilityLabel="뒤로 가기" onPress={back}><Icon name="chevron-left" size={27} color={colors.text} /></Pressable>
        <AppText weight="medium" style={styles.studio}>{drama.studio}</AppText>
      </View>
      <View style={styles.heading}><AppText style={styles.english}>{drama.english}</AppText><AppText weight="bold" style={styles.title}>{drama.title}</AppText><AppText style={styles.meta}>{drama.tag} · {drama.total}부작 · 회당 약 1분</AppText><View style={styles.freeRow}><Icon name="check-circle" size={14} color={colors.accent} /><AppText style={styles.free}>{drama.free}화까지 무료, 이후 회차당 10P</AppText></View></View>
      <View style={styles.actions}>
        <Button disabled={!ready} style={styles.flex} label={history ? '이어서 보기' : '무료로 시작하기'} icon={<Icon name="play" size={17} color={colors.background} />} onPress={() => openEpisode(history?.ep ?? 1)} />
        <Pressable disabled={!ready} style={styles.square} accessibilityRole="button" accessibilityLabel={saved ? '저장 취소' : '작품 저장'} accessibilityState={{ selected: saved }} onPress={() => toggleSave(id)}><Icon name={saved ? 'check' : 'plus'} size={22} color={saved ? colors.accent : colors.text} /></Pressable>
        <Pressable style={styles.square} accessibilityRole="button" accessibilityLabel="작품 공유" onPress={share}><Icon name="share-2" size={18} color={colors.text} /></Pressable>
      </View>
      <View style={styles.tabs} accessibilityRole="tablist">{(['소개', '회차'] as const).map((item) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }} style={[styles.tab, tab === item && styles.activeTab]} onPress={() => setSelectedTab(item)}><AppText weight={tab === item ? 'semibold' : 'regular'} style={[styles.tabLabel, tab === item && styles.activeTabLabel]}>{item === '소개' ? '작품 소개' : `전체 회차  ${drama.total}`}</AppText></Pressable>)}</View>
      {tab === '소개' ? <View style={styles.introduction}>
        <AppText style={styles.synopsis}>{drama.description}</AppText>
        <Button variant="secondary" label="분위기 미리보기" icon={<Icon name="film" size={17} color={colors.text} />} onPress={() => router.push({ pathname: '/recommend', params: { id } })} />
        <View style={styles.production}><View style={styles.productionRow}><AppText style={styles.productionLabel}>제작</AppText><AppText weight="medium" style={styles.productionValue}>{drama.studio}</AppText></View><View style={styles.productionRow}><AppText style={styles.productionLabel}>콘텐츠</AppText><AppText weight="medium" style={styles.productionValue}>AI 제작 드라마 · 예시 작품</AppText></View></View>
        <AppText style={styles.note}>표지는 새로 만든 콘셉트 이미지예요. 실제 영상은 아직 연결되지 않았어요.</AppText>
      </View> : <View style={styles.episodes}>
        <AppText style={styles.episodeNote}>{drama.free}화까지 무료 · 열린 회차는 다시 봐도 무료</AppText>
        <View style={styles.episodeGrid}>{Array.from({ length: drama.total }, (_, index) => index + 1).map((ep) => {
          const free = ep <= drama.free;
          const opened = state.opened.includes(`${id}:${ep}`);
          return <Pressable key={ep} disabled={!ready} style={[styles.episode, (free || opened) && styles.available]} accessibilityRole="button" accessibilityLabel={`${ep}화 ${free ? '무료' : opened ? '열림' : '10포인트로 열기'}`} onPress={() => openEpisode(ep)}><AppText weight="medium" style={[styles.episodeNumber, (free || opened) && styles.availableText]}>{ep}</AppText>{free ? <AppText style={styles.episodeFree}>무료</AppText> : <Icon name={opened ? 'check' : 'lock'} size={12} color={opened ? colors.accent : colors.muted} />}</Pressable>;
        })}</View>
        <AppText style={styles.note}>포인트는 회차 열기를 확인할 때만 사용해요. 10P는 체험용 예시 요금이에요.</AppText>
      </View>}
    </Page>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 22, paddingTop: 0, paddingBottom: 34, gap: 0 }, flex: { flex: 1, paddingHorizontal: 12 },
  hero: { height: 290, marginHorizontal: -22, justifyContent: 'flex-end' },
  back: { position: 'absolute', top: 14, left: 14, width: 44, height: 44, backgroundColor: '#0B0C0F99', borderRadius: 24, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  studio: { fontSize: 9, lineHeight: 16, letterSpacing: 1.6, marginHorizontal: 22, marginBottom: 15 },
  heading: { gap: 10, paddingTop: 2 }, english: { fontSize: 9, lineHeight: 14, letterSpacing: 2, color: colors.muted }, title: { fontSize: 32, lineHeight: 43, letterSpacing: -1.1 }, meta: { fontSize: 12, lineHeight: 18, color: colors.muted },
  freeRow: { flexDirection: 'row', gap: 6, alignItems: 'center' }, free: { color: colors.accent, fontSize: 11, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 8, marginVertical: 24 }, square: { width: 44, minHeight: 50, borderRadius: 12, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  tabs: { flexDirection: 'row', gap: 28, borderBottomWidth: 1, borderBottomColor: colors.border }, tab: { minHeight: 47, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' }, activeTab: { borderBottomColor: colors.accent }, tabLabel: { fontSize: 13, color: colors.muted }, activeTabLabel: { color: colors.text },
  introduction: { paddingTop: 23, gap: 25 }, synopsis: { fontSize: 15, lineHeight: 27, color: '#C2C7CD' }, production: { gap: 12 }, productionRow: { flexDirection: 'row', gap: 20, alignItems: 'center' }, productionLabel: { fontSize: 11, lineHeight: 18, color: colors.muted, width: 45 }, productionValue: { fontSize: 11, lineHeight: 18, color: '#C2C7CD', flex: 1 }, note: { fontSize: 10, lineHeight: 18, color: colors.muted },
  episodes: { paddingTop: 21, gap: 20 }, episodeNote: { fontSize: 11, lineHeight: 18, color: colors.muted }, episodeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, episode: { width: '17.5%', minHeight: 63, paddingVertical: 10, gap: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 9, borderCurve: 'continuous' }, available: { backgroundColor: '#252C22', borderColor: '#343E2F' }, episodeNumber: { color: colors.muted, fontSize: 15, lineHeight: 20 }, availableText: { color: colors.text }, episodeFree: { fontSize: 9, lineHeight: 13, color: '#BBCBA8' },
});
