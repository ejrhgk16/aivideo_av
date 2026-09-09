import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useIsFocused, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button, DramaImage, EmptyState, Icon } from '@/components/ui';
import { getDrama } from '@/features/drama/catalog';
import { useExperience } from '@/features/drama/ExperienceProvider';
import { shareDrama } from '@/services/share-drama';
import { colors } from '@/theme/tokens';

type Sheet = 'unlock' | 'episodes' | 'details' | 'settings' | 'speed' | null;
const formatTime = (time: number) => `00:${String(Math.floor(time)).padStart(2, '0')}`;

export function PlayerScreen({ id, episode }: { id: string; episode?: string }) {
  const router = useRouter();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const drama = getDrama(id);
  const { state, ready, recordProgress, unlockEpisode, toggleSave, setSetting } = useExperience();
  const [ep, setEp] = useState(1);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [scrubbing, setScrubbing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState('');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const requestKey = `${id}:${episode ?? ''}`;
  const initialized = loadedKey === requestKey;
  const initializedKey = useRef('');
  const zoom = useRef(new Animated.Value(1)).current;
  const unlocked = !!drama && (ep <= drama.free || state.opened.includes(`${id}:${ep}`));
  const running = initialized && ready && focused && active && playing && unlocked && !sheet && !scrubbing && !sharing && time < 60;

  useEffect(() => {
    if (!ready || !drama || initializedKey.current === `${id}:${episode ?? ''}`) return;
    initializedKey.current = `${id}:${episode ?? ''}`;
    const previous = state.history.find(item => item.id === id);
    const requested = episode === undefined ? previous?.ep ?? 1 : Number(episode);
    const next = Number.isInteger(requested) && requested >= 1 && requested <= drama.total ? requested : 1;
    setEp(next);
    setTime(previous?.ep === next && previous.time < 60 ? previous.time : 0);
    setPlaying(true);
    setSheet(next > drama.free && !state.opened.includes(`${id}:${next}`) ? 'unlock' : null);
    setLoadedKey(`${id}:${episode ?? ''}`);
  }, [ready, drama, id, episode, state.history, state.opened]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => setActive(next === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setTime(value => Math.min(60, value + speed)), 1000);
    return () => clearInterval(timer);
  }, [running, speed]);
  useEffect(() => {
    if (initialized && unlocked && ready && focused && active) recordProgress(id, ep, time);
  }, [initialized, unlocked, ready, focused, active, id, ep, time, recordProgress]);
  useEffect(() => {
    if (!running) return;
    const motion = Animated.loop(Animated.sequence([
      Animated.timing(zoom, { toValue: 1.055, duration: 10000, useNativeDriver: true }),
      Animated.timing(zoom, { toValue: 1, duration: 10000, useNativeDriver: true }),
    ]));
    motion.start();
    return () => motion.stop();
  }, [running, zoom]);
  useEffect(() => {
    if (initialized && unlocked && playing && time >= 60 && state.autoNext && focused && active && !sheet && !sharing && !scrubbing && drama && ep < drama.total) goEpisode(ep + 1);
  }, [initialized, unlocked, playing, time, state.autoNext, focused, active, sheet, sharing, scrubbing, drama, ep]);

  function goEpisode(next: number) {
    if (!drama || next < 1 || next > drama.total) return;
    const previous = state.history.find(item => item.id === id && item.ep === next);
    setEp(next);
    setTime(previous?.time && previous.time < 60 ? previous.time : 0);
    setPlaying(true);
    setSheet(next > drama.free && !state.opened.includes(`${id}:${next}`) ? 'unlock' : null);
  }
  function confirmUnlock() {
    if (unlockEpisode(id, ep)) { setSheet(null); setPlaying(true); }
  }
  async function share() {
    if (!drama || sharing) return;
    setSharing(true);
    try { await shareDrama(drama); if (Platform.OS === 'web') setNotice('작품 링크를 복사했어요.'); }
    catch { setNotice('공유를 완료하지 못했어요.'); }
    finally { setSharing(false); }
  }
  const close = () => setSheet(null);
  const back = () => router.canGoBack() ? router.back() : router.replace('/');
  if (!drama) return <View style={styles.fallback}><EmptyState title="작품을 찾을 수 없어요" description="다른 작품을 골라 주세요." action="홈으로" onAction={() => router.replace('/')} /></View>;
  const caption = time < 20 ? drama.copy.split('\n')[0] : time < 40 ? drama.copy.split('\n')[1] : '이야기는 이제 시작이다.';

  return <View style={styles.screen}>
    <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: zoom }] }]}><DramaImage drama={drama} style={styles.image} /></Animated.View>
    <LinearGradient colors={['rgba(0,0,0,.55)', 'rgba(0,0,0,.10)', 'rgba(0,0,0,.94)']} locations={[0, .4, 1]} style={StyleSheet.absoluteFill} />
    <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={back} style={styles.iconButton}><Icon name="chevron-left" color="#fff" size={28} /></Pressable>
      <AppText weight="semibold" style={styles.white}>{ep}화</AppText>
      <View style={styles.grow} />
      <Pressable accessibilityRole="button" accessibilityLabel="재생 속도" onPress={() => setSheet('speed')} style={styles.iconButton}><AppText weight="semibold" style={styles.white}>{speed}×</AppText></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="재생 설정" onPress={() => setSheet('settings')} style={styles.iconButton}><Icon name="more-horizontal" color="#fff" size={26} /></Pressable>
    </View>
    <View style={styles.center}>
      <AppText style={styles.sample}>샘플 화면 · 실제 영상 연결 전</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel={unlocked ? playing ? '일시 정지' : '재생' : '회차 열기'} onPress={() => { if (!unlocked) setSheet('unlock'); else if (time >= 60) { setTime(0); setPlaying(true); } else setPlaying(value => !value); }} style={styles.playButton}>
        <Icon name={!unlocked ? 'lock' : running ? 'pause' : 'play'} size={36} color="#fff" />
      </Pressable>
    </View>
    <View style={styles.rail}>
      <Pressable accessibilityRole="button" accessibilityLabel={state.saved.includes(id) ? '찜 해제' : '찜하기'} accessibilityState={{ selected: state.saved.includes(id) }} onPress={() => toggleSave(id)} style={styles.railButton}><Icon name="bookmark" size={28} color={state.saved.includes(id) ? colors.accent : '#fff'} /><AppText style={styles.railText}>찜</AppText></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="회차 목록" onPress={() => setSheet('episodes')} style={styles.railButton}><Icon name="layers" size={28} color="#fff" /><AppText style={styles.railText}>회차</AppText></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="작품 공유" disabled={sharing} onPress={() => { void share(); }} style={styles.railButton}><Icon name="share-2" size={26} color="#fff" /><AppText style={styles.railText}>공유</AppText></Pressable>
    </View>
    <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      {state.captions && unlocked ? <AppText weight="semibold" style={styles.caption}>{caption}</AppText> : null}
      <Pressable accessibilityRole="button" onPress={() => setSheet('details')} style={styles.titleButton}><AppText weight="bold" style={styles.title}>{drama.title}</AppText><Icon name="chevron-right" size={22} color="#fff" /></Pressable>
      <AppText style={styles.meta}>{ep}화 · {drama.episode} · {drama.total}부작</AppText>
      {notice ? <AppText accessibilityLiveRegion="polite" style={styles.meta}>{notice}</AppText> : null}
      {!unlocked ? <Button label={`${ep}화 · 10포인트로 열기`} onPress={() => setSheet('unlock')} /> : null}
      <Slider accessibilityLabel="본편 재생 위치" minimumValue={0} maximumValue={60} step={1} value={time} disabled={!unlocked || !ready} onSlidingStart={() => setScrubbing(true)} onSlidingComplete={value => { setTime(value); setScrubbing(false); }} minimumTrackTintColor={colors.accent} maximumTrackTintColor="#ffffff55" thumbTintColor={colors.accent} />
      <View style={styles.row}><AppText style={styles.meta}>{time >= 60 ? '01:00' : formatTime(time)} / 01:00</AppText><AppText style={styles.meta}>화면 체험 · 음성 없음</AppText></View>
      <View style={styles.row}><Button label="이전 화" variant="secondary" disabled={ep <= 1} onPress={() => goEpisode(ep - 1)} style={styles.grow} /><Button label={ep === drama.total ? '다른 작품 보기' : '다음 화'} variant="secondary" onPress={() => ep === drama.total ? router.push('/recommend') : goEpisode(ep + 1)} style={styles.grow} /></View>
    </View>
    <Modal visible={sheet !== null} animationType="slide" presentationStyle="formSheet" onRequestClose={close}>
      <ScrollView style={styles.modal} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.sheet, { paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={styles.row}><AppText weight="bold" style={styles.sheetTitle}>{sheet === 'unlock' ? `${ep}화 열기` : sheet === 'speed' ? '재생 속도' : sheet === 'settings' ? '재생 설정' : drama.title}</AppText><Button label="닫기" variant="ghost" onPress={close} /></View>
        {sheet === 'unlock' ? <>
          <AppText style={styles.muted}>보유 {state.balance}포인트 · 필요한 포인트 10</AppText>
          <AppText style={styles.muted}>{state.balance >= 10 ? '보기 버튼을 눌러야 10포인트가 사용돼요. 한 번 연 회차는 다시 차감하지 않아요.' : '포인트를 받은 뒤 이 화면에서 사용을 확인해요. 충전만으로 회차가 열리지는 않아요.'}</AppText>
          {state.balance >= 10 ? <Button label={`10포인트로 ${ep}화 보기`} onPress={confirmUnlock} /> : <Button label="광고 보상 · 충전" onPress={() => { close(); router.push('/wallet'); }} />}
          <Button label="취소" variant="secondary" onPress={close} />
        </> : sheet === 'episodes' || sheet === 'details' ? <>
          <View style={styles.row}><Button label="작품 소개" variant={sheet === 'details' ? 'primary' : 'secondary'} style={styles.grow} onPress={() => setSheet('details')} /><Button label="회차" variant={sheet === 'episodes' ? 'primary' : 'secondary'} style={styles.grow} onPress={() => setSheet('episodes')} /></View>
          {sheet === 'details' ? <><AppText style={styles.muted}>{drama.tag} · {drama.total}부작 · {drama.studio}</AppText><AppText style={styles.description}>{drama.description}</AppText><AppText style={styles.muted}>1~{drama.free}화 무료 · 이후 회차당 10포인트</AppText><Button label={`${ep}화로 돌아가기`} onPress={close} /></> : <><AppText style={styles.muted}>1~{drama.free}화 무료 · 이후 회차당 10포인트</AppText><View style={styles.grid}>{Array.from({ length: drama.total }, (_, i) => i + 1).map(number => <Pressable accessibilityRole="button" accessibilityLabel={`${number}화, ${number <= drama.free || state.opened.includes(`${id}:${number}`) ? '열림' : '10포인트'}`} key={number} onPress={() => goEpisode(number)} style={[styles.episode, number === ep && styles.selected]}><AppText weight="semibold">{number}화</AppText><AppText style={styles.small}>{number <= drama.free ? '무료' : state.opened.includes(`${id}:${number}`) ? '열림' : '10 P'}</AppText></Pressable>)}</View></>}
        </> : sheet === 'speed' ? [0.75, 1, 1.25, 1.5, 2].map(value => <Button key={value} label={`${value}×${speed === value ? ' · 선택됨' : ''}`} variant={speed === value ? 'primary' : 'secondary'} onPress={() => { setSpeed(value); close(); }} />) : sheet === 'settings' ? <>
          <View style={styles.row}><AppText>한국어 자막</AppText><Switch accessibilityLabel="한국어 자막" value={state.captions} onValueChange={value => setSetting('captions', value)} trackColor={{ true: colors.accent, false: colors.border }} /></View>
          <View style={styles.row}><AppText>다음 화 자동 재생</AppText><Switch accessibilityLabel="다음 화 자동 재생" value={state.autoNext} onValueChange={value => setSetting('autoNext', value)} trackColor={{ true: colors.accent, false: colors.border }} /></View>
          <AppText style={styles.muted}>유료 회차는 자동 재생 전에 포인트 사용을 확인해요.</AppText><AppText style={styles.muted}>화질 · 영상 연결 후 설정할 수 있어요.</AppText>
        </> : null}
      </ScrollView>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#08090A', overflow: 'hidden' }, image: { width: '100%', height: '100%' }, fallback: { flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12 }, iconButton: { minWidth: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, grow: { flex: 1 }, white: { color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 }, sample: { fontSize: 12, color: '#fff', backgroundColor: '#0008', padding: 8, borderRadius: 8 }, playButton: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#0006', justifyContent: 'center', alignItems: 'center' },
  rail: { position: 'absolute', right: 12, top: '29%', gap: 18 }, railButton: { minWidth: 48, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 5 }, railText: { color: '#fff', fontSize: 12 },
  bottom: { paddingHorizontal: 20, gap: 10 }, caption: { color: '#fff', fontSize: 18, lineHeight: 27, textAlign: 'center', paddingHorizontal: 24, marginBottom: 20, textShadowColor: '#000', textShadowRadius: 8 }, titleButton: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 8 }, title: { fontSize: 26, lineHeight: 34, color: '#fff' }, meta: { fontSize: 12, color: '#DDDEE0' }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  modal: { flex: 1, backgroundColor: colors.background }, sheet: { padding: 20, gap: 20 }, sheetTitle: { fontSize: 22, lineHeight: 30 }, muted: { color: colors.muted, lineHeight: 23 }, description: { lineHeight: 26 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, episode: { minWidth: 64, flexBasis: '21%', flexGrow: 1, height: 72, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: colors.border }, selected: { borderColor: colors.accent }, small: { fontSize: 12, color: colors.muted },
});
