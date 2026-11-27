import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { AppText, Button, Icon, Page, Peeka } from '@/components/ui';
import { AuthNotice } from '@/components/authUi';
import { createThemedStyles, useColorSchemeName, type ColorSchemeName } from '@/common/theme/theme';

// 소셜 로그인 버튼은 각 서비스의 브랜드 색을 그대로 쓴다(앱 토큰 밖의 예외). Google은 화면 모드에 맞는 버튼을 쓴다.
const brand = {
  google: {
    light: { background: '#FFFFFF', border: '#747775', label: '#1F1F1F' },
    dark: { background: '#131314', border: '#8E918F', label: '#E3E3E3' },
  },
  kakao: { background: '#FEE500', label: '#000000D9', icon: '#000000' },
  naver: { background: '#03C75A', label: '#FFFFFF' },
} as const;

function providerList(scheme: ColorSchemeName) {
  const google = brand.google[scheme];
  return [
    { key: 'google', name: 'Google', labelColor: google.label, style: { backgroundColor: google.background, borderWidth: 1, borderColor: google.border }, icon: <FontAwesome name="google" size={18} color={google.label} /> },
    { key: 'kakao', name: '카카오', labelColor: brand.kakao.label, style: { backgroundColor: brand.kakao.background }, icon: <Icon name="message-circle" size={19} color={brand.kakao.icon} /> },
    { key: 'naver', name: '네이버', labelColor: brand.naver.label, style: { backgroundColor: brand.naver.background }, icon: <AppText weight="bold" style={{ fontSize: 20, lineHeight: 24, color: brand.naver.label }}>N</AppText> },
  ] as const;
}

export function AuthLoginScreen(): React.JSX.Element {
  const styles = useStyles();
  const providers = providerList(useColorSchemeName());
  const router = useRouter();
  const leave = () => router.canGoBack() ? router.back() : router.replace('/');

  return <Page contentStyle={styles.page}>
    <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={leave} style={styles.close}>
      <Icon name="x" size={22} />
    </Pressable>
    <View style={styles.brand}>
      <View style={styles.wordmarkRow}><Peeka slot="logo" size={48} style={styles.logoMark} /><AppText weight="extrabold" accessibilityRole="header" accessibilityLabel="peeka 로그인" style={styles.wordmark}>peeka</AppText></View>
      <AppText style={styles.tagline}>보던 드라마, 어디서든 이어서</AppText>
      <AppText weight="semibold" style={styles.tagline}>로그인하고 시작하기</AppText>
    </View>
    <View style={styles.actions}>
      {providers.map((provider) => <View key={provider.key} style={styles.providerItem}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${provider.name}로 로그인`} onPress={() => router.push('/auth/onboarding')}
          style={({ pressed }) => [styles.provider, provider.style, pressed && styles.pressed]}>
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

const useStyles = createThemedStyles((colors) => ({
  page: { maxWidth: 480, flexGrow: 1, paddingTop: 8, gap: 26 },
  close: { alignSelf: 'flex-end', width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  brand: { flexGrow: 1, minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 12 },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoMark: { borderRadius: 8, backgroundColor: colors.lavender },
  wordmark: { fontSize: 36, lineHeight: 44, letterSpacing: -1.6 },
  tagline: { fontSize: 16, lineHeight: 24, textAlign: 'center' },
  actions: { gap: 10 },
  providerItem: { gap: 6 },
  provider: { minHeight: 52, borderRadius: 9999, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 52 },
  pressed: { opacity: 0.8 },
  providerIcon: { position: 'absolute', left: 18, width: 24, alignItems: 'center' },
  providerLabel: { fontSize: 16 },
  providerNote: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  footer: { gap: 6 },
}));
