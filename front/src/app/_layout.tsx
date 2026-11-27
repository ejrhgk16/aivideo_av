import { Stack, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createThemedStyles, useColors, useColorSchemeName } from '@/common/theme/theme';
import { ThemeProvider } from '@/common/theme/ThemeProvider';
import { UserProvider } from '@/features/user/UserProvider';
import { useUser } from '@/features/user/UserProvider';
import { SessionExpiredDialog } from '@/components/SessionExpiredDialog';

function AppNavigation() {
  const router = useRouter();
  const { sessionExpired, dismissSessionExpired } = useUser();
  const colors = useColors();
  const styles = useStyles();
  return <View style={styles.root}>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="drama/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="episode/[id]" />
      <Stack.Screen name="preview/[dramaId]/[videoId]" />
      <Stack.Screen name="points" />
      <Stack.Screen name="login" />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/onboarding" />
    </Stack>
    <SessionExpiredDialog
      visible={sessionExpired}
      onDismiss={dismissSessionExpired}
      onLogin={() => {
        dismissSessionExpired();
        router.push('/auth/login');
      }}
    />
  </View>;
}

function ThemedRoot() {
  const colors = useColors();
  const styles = useStyles();
  const scheme = useColorSchemeName();
  const [fontsLoaded, fontError] = useFonts({
    'Pretendard-Regular': require('../../assets/fonts/Pretendard-Regular.ttf'),
    'Pretendard-Medium': require('../../assets/fonts/Pretendard-Medium.ttf'),
    'Pretendard-SemiBold': require('../../assets/fonts/Pretendard-SemiBold.ttf'),
    'Pretendard-Bold': require('../../assets/fonts/Pretendard-Bold.ttf'),
    'Pretendard-ExtraBold': require('../../assets/fonts/Pretendard-ExtraBold.ttf'),
  });
  return <SafeAreaProvider><StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    <UserProvider>
      {!fontsLoaded && !fontError ? <View style={styles.loading}><ActivityIndicator color={colors.accent} /></View>
        : <AppNavigation />}
    </UserProvider>
  </SafeAreaProvider>;
}

export default function RootLayout() {
  return <ThemeProvider><ThemedRoot /></ThemeProvider>;
}

const useStyles = createThemedStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 16 },
}));
