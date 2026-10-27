import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Icon } from '@/components/ui';
import { colors } from '@/common/theme/tokens';
import { useUser } from '@/features/user/UserProvider';

export function AppTopBar() {
  const router = useRouter();
  const { points } = useUser();
  const amount = points === null ? '—' : points.toLocaleString('ko-KR');
  const pointsDescription = points === null ? '로그인 후 포인트를 확인할 수 있어요'
    : `사용 가능한 포인트는 ${amount} P예요`;

  return <View style={styles.bar}>
    <Pressable accessibilityRole="button" accessibilityLabel="홈으로 이동" onPress={() => router.navigate('/')} style={styles.wordmark}>
      <AppText weight="bold" style={styles.logo}>AI DRAMA</AppText><View style={styles.logoDot} />
    </Pressable>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${pointsDescription}, 포인트 화면 열기`} onPress={() => router.push('/points')} style={styles.pointsPill}>
        <AppText weight="bold" style={styles.balance}>{amount}</AppText>
        <View style={styles.pointSymbol}><AppText weight="bold" style={styles.pointText}>P</AppText></View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="작품 찾기" onPress={() => router.navigate('/search')} style={styles.iconButton}>
        <Icon name="search" size={22} color={colors.text} />
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  bar: { width: '100%', maxWidth: 960, alignSelf: 'center', height: 68, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5 },
  logo: { fontSize: 22, letterSpacing: -1.1 },
  logoDot: { width: 5, height: 5, borderRadius: 3, borderCurve: 'continuous', backgroundColor: colors.accent, marginTop: 13 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pointsPill: { minHeight: 44, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#1C2021', borderWidth: 1, borderColor: colors.border, borderRadius: 24, borderCurve: 'continuous' },
  balance: { fontSize: 14, lineHeight: 20 },
  pointSymbol: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: '#CBF46A66' },
  pointText: { color: colors.accent, fontSize: 11, lineHeight: 15 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
