import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Button, Icon, Page } from '@/components/ui';
import { AuthNotice } from '@/components/authUi';
import { colors } from '@/common/theme/tokens';

const providers = [
  { key: 'google', name: 'Google', labelColor: '#E3E3E3', icon: <FontAwesome name="google" size={18} color="#E3E3E3" /> },
  { key: 'kakao', name: '카카오', labelColor: '#000000D9', icon: <Icon name="message-circle" size={19} color="#000000" /> },
  { key: 'naver', name: '네이버', labelColor: '#FFFFFF', icon: <AppText weight="bold" style={{ fontSize: 20, lineHeight: 24, color: '#FFFFFF' }}>N</AppText> },
] as const;

export function AuthLoginScreen(): React.JSX.Element {
  const router = useRouter();
  const leave = () => router.canGoBack() ? router.back() : router.replace('/');

  return <Page contentStyle={styles.page}>
    <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={leave} style={styles.close}>
      <Icon name="x" size={22} />
    </Pressable>
    <View style={styles.brand}>
      <AppText weight="bold" accessibilityRole="header" accessibilityLabel="AI DRAMA 로그인" style={styles.wordmark}>AI DRAMA</AppText>
      <AppText style={styles.tagline}>보던 드라마, 어디서든 이어서</AppText>
      <AppText weight="semibold" style={styles.tagline}>로그인하고 시작하기</AppText>
    </View>
    <View style={styles.actions}>
      {providers.map((provider) => <View key={provider.key} style={styles.providerItem}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${provider.name}로 로그인`} onPress={() => router.push('/auth/onboarding')}
          style={({ pressed }) => [styles.provider, styles[provider.key], pressed && styles.pressed]}>
          <View style={styles.providerIcon}>{provider.icon}</View>
          <AppText weight="semibold" style={[styles.providerLabel, { color: provider.labelColor }]}>{provider.name}로 로그인</AppText>
        </Pressable>
        {provider.key === 'kakao' ? <AppText style={styles.providerNote}>카카오 로그인은 도입을 검토 중이에요.</AppText> : null}
      </View>)}
      <Button label="나중에 할게요" variant="ghost" onPress={leave} />
    </View>
    <View style={styles.footer}>
      <AppText style={styles.providerNote}>처음 이용하시면 약관 동의와 생년월일 확인을 진행해요.</AppText>
      <AuthNotice text="시안 화면이에요. 실제 로그인은 연결 전이에요." />
    </View>
  </Page>;
}

const styles = StyleSheet.create({
  page: { maxWidth: 480, flexGrow: 1, paddingTop: 8, gap: 26 },
  close: { alignSelf: 'flex-end', width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  brand: { flexGrow: 1, minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 12 },
  wordmark: { color: colors.accent, fontSize: 36, lineHeight: 44, letterSpacing: 1 },
  tagline: { fontSize: 16, lineHeight: 24, textAlign: 'center' },
  actions: { gap: 10 },
  providerItem: { gap: 6 },
  provider: { minHeight: 52, borderRadius: 14, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 52 },
  google: { backgroundColor: '#131314', borderWidth: 1, borderColor: '#8E918F' },
  kakao: { backgroundColor: '#FEE500' },
  naver: { backgroundColor: '#03C75A' },
  pressed: { opacity: 0.8 },
  providerIcon: { position: 'absolute', left: 18, width: 24, alignItems: 'center' },
  providerLabel: { fontSize: 16 },
  providerNote: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  footer: { gap: 6 },
});
