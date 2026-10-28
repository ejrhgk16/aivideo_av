import { Stack, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/common/theme/tokens';
import { UserProvider } from '@/features/user/UserProvider';
import { useUser } from '@/features/user/UserProvider';
import { SessionExpiredDialog } from '@/components/SessionExpiredDialog';

function AppNavigation() {
  const router = useRouter();
  const { sessionExpired, dismissSessionExpired } = useUser();
  return <View style={styles.root}>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="drama/[id]" />
      <Stack.Screen name="episode/[id]" />
      <Stack.Screen name="preview/[dramaId]/[videoId]" />
      <Stack.Screen name="points" />
      <Stack.Screen name="login" />
    </Stack>
    <SessionExpiredDialog
      visible={sessionExpired}
      onDismiss={dismissSessionExpired}
      onLogin={() => {
        dismissSessionExpired();
        router.push('/login');
      }}
    />
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
    <UserProvider>
      {!fontsLoaded && !fontError ? <View style={styles.loading}><ActivityIndicator color={colors.accent} /></View>
        : <AppNavigation />}
    </UserProvider>
  </SafeAreaProvider>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 16 },
});
