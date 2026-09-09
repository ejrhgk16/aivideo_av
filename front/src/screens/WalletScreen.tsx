import { useEffect, useRef, useState } from 'react';
import { AppState, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useIsFocused, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button, Icon, Page, SectionTitle } from '@/components/ui';
import { useExperience } from '@/features/drama/ExperienceProvider';
import { DAILY_AD_LIMIT, remainingAds } from '@/features/drama/experience';
import { colors } from '@/theme/tokens';

const packs = [{ points: 100, price: '1,100원' }, { points: 300, price: '3,300원' }, { points: 600, price: '6,600원' }];

export function WalletScreen() {
  const router = useRouter();
  const { state, ready, storageError, claimAd, buyPack } = useExperience();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [modal, setModal] = useState<'ad-ready' | 'ad-running' | 'ad-done' | 'pack' | null>(null);
  const [remaining, setRemaining] = useState(5);
  const [pack, setPack] = useState(packs[0]);
  const [notice, setNotice] = useState('');
  const completed = useRef(false);
  const adCount = DAILY_AD_LIMIT - remainingAds(state);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => setActive(next === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (modal !== 'ad-running' || !focused || !active) return;
    const timer = setInterval(() => setRemaining(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [modal, focused, active]);
  useEffect(() => { if (modal === 'ad-running' && remaining === 0) setModal('ad-done'); }, [modal, remaining]);
  function finishAd() {
    if (completed.current || modal !== 'ad-done') return;
    completed.current = true;
    setNotice(claimAd() ? '10포인트를 받았어요. 회차를 볼 때 사용을 확인해요.' : '오늘 받을 수 있는 광고 보상을 모두 받았어요.');
    setModal(null);
  }
  function finishPack() {
    if (completed.current || modal !== 'pack') return;
    completed.current = true;
    setNotice(buyPack(pack.points) ? `${pack.points}포인트 충전을 체험했어요. 실제 결제는 없어요.` : '충전을 완료하지 못했어요. 다시 확인해 주세요.');
    setModal(null);
  }
  const close = () => setModal(null);
  return <Page>
    <Button label="돌아가기" variant="ghost" icon={<Icon name="chevron-left" />} onPress={() => router.canGoBack() ? router.back() : router.replace('/account')} />
    <SectionTitle title="내 포인트" eyebrow="WALLET" />
    <View style={styles.balance}><Icon name="zap" size={25} color={colors.accent} /><AppText weight="bold" style={styles.amount}>{state.balance.toLocaleString()} <AppText style={styles.unit}>포인트</AppText></AppText><AppText style={styles.muted}>유료 회차를 열 때 10포인트씩 사용해요.</AppText></View>
    {notice ? <AppText accessibilityLiveRegion="polite" style={styles.notice}>{notice}</AppText> : null}
    {storageError ? <AppText style={styles.notice}>기기에 기록을 저장하지 못했어요. 앱을 닫으면 기록이 사라질 수 있어요.</AppText> : null}
    <SectionTitle title="광고로 포인트 받기" />
    <View style={styles.panel}>
      <View style={styles.row}><AppText weight="semibold">한 번에 10포인트</AppText><AppText style={styles.muted}>{adCount} / 5회</AppText></View>
      <AppText style={styles.muted}>하루 최대 5회 · 지금은 5초 광고 시청 체험이에요.</AppText>
      <Button label={adCount >= 5 ? '오늘 보상을 모두 받았어요' : '광고 보고 10포인트 받기'} disabled={!ready || adCount >= 5} onPress={() => { completed.current = false; setRemaining(5); setModal('ad-ready'); }} />
    </View>
    <SectionTitle title="포인트 충전" />
    <AppText style={styles.muted}>상품과 금액은 예시예요. 실제 앱 마켓 결제는 연결 전이에요.</AppText>
    {packs.map(item => <View key={item.points} style={styles.pack}><View><AppText weight="bold">{item.points}포인트</AppText><AppText style={styles.muted}>{item.price}</AppText></View><Button label="충전 체험" variant="secondary" disabled={!ready} onPress={() => { completed.current = false; setPack(item); setModal('pack'); }} /></View>)}
    <SectionTitle title="포인트 내역" />
    {state.ledger.length === 0 ? <AppText style={styles.muted}>아직 받은 포인트와 사용한 포인트가 없어요.</AppText> : state.ledger.map(entry => <View style={styles.entry} key={entry.id}><View style={styles.entryText}><AppText>{entry.label}</AppText><AppText style={styles.small}>{new Date(entry.at).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</AppText></View><AppText weight="bold" style={entry.amount > 0 ? styles.credit : undefined}>{entry.amount > 0 ? '+' : ''}{entry.amount} P</AppText></View>)}
    <Modal visible={modal !== null} animationType="slide" presentationStyle="formSheet" onRequestClose={close}>
      <ScrollView style={styles.modal} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.modalContent, { paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={styles.row}><AppText weight="bold" style={styles.title}>{modal === 'pack' ? '충전 확인' : '광고 보상'}</AppText><Button label="닫기" variant="ghost" onPress={close} /></View>
        {modal === 'pack' ? <><AppText weight="bold" style={styles.amount}>{pack.points}포인트</AppText><AppText style={styles.title}>{pack.price}</AppText><AppText style={styles.muted}>실제 결제 없이 포인트 충전 흐름을 체험해요. 충전해도 유료 회차가 자동으로 열리지는 않아요.</AppText><Button label="결제 완료 체험" onPress={finishPack} /></> : modal === 'ad-ready' ? <><AppText weight="bold" style={styles.title}>5초를 시청하고 10포인트 받기</AppText><AppText style={styles.muted}>실제 광고가 없는 화면 체험이에요. 끝까지 시청한 뒤 받기 버튼을 눌러 주세요. 중간에 닫으면 보상은 없어요.</AppText><Button label="광고 시청 체험 시작" onPress={() => setModal('ad-running')} /></> : modal === 'ad-running' ? <><View style={styles.countdown}><Icon name="play-circle" size={48} color={colors.accent} /><AppText weight="bold" style={styles.amount}>{remaining}초</AppText><AppText style={styles.muted}>광고 시청 체험 · 실제 광고 없음</AppText></View><AppText style={styles.muted}>앱을 벗어나면 시간이 멈춰요.</AppText></> : <><Icon name="check-circle" size={48} color={colors.accent} /><AppText weight="bold" style={styles.title}>시청 체험을 완료했어요</AppText><Button label="10포인트 받기" onPress={finishAd} /></>}
        <Button label={modal === 'ad-running' ? '그만보기 · 보상 없이 닫기' : '취소'} variant="secondary" onPress={close} />
      </ScrollView>
    </Modal>
  </Page>;
}

const styles = StyleSheet.create({
  balance: { backgroundColor: colors.surface, borderRadius: 20, padding: 24, gap: 12 }, amount: { fontSize: 36, lineHeight: 46 }, unit: { fontSize: 16, color: colors.muted }, title: { fontSize: 22, lineHeight: 30 }, muted: { color: colors.muted, lineHeight: 22 }, small: { color: colors.muted, fontSize: 12, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, panel: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, gap: 16 }, pack: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 16 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }, entryText: { flex: 1 }, credit: { color: colors.accent }, notice: { color: colors.accent, lineHeight: 23, paddingVertical: 8 },
  modal: { flex: 1, backgroundColor: colors.background }, modalContent: { padding: 24, gap: 24 }, countdown: { alignItems: 'center', justifyContent: 'center', gap: 24, minHeight: 240, backgroundColor: colors.surface, borderRadius: 20 },
});
