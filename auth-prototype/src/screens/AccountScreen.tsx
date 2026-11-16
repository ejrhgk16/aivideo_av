import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { AppText, Button, Icon, Page, SectionTitle } from '@/components/ui';
import { AppTopBar } from '@/components/AppTopBar';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/common/theme/tokens';
import { useUser } from '@/features/user/UserProvider';

type AccountDialog = 'settings' | 'help' | 'about' | null;

export function AccountScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user, points } = useUser();
  const [dialog, setDialog] = useState<AccountDialog>(null);
  const [dialogVisible, setDialogVisible] = useState(false);
  const openDialog = (next: Exclude<AccountDialog, null>) => {
    setDialog(next);
    setDialogVisible(true);
  };
  const closeDialog = () => setDialogVisible(false);
  const accountTypeLabel = user === null ? '체험 계정' : {
    GUEST: '게스트',
    MEMBER: '회원',
    OPERATOR: '운영자',
    PARTNER: '제휴사',
  }[user.accountType];
  const amount = points === null ? '—' : points.toLocaleString('ko-KR');
  const pointsDescription = points === null ? '로그인 후 포인트를 확인할 수 있어요'
    : `사용 가능한 포인트는 ${amount} P예요`;

  return <Page header={<AppTopBar />} contentStyle={styles.page}>
    <SectionTitle title="나의 작은 영화관" eyebrow="MY SPACE" />
    <View style={styles.profile}>
      <View style={styles.avatar}><Icon name="user" size={27} color={colors.accent} /></View>
      <View style={styles.copy}>
        <AppText weight="bold" style={styles.title}>{user?.displayName || '드라마를 좋아하는 당신'}</AppText>
        <AppText style={styles.muted}>{user === null ? '게스트로 둘러보고 있어요' : accountTypeLabel}</AppText>
      </View>
    </View>
    <View style={styles.accountBadge}><AppText style={styles.badgeText}>{accountTypeLabel}</AppText></View>

    <Pressable accessibilityRole="button" accessibilityLabel={`내 포인트 ${amount}${points === null ? '' : ' P'}, 충전하기`} onPress={() => router.push('/points')} style={[styles.pointsCard, { borderRadius: width <= 700 ? 18 : 20 }]}>
      <LinearGradient pointerEvents="none" colors={['#272F22', '#171C18']} style={StyleSheet.absoluteFill} />
      <View style={styles.pointsCopy}>
        <AppText weight="medium" style={styles.pointsLabel}>내 포인트</AppText>
        <View style={styles.pointsAmountRow}>
          <AppText weight="bold" style={[styles.pointsAmount, { fontSize: width <= 700 ? 39 : 45 }]}>{amount}</AppText>
          {points !== null ? <AppText weight="semibold" style={styles.pointsUnit}>P</AppText> : null}
        </View>
        {points === null ? <AppText style={styles.pointsHint}>{pointsDescription}</AppText> : null}
      </View>
      <View style={styles.chargeLink}>
        <AppText weight="semibold" style={styles.chargeLabel}>충전하기</AppText>
        <Icon name="arrow-right" size={17} color={colors.text} />
      </View>
    </Pressable>

    <View style={styles.menu}>
      <MenuItem icon="list" label="포인트 이용 내역" onPress={() => router.push({ pathname: '/points', params: { tab: 'history' } })} />
      <MenuItem icon="clock" label="시청 기록" onPress={() => router.push({ pathname: '/library', params: { tab: 'history' } })} />
    </View>
    <SectionTitle title="앱 설정" />
    <View style={styles.menu}>
      <MenuItem icon="settings" label="재생 설정" onPress={() => openDialog('settings')} />
      <MenuItem icon="help-circle" label="이용 안내" onPress={() => openDialog('help')} />
      <MenuItem icon="info" label="앱 정보" onPress={() => openDialog('about')} />
    </View>

    <Modal visible={dialogVisible} transparent animationType="fade" onRequestClose={closeDialog}>
      {dialog !== null && <View style={styles.modalBackdrop}>
        <View accessibilityRole="alert" style={styles.dialog}>
          <AppText weight="bold" style={styles.dialogTitle}>{dialog === 'settings' ? '재생 설정' : dialog === 'help' ? '이용 안내' : '앱 정보'}</AppText>
          {dialog === 'settings' ? <View style={styles.settingList}>
            <SettingItem label="자막 표시" />
            <SettingItem label="다음 회차 자동 재생" />
            <SettingItem label="화질" />
            <AppText style={styles.muted}>설정 기능은 준비 중이에요.</AppText>
          </View> : dialog === 'help' ? <AppText style={styles.dialogCopy}>포인트 잔액과 이용 내역을 확인할 수 있어요. 광고와 충전은 실제 결제 없이 체험할 수 있어요. 체험 포인트는 포인트 화면을 나가면 초기화돼요.</AppText>
            : <AppText style={styles.dialogCopy}>AI DRAMA{ '\n' }드라마를 위한 체험 화면</AppText>}
          <Button label="닫기" onPress={closeDialog} />
        </View>
      </View>}
    </Modal>
  </Page>;
}

function MenuItem({ icon, label, onPress }: { icon: 'list' | 'clock' | 'settings' | 'help-circle' | 'info'; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.menuItem}>
    <Icon name={icon} size={19} color={colors.muted} />
    <AppText style={styles.menuLabel}>{label}</AppText>
    <Icon name="chevron-right" size={18} color={colors.muted} />
  </Pressable>;
}

function SettingItem({ label }: { label: string }) {
  return <View style={styles.settingItem}>
    <AppText style={styles.menuLabel}>{label}</AppText>
    <AppText style={styles.settingDisabled}>준비 중</AppText>
  </View>;
}

const styles = StyleSheet.create({
  page: { gap: 24 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  avatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 4 },
  title: { fontSize: 19, lineHeight: 27 },
  muted: { color: colors.muted, lineHeight: 21, fontSize: 13 },
  accountBadge: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginTop: -12 },
  badgeText: { color: colors.muted, fontSize: 12 },
  pointsCard: { width: '100%', maxWidth: 780, alignSelf: 'center', minHeight: 126, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#CBF46A18', paddingHorizontal: 20, paddingVertical: 18 },
  pointsCopy: { flex: 1, minWidth: 0, gap: 6 },
  pointsLabel: { color: '#B8C3B1', fontSize: 14 },
  pointsAmountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  pointsAmount: { color: '#E1F8C3', lineHeight: 52 },
  pointsUnit: { color: '#E1F8C3', fontSize: 23, lineHeight: 30 },
  pointsHint: { color: '#B8C3B1', fontSize: 12, lineHeight: 18 },
  chargeLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 4 },
  chargeLabel: { color: colors.text, fontSize: 13 },
  menu: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginTop: -12 },
  menuItem: { minHeight: 56, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  menuLabel: { flex: 1, fontSize: 14 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#00000099' },
  dialog: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 22, gap: 20 },
  dialogTitle: { fontSize: 20, lineHeight: 28 },
  dialogCopy: { color: colors.muted, lineHeight: 23 },
  settingList: { gap: 15 },
  settingItem: { flexDirection: 'row', alignItems: 'center', minHeight: 34 },
  settingDisabled: { color: colors.muted, fontSize: 12 },
});
