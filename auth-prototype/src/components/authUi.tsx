import { Platform, Pressable, StyleSheet, View, type TextStyle } from 'react-native';
import { AppText, Icon, type IconName } from '@/components/ui';
import { colors } from '@/common/theme/tokens';

/** Browsers wrap Hangul between syllables by default; keep words whole (react-native-web forwards wordBreak). */
export const keepAll = (Platform.OS === 'web' ? { wordBreak: 'keep-all' } : {}) as TextStyle;

/** Small line telling reviewers the auth screens are a mock-up. */
export function AuthNotice({ text }: { text: string }) {
  return <View style={styles.notice}>
    <Icon name="info" size={14} color={colors.muted} />
    <AppText style={styles.noticeText}>{text}</AppText>
  </View>;
}

export function AuthLink({ prefix, label, onPress }: { prefix?: string; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="link" accessibilityLabel={prefix ? `${prefix} ${label}` : label} onPress={onPress} style={styles.link}>
    {prefix ? <AppText style={styles.linkPrefix}>{prefix}</AppText> : null}
    <AppText weight="semibold" style={styles.linkLabel}>{label}</AppText>
  </Pressable>;
}

/** Outcome card that screen readers announce when it appears. */
export function AuthStatus({ icon, title, description }: { icon: IconName; title: string; description: string }) {
  return <View accessibilityLiveRegion="polite" style={styles.status}>
    <View style={styles.statusIcon}><Icon name={icon} size={22} color={colors.accent} /></View>
    <AppText weight="bold" style={styles.statusTitle}>{title}</AppText>
    <AppText style={styles.statusDescription}>{description}</AppText>
  </View>;
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 6 },
  noticeText: { color: colors.muted, fontSize: 12, lineHeight: 18, flexShrink: 1 },
  link: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center', paddingHorizontal: 8 },
  linkPrefix: { color: colors.muted, fontSize: 14 },
  linkLabel: { color: colors.accent, fontSize: 14, textDecorationLine: 'underline' },
  status: { alignItems: 'center', gap: 8, padding: 22, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  statusIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2B3325', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statusTitle: { fontSize: 19, lineHeight: 27, textAlign: 'center', ...keepAll },
  statusDescription: { color: '#A1ACBA', fontSize: 14, lineHeight: 21, textAlign: 'center', ...keepAll },
});
