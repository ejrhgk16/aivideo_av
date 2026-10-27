import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { AppText, Button, Icon } from '@/components/ui';
import { colors } from '@/common/theme/tokens';
import type { DramaContent } from '@/features/drama/dramaContent';
import { EpisodePurchaseError, purchaseEpisode } from '@/features/economy/episodePurchase';
import { useUser } from '@/features/user/UserProvider';

type Episode = DramaContent['episodes'][number];

export function EpisodeUnlockDialog({ episode, dramaTitle, onClose, onCharge, onPurchased }: {
  episode: Episode | null;
  dramaTitle: string;
  onClose: () => void;
  onCharge: () => void;
  onPurchased: (episode: Episode) => void;
}) {
  const [displayedEpisode, setDisplayedEpisode] = useState(episode);
  // Keep the content visible while the modal finishes its closing animation.
  if (episode !== null && episode !== displayedEpisode) {
    setDisplayedEpisode(episode);
  }
  const { user, points, setPoints } = useUser();
  const inFlight = useRef(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const canPurchase = user !== null && points !== null
    && episode !== null && episode.pricePoints <= points;
  const amount = points === null ? '—' : points.toLocaleString('ko-KR');
  const pointsDescription = points === null ? '로그인 후 포인트를 확인할 수 있어요'
    : `사용 가능한 포인트는 ${amount} P예요`;

  useEffect(() => { setPurchaseError(null); }, [episode]);

  const close = () => {
    if (!inFlight.current) onClose();
  };

  const purchase = async () => {
    if (!canPurchase || !user || !episode || inFlight.current) return;
    const selectedEpisode = episode;
    inFlight.current = true;
    setPurchasing(true);
    setPurchaseError(null);
    let result;
    try {
      result = await purchaseEpisode(user.uuid, selectedEpisode.uuid);
    } catch (error) {
      setPurchaseError(error instanceof EpisodePurchaseError
        && error.errorCode === 'POINT_INSUFFICIENT_BALANCE'
        ? '포인트가 부족해요. 포인트 충전 후 다시 시도해 주세요.'
        : '회차를 구매하지 못했어요. 다시 시도해 주세요.');
      return;
    } finally {
      inFlight.current = false;
      setPurchasing(false);
    }
    setPoints(result.availablePoints);
    onClose();
    onPurchased(selectedEpisode);
  };

  return (
    <Modal transparent visible={episode !== null} animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.dialog} accessibilityRole="alert" accessibilityLabel="회차 열기">
          <Pressable style={styles.close} accessibilityRole="button" accessibilityLabel="팝업 닫기" disabled={purchasing} onPress={close}>
            <Icon name="x" size={20} color={colors.muted} />
          </Pressable>
          <View style={styles.lockIcon}><Icon name="lock" size={25} color={colors.accent} /></View>
          <AppText weight="bold" style={styles.title}>다음 이야기가 기다려요</AppText>
          <AppText style={styles.subtitle}>{dramaTitle} · {displayedEpisode?.episodeNumber}화</AppText>
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <AppText style={styles.summaryLabel}>이번 회차</AppText>
              <AppText weight="semibold" style={styles.summaryValue}>{displayedEpisode?.pricePoints} P</AppText>
            </View>
            <View style={styles.summaryRow}>
              <AppText style={styles.summaryLabel}>내 포인트</AppText>
              <AppText weight="semibold" style={styles.summaryValue}>{amount} P</AppText>
            </View>
          </View>
          <AppText style={styles.notice}>{canPurchase ? '보유 포인트로 바로 구매할 수 있어요.' : pointsDescription}</AppText>
          {purchaseError ? <AppText accessibilityRole="alert" style={styles.error}>{purchaseError}</AppText> : null}
          <Button
            label={purchasing ? '구매 중…' : canPurchase ? '구매하기' : '포인트 충전하기'}
            disabled={purchasing}
            onPress={canPurchase ? () => { void purchase(); } : onCharge}
            style={styles.chargeButton}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="닫기" disabled={purchasing} onPress={close} style={styles.dismiss}>
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
  error: { color: colors.danger, textAlign: 'center', fontSize: 12, lineHeight: 19 },
  chargeButton: { width: '100%', minHeight: 48, marginTop: 2 },
  dismiss: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14 },
  dismissLabel: { color: colors.muted, fontSize: 13, lineHeight: 20 },
});
