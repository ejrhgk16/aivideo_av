import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ExperienceProvider, useExperience } from '@/features/drama/ExperienceProvider';
import { AppText } from '@/components/ui';
import { colors } from '@/theme/tokens';

function AppNavigation() {
  const { ready, storageError } = useExperience();
  if (!ready) return <View style={styles.loading}><ActivityIndicator color={colors.accent} /><AppText>이야기를 준비하고 있어요</AppText></View>;
  return <View style={styles.root}>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="drama/[id]" />
      <Stack.Screen name="player/[id]" options={{ animation: 'fade' }} />
      <Stack.Screen name="wallet" />
    </Stack>
    {storageError ? <View accessibilityRole="alert" style={styles.storageNotice}><AppText style={styles.noticeText}>저장 공간을 사용할 수 없어 이번 실행에서만 기록이 유지돼요.</AppText></View> : null}
  </View>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Pretendard-Regular': require('../../assets/fonts/Pretendard-Regular.ttf'),
    'Pretendard-Medium': require('../../assets/fonts/Pretendard-Medium.ttf'),
    'Pretendard-SemiBold': require('../../assets/fonts/Pretendard-SemiBold.ttf'),
    'Pretendard-Bold': require('../../assets/fonts/Pretendard-Bold.ttf'),
  });
  return <SafeAreaProvider><StatusBar style="light" />
    {!fontsLoaded && !fontError ? <View style={styles.loading}><ActivityIndicator color={colors.accent} /></View>
      : <ExperienceProvider><AppNavigation /></ExperienceProvider>}
  </SafeAreaProvider>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 16 },
  storageNotice: { backgroundColor: colors.surface, padding: 12 },
  noticeText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
});
