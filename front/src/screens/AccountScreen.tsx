import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { AppText, Button, Icon, Page, SectionTitle } from '@/components/ui';
import { AppTopBar } from '@/components/AppTopBar';
import { colors } from '@/common/theme/tokens';

type AccountDialog = 'settings' | 'help' | 'about' | null;

export function AccountScreen() {
  const router = useRouter();
  const [dialog, setDialog] = useState<AccountDialog>(null);
  const [dialogVisible, setDialogVisible] = useState(false);
  const openDialog = (next: Exclude<AccountDialog, null>) => {
    setDialog(next);
    setDialogVisible(true);
  };
  const closeDialog = () => setDialogVisible(false);

  return <Page header={<AppTopBar />} contentStyle={styles.page}>
    <SectionTitle title="나의 작은 영화관" eyebrow="MY SPACE" />
    <View style={styles.profile}>
      <View style={styles.avatar}><Icon name="user" size={27} color={colors.accent} /></View>
      <View style={styles.copy}>
        <AppText weight="bold" style={styles.title}>드라마를 좋아하는 당신</AppText>
        <AppText style={styles.muted}>게스트로 둘러보고 있어요</AppText>
      </View>
    </View>
    <View style={styles.accountBadge}><AppText style={styles.badgeText}>체험 계정</AppText></View>

    <Pressable accessibilityRole="button" onPress={() => router.push('/points')} style={styles.pointsCard}>
      <View style={styles.pointsHeader}>
        <View style={styles.pointsIcon}><Icon name="zap" size={19} color={colors.accent} /></View>
        <AppText weight="semibold">내 포인트</AppText>
        <Icon name="chevron-right" size={18} color={colors.muted} />
      </View>
      <AppText weight="bold" style={styles.pointsAmount}>— P</AppText>
      <AppText style={styles.muted}>포인트 정보를 준비하고 있어요</AppText>
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
          </View> : dialog === 'help' ? <AppText style={styles.dialogCopy}>현재 포인트 기능은 화면만 준비되어 있어요. 포인트 조회와 사용은 아직 제공되지 않아요.</AppText>
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
  pointsCard: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 19, gap: 8 },
  pointsHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pointsIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  pointsAmount: { fontSize: 29, lineHeight: 37, marginTop: 5 },
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
