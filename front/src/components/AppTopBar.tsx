import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { AppText, Icon, Peeka } from '@/components/ui';
import { radius, spacing, textSizes } from '@/common/theme/tokens';
import { createThemedStyles, useColorSchemeName, useToggleColorScheme } from '@/common/theme/theme';
import { useUser } from '@/features/user/UserProvider';

// 찾기는 아래 메뉴에만 둔다. 헤더에는 로고, 화면 모드(해/달) 버튼, 포인트 알약만 있다.
export function AppTopBar() {
  const router = useRouter();
  const styles = useStyles();
  const { points } = useUser();
  const dark = useColorSchemeName() === 'dark';
  const toggleColorScheme = useToggleColorScheme();
  const amount = points === null ? '—' : points.toLocaleString('ko-KR');
  const pointsDescription = points === null ? '로그인 후 포인트를 확인할 수 있어요'
    : `사용 가능한 포인트는 ${amount} P예요`;

  return <View style={styles.bar}>
    <Pressable accessibilityRole="button" accessibilityLabel="홈으로 이동" onPress={() => router.navigate('/')} style={styles.wordmark}>
      <Peeka slot="logo" size={32} style={styles.logoMark} /><AppText weight="extrabold" style={styles.logo}>peeka</AppText>
    </Pressable>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel={dark ? '라이트 모드로 바꾸기' : '다크 모드로 바꾸기'} onPress={toggleColorScheme} style={styles.modeButton}>
        <Icon name={dark ? 'sun' : 'moon'} size={20} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`${pointsDescription}, 포인트 화면 열기`} onPress={() => router.push('/points')} style={styles.pointsPill}>
        <AppText weight="bold" style={styles.balance}>{amount}</AppText>
        <View style={styles.pointSymbol}><AppText weight="bold" style={styles.pointText}>P</AppText></View>
      </Pressable>
    </View>
  </View>;
}

const useStyles = createThemedStyles((colors) => ({
  bar: { width: '100%', maxWidth: 960, alignSelf: 'center', height: 64, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  // 로고 글자는 글자 단계 밖의 예외(23px, 800, -1.1px)다.
  logo: { fontSize: 23, lineHeight: 30, letterSpacing: -1.1 },
  logoMark: { borderRadius: radius.md, backgroundColor: colors.lavender },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  modeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  pointsPill: { minHeight: 40, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill, borderCurve: 'continuous' },
  balance: { ...textSizes.label14 },
  // 노른자 노랑의 유일한 장식 예외: 헤더 포인트 알약의 동전 기호.
  pointSymbol: { width: 17, height: 17, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: colors.yolk },
  pointText: { color: colors.onYolk, fontSize: 11, lineHeight: 15 },
}));
