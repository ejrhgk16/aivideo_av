import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/common/theme/tokens';
import { useUser } from '@/features/user/UserProvider';
import { useLogin } from '@/features/user/useLogin';

export default function LoginRoute() {
  const { loginId = 'admin', password = 'admin' } = useLocalSearchParams<{ loginId?: string; password?: string }>();
  const { user } = useUser();
  const login = useLogin();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user !== null || started.current) return;
    started.current = true;
    if (typeof loginId !== 'string' || typeof password !== 'string') {
      setError('URL에 loginId와 password가 필요합니다.');
      return;
    }
    void login({ loginId, password }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : '로그인에 실패했습니다.');
    });
  }, [login, loginId, password, user]);

  if (user !== null) return <Redirect href="/" />;

  return <View style={styles.container}>
    {error === null ? <ActivityIndicator color={colors.accent} /> : null}
    <Text style={styles.message}>{error ?? '로그인 중입니다.'}</Text>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: colors.background },
  message: { color: colors.text },
});
