import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, FlatList, Platform, Pressable, StyleSheet, View, type ViewToken } from 'react-native';
import { useIsFocused, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button, DramaImage, Icon } from '@/components/ui';
import { dramas, type Drama } from '@/features/drama/catalog';
import { useExperience } from '@/features/drama/ExperienceProvider';
import { shareDrama } from '@/services/share-drama';
import { colors } from '@/theme/tokens';

type CardProps = { drama: Drama; height: number; active: boolean; saved: boolean; captions: boolean; watchedEpisode?: number; onSave: (id: string) => void };
const PreviewCard = memo(function PreviewCard({ drama, height, active, saved, captions, watchedEpisode, onSave }: CardProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [paused, setPaused] = useState(false);
  const [time, setTime] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [notice, setNotice] = useState('');
  const [sharing, setSharing] = useState(false);
  const zoom = useRef(new Animated.Value(1)).current;
  const running = active && !paused && !scrubbing && !sharing;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setTime(value => value >= 59 ? 0 : value + 1), 1000);
    const motion = Animated.loop(Animated.sequence([
      Animated.timing(zoom, { toValue: 1.065, duration: 12000, useNativeDriver: true }),
      Animated.timing(zoom, { toValue: 1, duration: 12000, useNativeDriver: true }),
    ]));
    motion.start();
    return () => { clearInterval(timer); motion.stop(); };
  }, [running, zoom]);
  const details = () => router.push({ pathname: '/drama/[id]', params: { id: drama.id } });
  async function share() {
    if (sharing) return;
    setSharing(true);
    try { await shareDrama(drama); if (Platform.OS === 'web') setNotice('작품 링크를 복사했어요.'); }
    catch { setNotice('공유를 완료하지 못했어요.'); }
    finally { setSharing(false); }
  }
  return <View style={[styles.card, { height }]} accessibilityElementsHidden={!active} importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}>
    <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: zoom }] }]}><DramaImage drama={drama} style={styles.image} /></Animated.View>
    <LinearGradient colors={['rgba(0,0,0,.55)', 'rgba(0,0,0,.08)', 'rgba(0,0,0,.94)']} locations={[0, .35, 1]} style={StyleSheet.absoluteFill} />
    <View style={[styles.top, { paddingTop: insets.top + 12 }]}><View><AppText weight="bold" style={styles.heading}>추천</AppText><AppText style={styles.meta}>예고편 · 무료 미리보기</AppText></View><Icon name="volume-x" size={22} color="#fff" /></View>
    <View style={styles.center}><AppText style={styles.sample}>샘플 화면 · 영상 연결 전</AppText><Pressable accessibilityRole="button" accessibilityLabel={paused ? '미리보기 재생' : '미리보기 일시 정지'} onPress={() => setPaused(value => !value)} style={styles.playButton}><Icon name={running ? 'pause' : 'play'} size={32} color="#fff" /></Pressable></View>
    <View style={styles.rail}>
      <Pressable accessibilityRole="button" accessibilityLabel={saved ? '찜 해제' : '찜하기'} accessibilityState={{ selected: saved }} style={styles.railButton} onPress={() => onSave(drama.id)}><Icon name="bookmark" size={28} color={saved ? colors.accent : '#fff'} /><AppText style={styles.railText}>찜</AppText></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="작품 소개와 회차" style={styles.railButton} onPress={details}><Icon name="layers" size={28} color="#fff" /><AppText style={styles.railText}>회차</AppText></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="작품 공유" disabled={sharing} style={styles.railButton} onPress={() => { void share(); }}><Icon name="share-2" size={26} color="#fff" /><AppText style={styles.railText}>공유</AppText></Pressable>
    </View>
    <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      {captions ? <AppText weight="semibold" style={styles.caption}>{time < 20 ? drama.copy.split('\n')[0] : time < 40 ? drama.copy.split('\n')[1] : '이야기는 이제 시작이다.'}</AppText> : null}
      <AppText style={styles.meta}>{drama.tag} · {drama.total}부작 · {drama.free}화 무료</AppText>
      <Pressable accessibilityRole="button" onPress={details} style={styles.titleButton}><AppText weight="bold" style={styles.title}>{drama.title}</AppText><Icon name="chevron-right" size={24} color="#fff" /></Pressable>
      <AppText numberOfLines={2} style={styles.description}>{drama.description}</AppText>
      <Button label={watchedEpisode ? '본편 이어보기' : '1화부터 본편 보기'} onPress={() => router.push({ pathname: '/player/[id]', params: { id: drama.id, ...(watchedEpisode ? { ep: String(watchedEpisode) } : {}) } })} />
      <Slider accessibilityLabel={`${drama.title} 미리보기 위치`} minimumValue={0} maximumValue={60} value={time} step={1} onSlidingStart={() => setScrubbing(true)} onSlidingComplete={value => { setTime(value); setScrubbing(false); }} minimumTrackTintColor={colors.accent} maximumTrackTintColor="#ffffff55" thumbTintColor={colors.accent} />
      <View style={styles.row}><AppText style={styles.meta}>{time >= 60 ? '01:00' : `00:${String(Math.floor(time)).padStart(2, '0')}`} / 01:00</AppText><AppText style={styles.meta}>위로 넘겨 다음 작품</AppText></View>
      {notice ? <AppText accessibilityLiveRegion="polite" style={styles.meta}>{notice}</AppText> : null}
    </View>
  </View>;
});

export function RecommendationScreen({ initialId }: { initialId?: string }) {
  const focused = useIsFocused();
  const { state, toggleSave } = useExperience();
  const firstIndex = Math.max(0, dramas.findIndex(drama => drama.id === initialId));
  const [index, setIndex] = useState(firstIndex);
  const [height, setHeight] = useState(0);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const list = useRef<FlatList<Drama>>(null);
  const indexRef = useRef(firstIndex);
  const initialIdRef = useRef(initialId);
  const viewability = useRef({ itemVisiblePercentThreshold: 80 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<Drama>[] }) => {
    const next = viewableItems[0]?.index;
    if (next !== null && next !== undefined) { indexRef.current = next; setIndex(next); }
    else setIndex(-1);
  }).current;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => setActive(next === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!focused || !height) return;
    const frame = requestAnimationFrame(() => list.current?.scrollToOffset({ offset: indexRef.current * height, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [focused, height]);
  useEffect(() => {
    if (!height || initialIdRef.current === initialId) return;
    initialIdRef.current = initialId;
    const next = dramas.findIndex(drama => drama.id === initialId);
    if (next < 0) return;
    indexRef.current = next;
    setIndex(next);
    list.current?.scrollToOffset({ offset: next * height, animated: false });
  }, [initialId, height]);
  const renderItem = useCallback(({ item, index: itemIndex }: { item: Drama; index: number }) => <PreviewCard drama={item} height={height} active={focused && active && index === itemIndex} saved={state.saved.includes(item.id)} captions={state.captions} watchedEpisode={state.history.find(entry => entry.id === item.id)?.ep} onSave={toggleSave} />, [height, focused, active, index, state.saved, state.captions, state.history, toggleSave]);
  return <View style={styles.screen} onLayout={event => setHeight(event.nativeEvent.layout.height)}>
    {height > 0 ? <FlatList ref={list} data={dramas} keyExtractor={item => item.id} renderItem={renderItem} pagingEnabled showsVerticalScrollIndicator={false} initialScrollIndex={firstIndex} initialNumToRender={dramas.length} maxToRenderPerBatch={dramas.length} windowSize={3} removeClippedSubviews={false} getItemLayout={(_, itemIndex) => ({ length: height, offset: itemIndex * height, index: itemIndex })} onViewableItemsChanged={onViewableItemsChanged} viewabilityConfig={viewability} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#08090A' }, card: { overflow: 'hidden', backgroundColor: '#08090A' }, image: { width: '100%', height: '100%' }, top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 }, heading: { color: '#fff', fontSize: 24, lineHeight: 32 }, meta: { color: '#DDDEE0', fontSize: 12, lineHeight: 18 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 }, sample: { color: '#fff', backgroundColor: '#0008', borderRadius: 8, padding: 8, fontSize: 12 }, playButton: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#0006', alignItems: 'center', justifyContent: 'center' }, rail: { position: 'absolute', right: 12, top: '28%', gap: 18 }, railButton: { minWidth: 48, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 5 }, railText: { fontSize: 12, color: '#fff' }, bottom: { paddingHorizontal: 20, gap: 8 }, caption: { color: '#fff', fontSize: 18, lineHeight: 27, textAlign: 'center', paddingHorizontal: 24, marginBottom: 20, textShadowColor: '#000', textShadowRadius: 8 }, titleButton: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 8 }, title: { color: '#fff', fontSize: 28, lineHeight: 36 }, description: { color: '#DDDEE0', lineHeight: 22, fontSize: 14, marginBottom: 8 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
