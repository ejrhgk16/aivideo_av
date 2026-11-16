import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { AppText, Button } from '@/components/ui';
import { AdminField } from '@/components/adminUi';
import { colors, typography } from '@/common/theme/tokens';
import { useAdminSession } from '@/features/admin/adminSession';

function validate(email: string, password: string) {
  const errors: { email?: string; password?: string } = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = '이메일 형식으로 입력해 주세요.';
  if (password.length < 8) errors.password = '비밀번호는 8자 이상 입력해 주세요.';
  return errors;
}

// The admin layout moves a signed-in reviewer to /admin, so this screen only records the sign-in.
export function AdminLoginScreen() {
  const { signIn } = useAdminSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [attempted, setAttempted] = useState(false);
  const emailInput = useRef<TextInput>(null);
  const passwordInput = useRef<TextInput>(null);
  const errors = attempted ? validate(email, password) : {};

  const submit = () => {
    setAttempted(true);
    const next = validate(email, password);
    if (next.email || next.password) (next.email ? emailInput : passwordInput).current?.focus();
    else signIn(email.trim());
  };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.center}>
    <View style={styles.card}>
      <AppText weight="bold" style={styles.brand}>AI DRAMA 관리자</AppText>
      <AppText weight="bold" accessibilityRole="header" style={styles.title}>관리자 로그인</AppText>
      <View style={styles.notice}>
        <View style={styles.badge}><AppText weight="semibold" style={styles.badgeText}>샘플</AppText></View>
        <AppText style={styles.noticeCopy}>시안 화면이에요. 이메일 형식과 8자 이상 비밀번호면 들어갈 수 있어요.</AppText>
      </View>
      <AdminField label="이메일" error={errors.email}>
        <TextInput ref={emailInput} autoFocus accessibilityLabel="이메일" value={email} onChangeText={setEmail} placeholder="operator@example.com"
          placeholderTextColor={colors.muted} keyboardType="email-address" autoComplete="email" autoCapitalize="none"
          returnKeyType="next" onSubmitEditing={() => passwordInput.current?.focus()} style={styles.input} />
      </AdminField>
      <AdminField label="비밀번호" error={errors.password}>
        <TextInput ref={passwordInput} accessibilityLabel="비밀번호" value={password} onChangeText={setPassword} secureTextEntry
          autoComplete="current-password" returnKeyType="go" blurOnSubmit={false} onSubmitEditing={submit} style={styles.input} />
      </AdminField>
      <Button label="로그인" onPress={submit} />
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 400, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 28, gap: 16 },
  brand: { fontSize: 15, color: colors.accent },
  title: { fontSize: 26, lineHeight: 34, letterSpacing: -0.7 },
  // Same palette as AdminShell's 샘플 데이터 banner (adminUi.tsx); change both together.
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#CBF46A40', backgroundColor: '#1C2416' },
  badge: { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, lineHeight: 18, color: colors.background },
  noticeCopy: { fontSize: 13, lineHeight: 20, color: '#C5D3A8', flexShrink: 1 },
  input: { minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
    color: colors.text, fontFamily: typography.regular, fontSize: 15, paddingHorizontal: 12, paddingVertical: 10 },
});
