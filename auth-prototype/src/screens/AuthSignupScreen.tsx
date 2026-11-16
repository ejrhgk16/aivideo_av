import { useEffect, useRef, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { BackHandler, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText, Button, Icon, Page } from '@/components/ui';
import { AuthLink, AuthNotice, AuthStatus, keepAll } from '@/components/authUi';
import { colors, typography } from '@/common/theme/tokens';
import { checkBirthDate, GUARDIAN_CONSENT_AGE, kstToday } from '@/features/auth/authAge';

type ConsentKey = 'terms' | 'privacy';
type Consent = { key: ConsentKey; label: string; body: string[] };

// P0 asks only the two required items; optional push/marketing consent is not collected (FN-AUT-04).
const consents: Consent[] = [
  { key: 'terms', label: '이용약관', body: [
    '확정 전 약관이에요. 출시 전 법률 검토 후 바뀌어요.',
    '이 서비스는 AI로 생성한 영상과 음성이 포함된 드라마를 제공해요.',
  ] },
  { key: 'privacy', label: '개인정보 수집·이용', body: [
    '확정 전 문서예요. 출시 전 법률 검토 후 바뀌어요.',
    '수집 항목: 생년월일, 기기 정보(확정 전)',
    '이용 목적: 만 나이 확인, 연령별 시청 제한, 보호자 동의 필요 여부 확인',
    '보유 기간: 법률 검토 후 정해요.',
    '동의하지 않을 수 있지만, 그러면 서비스를 시작할 수 없어요.',
  ] },
];

const nowAvailable = ['무료 회차 보기', '찜하기', '시청 기록 저장'];
const afterConsent = ['포인트 충전', '포인트로 회차 열기', '광고 보고 포인트 받기'];

function CheckRow({ label, checked, onPress, strong }: { label: string; checked: boolean; onPress: () => void; strong?: boolean }) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} aria-checked={checked} onPress={onPress} style={styles.checkRow}>
    <View style={[styles.box, checked && styles.boxChecked]}>{checked ? <Icon name="check" size={16} color={colors.background} /> : null}</View>
    <AppText weight={strong ? 'semibold' : 'regular'} style={styles.checkLabel}>{label}</AppText>
  </Pressable>;
}

// AUT-02 + AUT-04 prototype: consent, birth date and the guardian request stay in this screen's state only.
export function AuthSignupScreen() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [agreed, setAgreed] = useState<Record<ConsentKey, boolean>>({ terms: false, privacy: false });
  const [viewing, setViewing] = useState<Consent | null>(null);
  const [birth, setBirth] = useState({ year: '', month: '', day: '' });
  const [attempted, setAttempted] = useState(false);
  const [guardianRequested, setGuardianRequested] = useState(false);
  const monthInput = useRef<TextInput>(null);
  const dayInput = useRef<TextInput>(null);

  const allAgreed = agreed.terms && agreed.privacy;
  const check = checkBirthDate(birth.year, birth.month, birth.day, kstToday(new Date()));
  const birthFilled = birth.year.length === 4 && !!birth.month && !!birth.day;
  const error = attempted && !check.ok ? check.error : null;
  const age = check.ok ? check.age : 0;
  const minor = age < GUARDIAN_CONSENT_AGE;
  const start = () => router.replace('/');

  const setPart = (part: keyof typeof birth, value: string, length: number, next?: TextInput | null) => {
    const digits = value.replace(/\D/g, '').slice(0, length);
    setBirth((previous) => ({ ...previous, [part]: digits }));
    if (digits.length === length) next?.focus();
  };
  const submitBirth = () => {
    setAttempted(true);
    if (check.ok) setStep(3);
  };

  // Step 3 has no way back: the age gate result must not be retried by editing the date.
  useEffect(() => {
    if (step !== 2) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { setStep(1); return true; });
    return () => subscription.remove();
  }, [step]);

  const title = step === 1 ? '약관에 동의해 주세요' : step === 2 ? '생년월일을 입력해 주세요'
    : minor ? '보호자 동의가 필요해요' : '시작할 준비가 됐어요';
  const description = step === 1 ? '필수 약관 2개에 모두 동의해야 시작할 수 있어요.'
    : step === 2 ? '만 나이로 볼 수 있는 작품을 정해요. 나중에 바꾸기 어려우니 정확히 입력해 주세요.'
      : minor ? `만 ${GUARDIAN_CONSENT_AGE}세 미만은 보호자가 동의해야 모든 기능을 쓸 수 있어요. 동의 전에도 무료 회차는 볼 수 있어요.`
        : `만 ${age}세로 확인했어요. 나이에 맞는 작품을 보여 드려요.`;

  return <Page contentStyle={styles.page}>
    <Stack.Screen options={{ gestureEnabled: step === 1 }} />
    <View style={styles.top}>
      {step === 2 ? <Pressable accessibilityRole="button" accessibilityLabel="이전" onPress={() => setStep(1)} style={styles.back}>
        <Icon name="arrow-left" size={20} />
        <AppText weight="semibold">이전</AppText>
      </Pressable> : <View />}
      <AppText weight="medium" accessibilityLabel={`3단계 중 ${step}단계`} style={styles.stepText}>{step}/3</AppText>
    </View>
    <View style={styles.progress}>
      {[1, 2, 3].map((item) => <View key={item} style={[styles.segment, item <= step && styles.segmentDone]} />)}
    </View>
    <View style={styles.heading}>
      <AppText weight="bold" accessibilityRole="header" style={styles.title}>{title}</AppText>
      <AppText style={styles.description}>{description}</AppText>
    </View>

    {step === 1 ? <View style={styles.section}>
      <View style={styles.card}>
        <CheckRow label="전체 동의" strong checked={allAgreed} onPress={() => setAgreed({ terms: !allAgreed, privacy: !allAgreed })} />
        <View style={styles.divider} />
        {consents.map((item) => <View key={item.key} style={styles.consentRow}>
          <View style={styles.consentLabel}>
            <CheckRow label={`${item.label} (필수)`} checked={agreed[item.key]}
              onPress={() => setAgreed((previous) => ({ ...previous, [item.key]: !previous[item.key] }))} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`${item.label} 보기`} onPress={() => setViewing(item)} style={styles.view}>
            <AppText style={styles.viewLabel}>보기</AppText>
          </Pressable>
        </View>)}
      </View>
      <Button label="다음" disabled={!allAgreed} onPress={() => setStep(2)} />
    </View> : null}

    {step === 2 ? <View style={styles.section}>
      <View style={styles.birthRow}>
        {([
          { part: 'year', label: '출생 연도', unit: '년', placeholder: 'YYYY', length: 4, next: monthInput },
          { part: 'month', label: '출생 월', unit: '월', placeholder: 'MM', length: 2, next: dayInput },
          { part: 'day', label: '출생 일', unit: '일', placeholder: 'DD', length: 2 },
        ] as const).map((field) => <View key={field.part} style={[styles.birthField, field.part === 'year' && styles.birthYear]}>
          <TextInput ref={field.part === 'month' ? monthInput : field.part === 'day' ? dayInput : undefined}
            accessibilityLabel={field.label} value={birth[field.part]} placeholder={field.placeholder} placeholderTextColor={colors.muted}
            keyboardType="number-pad" maxLength={field.length}
            returnKeyType={field.part === 'day' ? 'done' : 'next'} blurOnSubmit={field.part === 'day'}
            onChangeText={(value) => setPart(field.part, value, field.length, 'next' in field ? field.next.current : null)}
            onSubmitEditing={() => 'next' in field ? field.next.current?.focus() : submitBirth()}
            style={[styles.input, error && styles.inputError]} />
          <AppText style={styles.unit}>{field.unit}</AppText>
        </View>)}
      </View>
      <AppText accessibilityLiveRegion="polite" style={error ? styles.error : styles.hint}>
        {error ?? (check.ok ? `${birth.year}년 ${Number(birth.month)}월 ${Number(birth.day)}일로 입력했어요. 다음을 누르면 바꾸기 어려워요.`
          : '예: 2008년 5월 12일 → 2008 / 5 / 12')}
      </AppText>
      <Button label="다음" disabled={!birthFilled} onPress={submitBirth} />
    </View> : null}

    {step === 3 && !minor ? <View style={styles.section}>
      <View style={styles.doneIcon}><Icon name="check" size={30} color={colors.background} /></View>
      <Button label="시작하기" onPress={start} />
    </View> : null}

    {step === 3 && minor ? <View style={styles.section}>
      <View style={styles.card}>
        <AppText weight="semibold" style={styles.listTitle}>지금 할 수 있어요</AppText>
        {nowAvailable.map((item) => <View key={item} style={styles.listRow}>
          <Icon name="check" size={16} color={colors.accent} /><AppText style={styles.listText}>{item}</AppText>
        </View>)}
        <View style={styles.divider} />
        <AppText weight="semibold" style={styles.listTitle}>보호자 동의 후 열려요</AppText>
        {afterConsent.map((item) => <View key={item} style={styles.listRow}>
          <Icon name="lock" size={16} color={colors.muted} /><AppText style={[styles.listText, styles.locked]}>{item}</AppText>
        </View>)}
        <AppText style={styles.small}>보호자 동의 전에는 맞춤형 광고를 보여주지 않아요.</AppText>
      </View>
      {guardianRequested ? <AuthStatus icon="clock" title="보호자 동의를 기다리고 있어요"
        description="그동안 무료 회차는 볼 수 있어요. 보호자 확인 방법은 법률 검토 후 정해요. 시안이라 실제 요청은 보내지 않았어요." />
        : <Button label="보호자 동의 요청하기" onPress={() => setGuardianRequested(true)} />}
      <Button label="무료 시청으로 시작하기" variant={guardianRequested ? 'primary' : 'secondary'} onPress={start} />
    </View> : null}

    <View style={styles.footer}>
      {step < 3 ? <AuthLink prefix="이미 계정이 있나요?" label="로그인" onPress={() => router.push('/auth/login')} /> : null}
      <AuthNotice text="시안 화면이에요. 입력한 내용은 저장되거나 전송되지 않아요." />
    </View>

    <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <AppText weight="bold" accessibilityRole="header" style={styles.sheetTitle}>{viewing?.label}</AppText>
          {viewing?.body.map((line) => <AppText key={line} style={styles.sheetBody}>{line}</AppText>)}
          <Button label="닫기" variant="secondary" onPress={() => setViewing(null)} style={styles.sheetClose} />
        </View>
      </View>
    </Modal>
  </Page>;
}

const styles = StyleSheet.create({
  page: { maxWidth: 480, paddingTop: 8, gap: 22 },
  top: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8 },
  stepText: { color: colors.muted, fontSize: 13 },
  progress: { flexDirection: 'row', gap: 6, marginTop: -14 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.elevated },
  segmentDone: { backgroundColor: colors.accent },
  heading: { gap: 10 },
  title: { fontSize: 25, lineHeight: 34, letterSpacing: -0.7, ...keepAll },
  description: { color: '#A1ACBA', fontSize: 15, lineHeight: 23, ...keepAll },
  section: { gap: 14 },
  card: { borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 8 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 6 },
  checkRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  boxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkLabel: { flexShrink: 1, fontSize: 15 },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  consentLabel: { flex: 1 },
  view: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  viewLabel: { color: colors.muted, fontSize: 14, textDecorationLine: 'underline' },
  birthRow: { flexDirection: 'row', gap: 10 },
  birthField: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  birthYear: { flex: 1.5 },
  input: { flex: 1, minWidth: 0, minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    color: colors.text, fontFamily: typography.medium, fontSize: 18, textAlign: 'center', paddingHorizontal: 8 },
  inputError: { borderColor: colors.danger },
  unit: { color: '#A1ACBA', fontSize: 15 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  doneIcon: { alignSelf: 'center', width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
  listTitle: { fontSize: 14, marginTop: 8, marginBottom: 2 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 32 },
  listText: { fontSize: 15 },
  locked: { color: '#A1ACBA' },
  small: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 6 },
  footer: { gap: 6 },
  backdrop: { flex: 1, padding: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000B8' },
  sheet: { width: '100%', maxWidth: 420, gap: 10, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#30363F', padding: 22 },
  sheetTitle: { fontSize: 20, lineHeight: 28 },
  sheetBody: { color: '#C4CAD3', fontSize: 14, lineHeight: 22 },
  sheetClose: { marginTop: 8 },
});
