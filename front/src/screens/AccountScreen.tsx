import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Modal, Pressable, Switch, View } from 'react-native';
import { AppText, Button, Icon, LoadingState, Page } from '@/components/ui';
import { AppTopBar } from '@/components/AppTopBar';
import { radius, spacing, textSizes } from '@/common/theme/tokens';
import { createThemedStyles, useColors } from '@/common/theme/theme';
import { useUser } from '@/features/user/UserProvider';

type AccountDialog = 'settings' | 'help' | 'about' | null;

export function AccountScreen() {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const { user, points, isRestoring, subtitlesEnabled, setSubtitlesEnabled, logout } = useUser();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const handleLogout = async () => {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
    } catch {
      setLogoutError('로그아웃 요청을 완료하지 못했어요. 연결 상태를 확인해 주세요.');
    } finally {
      setLoggingOut(false);
    }
  };
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
  const showAuthEntry = user === null || user.accountType === 'GUEST';
  const amount = points === null ? '—' : points.toLocaleString('ko-KR');
  const pointsDescription = points === null ? '로그인 후 포인트를 확인할 수 있어요'
    : `사용 가능한 포인트는 ${amount} P예요`;

  if (isRestoring) return <Page header={<AppTopBar />} scroll={false} contentStyle={styles.page}>
    <AppText weight="bold" accessibilityRole="header" style={styles.screenTitle}>내 정보</AppText>
    <LoadingState />
  </Page>;

  return <Page header={<AppTopBar />} contentStyle={styles.page}>
    <AppText weight="bold" accessibilityRole="header" style={styles.screenTitle}>내 정보</AppText>
    <View style={styles.profile}>
      <View style={styles.avatar}><Icon name="user" size={27} color={colors.accent} /></View>
      <View style={styles.copy}>
        <AppText weight="bold" style={styles.title}>{user?.displayName || '드라마를 좋아하는 당신'}</AppText>
        <AppText style={styles.muted}>{user === null ? '게스트로 둘러보고 있어요' : accountTypeLabel}</AppText>
      </View>
    </View>
    <View style={styles.accountBadge}><AppText style={styles.badgeText}>{accountTypeLabel}</AppText></View>

    {showAuthEntry ? <View style={styles.authActions}>
      <Button label="로그인하고 시작하기" onPress={() => router.push('/auth/login')} />
    </View> : null}

    <Pressable accessibilityRole="button" accessibilityLabel={`내 포인트 ${amount}${points === null ? '' : ' P'}, 충전하기`} onPress={() => router.push('/points')} style={styles.pointsCard}>
      <View style={styles.pointsCopy}>
        <AppText weight="medium" style={styles.pointsLabel}>내 포인트</AppText>
        <View style={styles.pointsAmountRow}>
          <AppText weight="bold" style={styles.pointsAmount}>{amount}</AppText>
          {points !== null ? <AppText weight="semibold" style={styles.pointsUnit}>P</AppText> : null}
        </View>
        {points === null ? <AppText style={styles.pointsHint}>{pointsDescription}</AppText> : null}
      </View>
      <View style={styles.chargeLink}>
        <AppText weight="semibold" style={styles.chargeLabel}>충전하기</AppText>
        <Icon name="arrow-right" size={18} color={colors.text} />
      </View>
    </Pressable>

    <View style={styles.menu}>
      <MenuItem icon="list" label="포인트 이용 내역" onPress={() => router.push({ pathname: '/points', params: { tab: 'history' } })} />
      <MenuItem icon="clock" label="시청 기록" onPress={() => router.push({ pathname: '/library', params: { tab: 'history' } })} />
      <MenuItem icon="settings" label="재생 설정" onPress={() => openDialog('settings')} />
      <MenuItem icon="help-circle" label="이용 안내" onPress={() => openDialog('help')} />
      <MenuItem icon="info" label="앱 정보" last onPress={() => openDialog('about')} />
    </View>
    {!showAuthEntry ? <Button label="로그아웃" variant="secondary" disabled={loggingOut} onPress={handleLogout} /> : null}
    {logoutError ? <AppText accessibilityRole="alert" style={styles.muted}>{logoutError}</AppText> : null}

    <Modal visible={dialogVisible} transparent animationType="fade" onRequestClose={closeDialog}>
      {dialog !== null && <View style={styles.modalBackdrop}>
        <View accessibilityRole="alert" style={styles.dialog}>
          <AppText weight="bold" style={styles.dialogTitle}>{dialog === 'settings' ? '재생 설정' : dialog === 'help' ? '이용 안내' : '앱 정보'}</AppText>
          {dialog === 'settings' ? <View style={styles.settingList}>
            <View style={styles.settingItem}>
              <AppText style={styles.menuLabel}>자막 표시</AppText>
              <Switch
                accessibilityRole="switch"
                accessibilityLabel="자막 표시"
                value={subtitlesEnabled}
                onValueChange={setSubtitlesEnabled}
              />
            </View>
            <SettingItem label="다음 회차 자동 재생" />
            <SettingItem label="화질" />
            <AppText style={styles.muted}>일부 설정 기능은 준비 중이에요.</AppText>
          </View> : dialog === 'help' ? <AppText style={styles.dialogCopy}>포인트 잔액과 이용 내역을 확인할 수 있어요. 광고와 충전은 실제 결제 없이 체험할 수 있어요. 체험 포인트는 포인트 화면을 나가면 초기화돼요.</AppText>
            : <AppText style={styles.dialogCopy}>peeka{ '\n' }드라마를 위한 체험 화면</AppText>}
          <Button label="닫기" variant="secondary" onPress={closeDialog} />
        </View>
      </View>}
    </Modal>
  </Page>;
}

function MenuItem({ icon, label, last, onPress }: { icon: 'list' | 'clock' | 'settings' | 'help-circle' | 'info'; label: string; last?: boolean; onPress: () => void }) {
  const styles = useStyles();
  const colors = useColors();
  return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.menuItem, last && styles.lastMenuItem]}>
    <Icon name={icon} size={20} color={colors.muted} />
    <AppText style={styles.menuLabel}>{label}</AppText>
    <Icon name="chevron-right" size={17} color={colors.muted} />
  </Pressable>;
}

function SettingItem({ label }: { label: string }) {
  const styles = useStyles();
  return <View style={styles.settingItem}>
    <AppText style={styles.menuLabel}>{label}</AppText>
    <AppText style={styles.settingDisabled}>준비 중</AppText>
  </View>;
}

const useStyles = createThemedStyles((colors) => ({
  page: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  screenTitle: { color: colors.text, ...textSizes.heading24 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  authActions: { flexDirection: 'row', gap: spacing.sm },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: spacing.xxs },
  title: { color: colors.text, ...textSizes.body18 },
  muted: { color: colors.muted, ...textSizes.label14 },
  accountBadge: { alignSelf: 'flex-start', backgroundColor: colors.elevated, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  badgeText: { color: colors.muted, ...textSizes.caption12 },
  pointsCard: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, overflow: 'hidden', backgroundColor: colors.elevated, borderRadius: radius.md, borderCurve: 'continuous', padding: spacing.lg },
  pointsCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  pointsLabel: { color: colors.text, ...textSizes.label14 },
  pointsAmountRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  pointsAmount: { color: colors.text, fontSize: 32, lineHeight: 38, fontVariant: ['tabular-nums'] },
  pointsUnit: { color: colors.accent, ...textSizes.heading24 },
  pointsHint: { color: colors.muted, ...textSizes.caption12 },
  chargeLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, paddingLeft: spacing.xxs },
  chargeLabel: { color: colors.text, ...textSizes.label14 },
  menu: { backgroundColor: colors.surface, borderRadius: radius.md, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  menuItem: { minHeight: 56, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  lastMenuItem: { borderBottomWidth: 0 },
  menuLabel: { flex: 1, color: colors.text, ...textSizes.label14 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.backdrop },
  dialog: { backgroundColor: colors.surface, borderRadius: radius.lg, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  dialogTitle: { color: colors.text, ...textSizes.body18 },
  dialogCopy: { color: colors.muted, ...textSizes.label14 },
  settingList: { gap: spacing.sm },
  settingItem: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  settingDisabled: { color: colors.muted, ...textSizes.caption12 },
}));
