import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText, Button, DramaImage, Icon, Page, Poster, SectionTitle } from '@/components/ui';
import { dramas, type Drama } from '@/features/drama/catalog';
import { useExperience } from '@/features/drama/ExperienceProvider';
import { colors } from '@/theme/tokens';

const tabs = ['추천', '최신', '랭킹', '장르'] as const;

export function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { state, ready, toggleSave } = useExperience();
  const [tab, setTab] = useState<(typeof tabs)[number]>('추천');
  const [heroIndex, setHeroIndex] = useState(0);
  const hero = dramas[heroIndex];
  const heroHistory = state.history.find((entry) => entry.id === hero.id);
  const heroSaved = state.saved.includes(hero.id);
  const posterWidth = Math.min(Math.max((Math.min(width, 960) - 58) / 2, 140), 230);
  const openDetail = (drama: Drama) => router.push({ pathname: '/drama/[id]', params: { id: drama.id } });
  const play = (drama: Drama) => {
    const history = state.history.find((entry) => entry.id === drama.id);
    router.push({ pathname: '/player/[id]', params: { id: drama.id, ep: history?.ep ?? 1 } });
  };
  const openGenre = (genre: string) => router.push({ pathname: '/search', params: { genre } });
  const ranks = <View>{dramas.map((drama) => (
    <Pressable key={drama.id} accessibilityRole="button" accessibilityLabel={`${drama.rank}위 ${drama.title} 작품 소개`} style={styles.rankRow} onPress={() => openDetail(drama)}>
      <AppText weight="bold" style={[styles.rankNumber, drama.rank === 1 && styles.accent]}>{drama.rank}</AppText>
      <DramaImage drama={drama} style={styles.rankImage} />
      <View style={styles.rankCopy}><AppText style={styles.overline}>{drama.studio}</AppText><AppText weight="semibold" style={styles.rankTitle}>{drama.title}</AppText><AppText style={styles.small}>{drama.tag} · {drama.mood} · {drama.total}부작</AppText><AppText style={styles.free}>{drama.free}화까지 무료</AppText></View>
      <Icon name="chevron-right" size={18} color={colors.muted} />
    </Pressable>
  ))}</View>;

  return (
    <Page contentStyle={styles.page}>
      <View style={styles.header}>
        <View style={styles.wordmark}><AppText weight="bold" style={styles.logo}>AI DRAMA</AppText><View style={styles.logoDot} /></View>
        <View style={styles.headerActions}>
          <Pressable style={styles.balance} accessibilityRole="button" accessibilityLabel={`보유 ${state.balance}포인트, 충전하기`} onPress={() => router.push('/wallet')}><AppText weight="semibold" style={styles.balanceNumber}>{state.balance.toLocaleString()}</AppText><AppText weight="bold" style={styles.point}>P</AppText></Pressable>
          <Pressable style={styles.iconButton} accessibilityRole="button" accessibilityLabel="작품 찾기" onPress={() => router.push('/search')}><Icon name="search" size={22} color={colors.text} /></Pressable>
        </View>
      </View>
      <View style={styles.tabs} accessibilityRole="tablist">{tabs.map((item) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: item === tab }} style={[styles.tab, item === tab && styles.selectedTab]} onPress={() => setTab(item)}><AppText weight={item === tab ? 'bold' : 'medium'} style={[styles.tabText, item === tab && styles.selectedText]}>{item}</AppText></Pressable>)}</View>
      {tab === '추천' ? <>
        <View style={styles.hero}>
          <DramaImage drama={hero} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" />
          <LinearGradient pointerEvents="none" colors={['#0B0C0F00', '#0B0C0F29', '#0B0C0FE6', colors.background]} locations={[0.14, 0.35, 0.72, 1]} style={StyleSheet.absoluteFill} />
          <View style={styles.heroContent}>
            <View style={styles.eyebrowRow}><View style={styles.liveDot} /><AppText weight="semibold" style={styles.eyebrow}>오늘의 발견  /  {hero.studio}</AppText></View>
            <AppText style={styles.heroCopy}>{hero.copy}</AppText><AppText weight="bold" style={styles.heroTitle}>{hero.title}</AppText><AppText style={styles.heroMeta}>{hero.tag}  ·  회당 1분  ·  {hero.total}부작</AppText>
            <View style={styles.heroActions}><Button style={styles.heroButton} disabled={!ready} label={heroHistory ? '이어서 보기' : width < 360 ? `${hero.free}화 무료로 보기` : `${hero.free}화까지 무료로 보기`} icon={<Icon name="play" size={17} color={colors.background} />} onPress={() => play(hero)} /><Pressable disabled={!ready} style={[styles.saveButton, heroSaved && styles.savedButton]} accessibilityRole="button" accessibilityLabel={heroSaved ? '저장 취소' : '작품 저장'} accessibilityState={{ selected: heroSaved }} onPress={() => toggleSave(hero.id)}><Icon name={heroSaved ? 'check' : 'plus'} size={23} color={heroSaved ? colors.accent : colors.text} /></Pressable></View>
            <Pressable style={styles.detailLink} accessibilityRole="button" onPress={() => openDetail(hero)}><AppText style={styles.detailLinkText}>작품 소개</AppText><Icon name="arrow-up-right" size={14} color={colors.muted} /></Pressable>
          </View>
          <View style={styles.heroPagination}>{dramas.map((drama, index) => <Pressable key={drama.id} style={styles.heroPageButton} accessibilityRole="button" accessibilityLabel={`${drama.title} 추천 보기`} accessibilityState={{ selected: heroIndex === index }} onPress={() => setHeroIndex(index)}><View style={[styles.heroPageLine, heroIndex === index && styles.activePageLine]} /><AppText style={[styles.heroPageNumber, heroIndex === index && styles.accent]}>{String(index + 1).padStart(2, '0')}</AppText></Pressable>)}</View>
        </View>
        <View style={styles.section}><SectionTitle eyebrow="QUICK ESCAPE" title="1분이면, 빠져드는 이야기" action="전체" onAction={() => setTab('최신')} /></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.posterRail}>{dramas.map((drama) => <Poster key={drama.id} drama={drama} width={posterWidth} onPress={() => openDetail(drama)} />)}</ScrollView>
        <View style={styles.section}>
          <Pressable style={styles.romanceBanner} accessibilityRole="button" accessibilityLabel="로맨스 작품 찾아보기" onPress={() => openGenre('로맨스')}><DramaImage drama={dramas[1]} style={StyleSheet.absoluteFill} contentPosition="top" /><LinearGradient pointerEvents="none" colors={['#0B0C0FDB', '#0B0C0F10']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /><View style={styles.bannerContent}><AppText weight="medium" style={styles.eyebrow}>A LITTLE ROMANCE</AppText><AppText weight="bold" style={styles.bannerTitle}>{'오늘은,\n설레도 괜찮아.'}</AppText><AppText style={styles.bannerCopy}>퇴근길을 채울 로맨스 한 편</AppText><View style={styles.bannerLink}><AppText style={styles.bannerCopy}>로맨스 만나기</AppText><Icon name="arrow-up-right" size={16} color={colors.text} /></View></View></Pressable>
          <SectionTitle eyebrow="EDITOR’S PICK" title="지금 눈여겨볼 TOP 3" action="더 보기" onAction={() => setTab('랭킹')} />{ranks}
          <Pressable style={styles.previewLink} accessibilityRole="button" onPress={() => router.push('/recommend')}><View style={styles.previewIcon}><Icon name="film" color={colors.accent} size={24} /></View><View style={styles.flex}><AppText weight="semibold" style={styles.previewTitle}>어떤 이야기가 취향인가요?</AppText><AppText style={styles.small}>넘겨보며 다음 드라마를 골라보세요.</AppText></View><Icon name="arrow-right" color={colors.text} size={19} /></Pressable>
          <AppText style={styles.footer}>{'AI DRAMA · 앱 디자인 체험\n예시 작품과 포인트로 감상 흐름을 둘러보세요.'}</AppText>
        </View>
      </> : tab === '최신' ? <View style={styles.section}><SectionTitle eyebrow="JUST ARRIVED" title="새로운 이야기가 도착했어요" /><View style={styles.posterGrid}>{dramas.map((drama) => <Poster key={drama.id} drama={drama} width={posterWidth} onPress={() => openDetail(drama)} />)}</View></View> : tab === '랭킹' ? <View style={styles.section}><SectionTitle eyebrow="THE TOP THREE" title="지금 눈여겨볼 TOP 3" /><AppText style={styles.intro}>편집부가 고른 이번 주의 이야기</AppText>{ranks}</View> : <View style={styles.section}><SectionTitle eyebrow="FIND YOUR MOOD" title="오늘은 어떤 이야기인가요?" /><View style={styles.genreList}>{dramas.map((drama) => <Pressable key={drama.id} style={styles.genreTile} accessibilityRole="button" accessibilityLabel={`${drama.tag} 작품 찾기`} onPress={() => openGenre(drama.tag)}><DramaImage drama={drama} style={StyleSheet.absoluteFill} contentPosition="top" /><LinearGradient pointerEvents="none" colors={['#0B0C0FDB', '#0B0C0F10']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /><View style={styles.genreContent}><AppText weight="bold" style={styles.genreTitle}>{drama.tag}</AppText><Icon name="arrow-up-right" color={colors.text} size={23} /></View></Pressable>)}</View></View>}
    </Page>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 28, gap: 0 }, flex: { flex: 1 }, heroButton: { flex: 1, paddingHorizontal: 12 },
  header: { paddingHorizontal: 22, height: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 5 }, logo: { fontSize: 22, letterSpacing: -1.1 },
  logoDot: { width: 5, height: 5, borderRadius: 3, borderCurve: 'continuous', backgroundColor: colors.accent, marginTop: 13 },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' }, iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  balance: { minHeight: 40, minWidth: 58, paddingHorizontal: 12, gap: 6, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 24, borderCurve: 'continuous' }, balanceNumber: { fontSize: 13 }, point: { color: colors.accent, fontSize: 11 },
  tabs: { flexDirection: 'row', gap: 25, paddingHorizontal: 22, marginBottom: 18 }, tab: { minHeight: 44, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' }, selectedTab: { borderBottomColor: colors.accent }, tabText: { fontSize: 15, color: colors.muted }, selectedText: { color: colors.text },
  hero: { minHeight: 550, marginHorizontal: 14, borderRadius: 20, borderCurve: 'continuous', overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: colors.surface },
  heroContent: { paddingHorizontal: 22, paddingTop: 240, paddingBottom: 10, gap: 12 }, eyebrowRow: { flexDirection: 'row', gap: 7, alignItems: 'center' }, liveDot: { width: 5, height: 5, borderRadius: 3, borderCurve: 'continuous', backgroundColor: colors.accent }, eyebrow: { fontSize: 9, lineHeight: 15, letterSpacing: 1.2, color: colors.text },
  heroCopy: { fontSize: 16, lineHeight: 23, color: '#E8EBE4' }, heroTitle: { fontSize: 40, lineHeight: 49, letterSpacing: -1.5 }, heroMeta: { fontSize: 11, lineHeight: 17, color: '#CAD0D0' }, heroActions: { flexDirection: 'row', gap: 8, marginTop: 7 },
  saveButton: { width: 50, minHeight: 50, borderRadius: 12, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }, savedButton: { borderColor: '#65794A' },
  detailLink: { minHeight: 35, flexDirection: 'row', gap: 6, alignItems: 'center', alignSelf: 'flex-start' }, detailLinkText: { color: colors.muted, fontSize: 11 },
  heroPagination: { flexDirection: 'row', gap: 7, alignSelf: 'center', paddingBottom: 10 }, heroPageButton: { minWidth: 34, minHeight: 35, alignItems: 'center', justifyContent: 'center', gap: 4 }, heroPageLine: { width: 20, height: 2, backgroundColor: colors.border }, activePageLine: { width: 28, backgroundColor: colors.accent }, heroPageNumber: { fontSize: 9, color: colors.muted },
  section: { paddingHorizontal: 22, paddingTop: 30 }, posterRail: { paddingHorizontal: 22, gap: 14, paddingTop: 17, paddingBottom: 6 }, posterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingTop: 20 },
  romanceBanner: { minHeight: 280, borderRadius: 18, borderCurve: 'continuous', overflow: 'hidden', marginBottom: 34 }, bannerContent: { padding: 24, gap: 12 }, bannerTitle: { fontSize: 29, lineHeight: 38, marginTop: 7 }, bannerCopy: { fontSize: 12, color: '#E5E8DF' }, bannerLink: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10 },
  rankRow: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: colors.border }, rankNumber: { width: 26, fontSize: 31, color: colors.muted }, rankImage: { width: 60, height: 84, borderRadius: 7, borderCurve: 'continuous' }, rankCopy: { flex: 1, gap: 4 }, overline: { fontSize: 8, lineHeight: 13, letterSpacing: 1, color: colors.muted }, rankTitle: { fontSize: 16 }, small: { fontSize: 11, lineHeight: 17, color: colors.muted }, free: { fontSize: 10, color: colors.accent }, accent: { color: colors.accent },
  previewLink: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 14, borderCurve: 'continuous', padding: 17, marginTop: 30 }, previewIcon: { width: 37, height: 46, justifyContent: 'center', alignItems: 'center' }, previewTitle: { fontSize: 14, marginBottom: 5 }, footer: { color: colors.muted, fontSize: 10, lineHeight: 17, textAlign: 'center', marginTop: 35 }, intro: { color: colors.muted, fontSize: 13, marginTop: 10, marginBottom: 10 },
  genreList: { gap: 15, marginTop: 20 }, genreTile: { minHeight: 175, borderRadius: 15, borderCurve: 'continuous', overflow: 'hidden', justifyContent: 'flex-end' }, genreContent: { padding: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, genreTitle: { fontSize: 28 },
});
