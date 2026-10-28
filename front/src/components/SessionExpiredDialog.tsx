import { Modal, StyleSheet, View } from 'react-native';
import { AppText, Button } from '@/components/ui';
import { colors } from '@/common/theme/tokens';

export function SessionExpiredDialog({ visible, onDismiss, onLogin }: {
  visible: boolean;
  onDismiss: () => void;
  onLogin: () => void;
}) {
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
    <View style={styles.backdrop}>
      <View style={styles.dialog} accessibilityRole="alert">
        <AppText weight="bold" style={styles.title}>로그인이 만료됐어요</AppText>
        <AppText style={styles.message}>다시 로그인해 주세요.</AppText>
        <View style={styles.actions}>
          <Button label="닫기" variant="secondary" onPress={onDismiss} style={styles.button} />
          <Button label="로그인" onPress={onLogin} style={styles.button} />
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22, backgroundColor: '#000B' },
  dialog: { width: '100%', maxWidth: 420, gap: 14, padding: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, borderCurve: 'continuous' },
  title: { color: colors.text, fontSize: 19, lineHeight: 27 },
  message: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 3 },
  button: { minWidth: 92 },
});
