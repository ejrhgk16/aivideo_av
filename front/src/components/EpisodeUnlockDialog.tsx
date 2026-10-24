import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { AppText, Button, Icon } from '@/components/ui';
import { colors } from '@/common/theme/tokens';
import type { DramaContent } from '@/features/drama/dramaContent';

type Episode = DramaContent['episodes'][number];

export function EpisodeUnlockDialog({ episode, dramaTitle, onClose, onCharge }: {
  episode: Episode | null;
  dramaTitle: string;
  onClose: () => void;
  onCharge: () => void;
}) {
  return (
    <Modal transparent visible={episode !== null} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.dialog} accessibilityRole="alert" accessibilityLabel="회차 열기">
          <Pressable style={styles.close} accessibilityRole="button" accessibilityLabel="팝업 닫기" onPress={onClose}>
            <Icon name="x" size={20} color={colors.muted} />
          </Pressable>
          <View style={styles.lockIcon}><Icon name="lock" size={25} color={colors.accent} /></View>
          <AppText weight="bold" style={styles.title}>다음 이야기가 기다려요</AppText>
          <AppText style={styles.subtitle}>{dramaTitle} · {episode?.episodeNumber}화</AppText>
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <AppText style={styles.summaryLabel}>이번 회차</AppText>
              <AppText weight="semibold" style={styles.summaryValue}>{episode?.pricePoints} P</AppText>
            </View>
            <View style={styles.summaryRow}>
              <AppText style={styles.summaryLabel}>내 포인트</AppText>
              <AppText weight="semibold" style={styles.summaryValue}>— P</AppText>
            </View>
          </View>
          <AppText style={styles.notice}>포인트 정보를 확인할 수 없어요. 충전 화면에서 포인트 기능을 확인해 주세요.</AppText>
          <Button label="포인트 충전하기" onPress={onCharge} style={styles.chargeButton} />
          <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} style={styles.dismiss}>
            <AppText weight="medium" style={styles.dismissLabel}>닫기</AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22, backgroundColor: '#000B' },
  dialog: { width: '100%', maxWidth: 420, alignItems: 'center', gap: 15, padding: 28, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 22, borderCurve: 'continuous' },
  close: { position: 'absolute', top: 13, right: 13, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  lockIcon: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: '#CBF46A18', borderRadius: 28, marginTop: 6 },
  title: { color: colors.text, textAlign: 'center', fontSize: 21, lineHeight: 29 },
  subtitle: { color: colors.muted, textAlign: 'center', fontSize: 13, lineHeight: 20 },
  summary: { width: '100%', gap: 12, padding: 16, marginTop: 3, backgroundColor: colors.background, borderRadius: 13 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  summaryValue: { color: colors.text, fontSize: 14, lineHeight: 20 },
  notice: { color: colors.muted, textAlign: 'center', fontSize: 12, lineHeight: 19 },
  chargeButton: { width: '100%', minHeight: 48, marginTop: 2 },
  dismiss: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14 },
  dismissLabel: { color: colors.muted, fontSize: 13, lineHeight: 20 },
});
