import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button, Icon, Page, SectionTitle } from '@/components/ui';
import { useExperience } from '@/features/drama/ExperienceProvider';
import { colors } from '@/theme/tokens';

export function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [info, setInfo] = useState<{ title: string; description: string } | null>(null);
  const { state, ready, storageError, setSetting } = useExperience();
  return <Page>
    <SectionTitle title="내 정보" eyebrow="MY PAGE" />
    <View style={styles.profile}><View style={styles.avatar}><Icon name="user" size={28} color={colors.accent} /></View><View style={styles.grow}><AppText weight="bold" style={styles.title}>게스트</AppText><AppText style={styles.muted}>이 기기에서 즐기는 나의 드라마</AppText></View></View>
    <View style={styles.wallet}><AppText style={styles.muted}>보유 포인트</AppText><AppText weight="bold" style={styles.amount}>{state.balance.toLocaleString()} <AppText style={styles.muted}>포인트</AppText></AppText><Button label="포인트 받기 · 충전" onPress={() => router.push('/wallet')} /></View>
    <SectionTitle title="나의 활동" />
    <Button label="시청 기록" variant="secondary" icon={<Icon name="clock" />} onPress={() => router.push({ pathname: '/library', params: { tab: 'history' } })} />
    <Button label={`찜한 작품 · ${state.saved.length}`} variant="secondary" icon={<Icon name="bookmark" />} onPress={() => router.push({ pathname: '/library', params: { tab: 'saved' } })} />
    <Button label="포인트 내역" variant="secondary" icon={<Icon name="list" />} onPress={() => router.push('/wallet')} />
    <SectionTitle title="재생 설정" />
    <View style={styles.setting}><View style={styles.grow}><AppText weight="medium">자막 표시</AppText><AppText style={styles.muted}>재생 화면의 한국어 자막</AppText></View><Switch accessibilityLabel="자막 표시" value={state.captions} disabled={!ready} onValueChange={value => setSetting('captions', value)} trackColor={{ false: colors.border, true: colors.accent }} thumbColor={colors.text} /></View>
    <View style={styles.setting}><View style={styles.grow}><AppText weight="medium">다음 화 자동 재생</AppText><AppText style={styles.muted}>유료 회차는 포인트 사용을 먼저 확인해요.</AppText></View><Switch accessibilityLabel="다음 화 자동 재생" value={state.autoNext} disabled={!ready} onValueChange={value => setSetting('autoNext', value)} trackColor={{ false: colors.border, true: colors.accent }} thumbColor={colors.text} /></View>
    <SectionTitle title="도움말 · 앱 정보" />
    <Button label="자주 묻는 질문" variant="ghost" icon={<Icon name="help-circle" />} onPress={() => setInfo({ title: '이용 안내', description: '작품에 표시된 무료 회차 이후에는 회차당 10포인트가 필요해요. 한 번 연 회차는 추가 차감 없이 다시 볼 수 있어요. 광고·충전은 실제 결제 없는 체험이며, 영상은 표지와 자막으로 표현한 시안이에요.' })} />
    <Button label="문의 안내" variant="ghost" icon={<Icon name="message-circle" />} onPress={() => setInfo({ title: '문의 안내', description: '현재 앱은 기기 안에서 작동하는 체험판이에요. 실제 문의 접수는 아직 연결되지 않았어요.' })} />
    <Button label="앱 정보 · 데이터 보관" variant="ghost" icon={<Icon name="info" />} onPress={() => setInfo({ title: 'AI DRAMA 체험판', description: '시청 기록, 찜, 포인트와 설정은 이 기기에 저장돼요. 계정 동기화와 실제 결제·광고·영상 서비스는 연결 전이에요. 앱 데이터를 삭제하면 기록도 사라져요.' })} />
    {storageError ? <AppText style={styles.warning}>기기에 기록을 저장하지 못했어요. 앱을 닫으면 변경 내용이 사라질 수 있어요.</AppText> : null}
    <Modal visible={info !== null} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setInfo(null)}><ScrollView style={styles.modal} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.modalContent, { paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 24) }]}><AppText weight="bold" style={styles.title}>{info?.title}</AppText><AppText style={styles.body}>{info?.description}</AppText><Button label="닫기" onPress={() => setInfo(null)} /></ScrollView></Modal>
  </Page>;
}
const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: colors.background }, modalContent: { padding: 24, gap: 24 }, body: { lineHeight: 27 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 16 }, avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, grow: { flex: 1, gap: 5 }, title: { fontSize: 24, lineHeight: 32 }, muted: { color: colors.muted, lineHeight: 22, fontSize: 14 }, wallet: { padding: 24, borderRadius: 20, backgroundColor: colors.surface, gap: 14 }, amount: { fontSize: 36, lineHeight: 44 }, setting: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }, warning: { color: colors.danger, lineHeight: 22 },
});
