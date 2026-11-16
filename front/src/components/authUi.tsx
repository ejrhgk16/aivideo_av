import { Platform, StyleSheet, View, type TextStyle } from 'react-native';
import { AppText, Icon, type IconName } from '@/components/ui';
import { colors } from '@/common/theme/tokens';

/** Keep Korean words together on web. */
export const keepAll = (Platform.OS === 'web' ? { wordBreak: 'keep-all' } : {}) as TextStyle;

export function AuthNotice({ text }: { text: string }): React.JSX.Element {
  return <View style={styles.notice}>
    <Icon name="info" size={14} color={colors.muted} />
    <AppText style={styles.noticeText}>{text}</AppText>
  </View>;
}

export function AuthStatus({ icon, title, description }: { icon: IconName; title: string; description: string }): React.JSX.Element {
  return <View accessibilityLiveRegion="polite" style={styles.status}>
    <View style={styles.statusIcon}><Icon name={icon} size={22} color={colors.accent} /></View>
    <AppText weight="bold" style={styles.statusTitle}>{title}</AppText>
    <AppText style={styles.statusDescription}>{description}</AppText>
  </View>;
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 6 },
  noticeText: { color: colors.muted, fontSize: 12, lineHeight: 18, flexShrink: 1 },
  status: { alignItems: 'center', gap: 8, padding: 22, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  statusIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2B3325', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statusTitle: { fontSize: 19, lineHeight: 27, textAlign: 'center', ...keepAll },
  statusDescription: { color: '#A1ACBA', fontSize: 14, lineHeight: 21, textAlign: 'center', ...keepAll },
});
