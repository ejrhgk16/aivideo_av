import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, Icon, Page, SectionTitle } from '@/components/ui';
import { colors } from '@/common/theme/tokens';

export function AccountScreen() {
  const router = useRouter();
  return <Page>
    <SectionTitle title="내 정보" eyebrow="MY PAGE" />
    <View style={styles.profile}>
      <View style={styles.avatar}><Icon name="user" size={28} color={colors.accent} /></View>
      <View style={styles.copy}>
        <AppText weight="bold" style={styles.title}>게스트</AppText>
        <AppText style={styles.muted}>계정 기능은 준비 중이에요.</AppText>
      </View>
    </View>
    <SectionTitle title="보관함" />
    <Button label="저장한 작품" variant="secondary" icon={<Icon name="bookmark" />} onPress={() => router.push({ pathname: '/library', params: { tab: 'saved' } })} />
    <Button label="시청 기록" variant="secondary" icon={<Icon name="clock" />} onPress={() => router.push({ pathname: '/library', params: { tab: 'history' } })} />
  </Page>;
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 5 },
  title: { fontSize: 24, lineHeight: 32 },
  muted: { color: colors.muted, lineHeight: 22, fontSize: 14 },
});
