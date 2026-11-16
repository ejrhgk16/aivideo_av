import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Button, Icon, Page } from '@/components/ui';
import { AuthLink, AuthNotice, AuthStatus } from '@/components/authUi';
import { colors } from '@/common/theme/tokens';

// Apple: white style (recommended on dark backgrounds). Google: dark theme. Kakao: yellow with black 85% label.
const providers = [
  { key: 'apple', name: 'Apple', labelColor: '#000000', icon: <FontAwesome name="apple" size={21} color="#000000" /> },
  { key: 'google', name: 'Google', labelColor: '#E3E3E3', icon: <FontAwesome name="google" size={18} color="#E3E3E3" /> },
  { key: 'kakao', name: '카카오', labelColor: '#000000D9', icon: <Icon name="message-circle" size={19} color="#000000" /> },
] as const;

// AUT-01 prototype: provider buttons only simulate a successful link; nothing is sent or stored.
// Layout follows the Vigloo reference: brand mark in the middle, sign-in buttons at the bottom.
export function AuthLoginScreen() {
  const router = useRouter();
  const [linked, setLinked] = useState<string | null>(null);
  const leave = () => router.canGoBack() ? router.back() : router.replace('/');

  return <Page contentStyle={styles.page}>
    <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={leave} style={styles.close}>
      <Icon name="x" size={22} />
    </Pressable>
    {linked ? <View style={styles.actions}>
      <AuthStatus icon="check-circle" title={`${linked} 계정으로 연결했어요 (시안)`}
        description="실제로 연결된 계정은 없어요. 실제 서비스에서는 포인트와 시청 기록을 계정으로 옮기고, 이미 쓰던 계정이면 합칠지 먼저 물어봐요." />
      <Button label="확인" onPress={leave} />
    </View> : <>
      <View style={styles.brand}>
        <AppText weight="bold" accessibilityRole="header" accessibilityLabel="AI DRAMA 로그인" style={styles.wordmark}>AI DRAMA</AppText>
        <AppText style={styles.tagline}>보던 드라마, 어디서든 이어서</AppText>
      </View>
      <View style={styles.actions}>
        {providers.map((provider) => <View key={provider.key} style={styles.providerItem}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${provider.name}로 로그인`} onPress={() => setLinked(provider.name)}
            style={({ pressed }) => [styles.provider, styles[provider.key], pressed && styles.pressed]}>
            <View style={styles.providerIcon}>{provider.icon}</View>
            <AppText weight="semibold" style={[styles.providerLabel, { color: provider.labelColor }]}>{provider.name}로 로그인</AppText>
          </Pressable>
          {provider.key === 'kakao' ? <AppText style={styles.providerNote}>카카오 로그인은 도입을 검토 중이에요.</AppText> : null}
        </View>)}
        <Button label="나중에 할게요" variant="ghost" onPress={leave} />
      </View>
    </>}
    <View style={styles.footer}>
      {linked ? null : <AuthLink prefix="처음이라면" label="시작하기" onPress={() => router.dismissTo('/auth/signup')} />}
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
  apple: { backgroundColor: '#FFFFFF' },
  google: { backgroundColor: '#131314', borderWidth: 1, borderColor: '#8E918F' },
  kakao: { backgroundColor: '#FEE500' },
  pressed: { opacity: 0.8 },
  providerIcon: { position: 'absolute', left: 18, width: 24, alignItems: 'center' },
  providerLabel: { fontSize: 16 },
  providerNote: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  footer: { gap: 6 },
});
