import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { AppText, Button, Icon } from '@/components/ui';
import { colors } from '@/common/theme/tokens';
import type { DramaContent } from '@/features/drama/dramaContent';
import { EpisodePurchaseError, purchaseEpisode, type EpisodePurchaseResponse } from '@/features/economy/episodePurchase';
import { useUser } from '@/features/user/UserProvider';

type Episode = DramaContent['episodes'][number];
type CloseAction = { kind: 'dismiss' } | { kind: 'purchase'; episode: Episode } | { kind: 'charge' };
type PopupDisplay = {
  dramaTitle: string;
  episodeNumber: number | undefined;
  pricePoints: number | undefined;
  amount: string;
  notice: string;
  error: string | null;
  buttonLabel: string;
};

export function EpisodeUnlockDialog({ episode, dramaTitle, onClose, onCharge, onPurchased }: {
  episode: Episode | null;
  dramaTitle: string;
  onClose: () => void;
  onCharge: () => void;
  onPurchased: (episode: Episode) => void;
}) {
  const { user, points, setPoints } = useUser();
  const inFlight = useRef(false);
  const closing = useRef(false);
  const mounted = useRef(true);
  const hiddenReady = useRef(false);
  const pendingAction = useRef<CloseAction | null>(null);
  const animation = useRef<ReturnType<typeof Animated.timing> | null>(null);
  const opacity = useRef(new Animated.Value(episode === null ? 0 : 1)).current;
  const previousEpisode = useRef(episode);
  const [modalVisible, setModalVisible] = useState(episode !== null);
  const [isClosing, setIsClosing] = useState(false);
  const [awaitingDismiss, setAwaitingDismiss] = useState(false);
  const [closingDisplay, setClosingDisplay] = useState<PopupDisplay | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const canPurchase = user !== null && points !== null
    && episode !== null && episode.pricePoints <= points;
  const amount = points === null ? '—' : points.toLocaleString('ko-KR');
  const pointsDescription = points === null ? '로그인 후 포인트를 확인할 수 있어요'
    : `사용 가능한 포인트는 ${amount} P예요`;
  const liveDisplay: PopupDisplay = {
    dramaTitle,
    episodeNumber: episode?.episodeNumber,
    pricePoints: episode?.pricePoints,
    amount,
    notice: canPurchase ? '보유 포인트로 바로 구매할 수 있어요.' : pointsDescription,
    error: purchaseError,
    buttonLabel: purchasing ? '구매 중…' : canPurchase ? '구매하기' : '포인트 충전하기',
  };
  const latestDisplay = useRef(liveDisplay);
  if (!closing.current && episode !== null) latestDisplay.current = liveDisplay;
  const display = closingDisplay ?? latestDisplay.current;

  const completeDismiss = () => {
    if (!mounted.current || !hiddenReady.current || !pendingAction.current) return;
    const action = pendingAction.current;
    hiddenReady.current = false;
    pendingAction.current = null;
    setAwaitingDismiss(false);
    setClosingDisplay(null);
    onClose();
    if (action.kind === 'purchase') onPurchased(action.episode);
    if (action.kind === 'charge') onCharge();
  };

  const beginClose = (action: CloseAction, force = false) => {
    if (closing.current || inFlight.current && action.kind === 'dismiss' && !force) return;
    closing.current = true;
    hiddenReady.current = false;
    pendingAction.current = action;
    setClosingDisplay(latestDisplay.current);
    setIsClosing(true);
    animation.current?.stop();
    opacity.stopAnimation();
    animation.current = Animated.timing(opacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.current.start(({ finished }) => {
      if (!finished || !mounted.current || pendingAction.current !== action) return;
      hiddenReady.current = true;
      setModalVisible(false);
      setAwaitingDismiss(true);
    });
  };

  useEffect(() => {
    if (episode === null && previousEpisode.current !== null) beginClose({ kind: 'dismiss' }, true);
    if (episode !== null && previousEpisode.current === null) {
      closing.current = false;
      pendingAction.current = null;
      hiddenReady.current = false;
      setIsClosing(false);
      setClosingDisplay(null);
      setAwaitingDismiss(false);
      setPurchaseError(null);
      opacity.setValue(0);
      setModalVisible(true);
    }
    previousEpisode.current = episode;
  }, [episode]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pendingAction.current = null;
      animation.current?.stop();
      opacity.stopAnimation();
    };
  }, [opacity]);

  useEffect(() => {
    if (Platform.OS === 'android' && awaitingDismiss && !modalVisible) completeDismiss();
  }, [awaitingDismiss, modalVisible]);

  const onShow = () => {
    if (closing.current) return;
    opacity.setValue(0);
    animation.current?.stop();
    animation.current = Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.current.start(() => undefined);
  };

  const close = () => beginClose({ kind: 'dismiss' });

  const purchase = async () => {
    if (!canPurchase || !user || !episode || inFlight.current || closing.current) return;
    const selectedEpisode = episode;
    inFlight.current = true;
    setPurchasing(true);
    setPurchaseError(null);
    latestDisplay.current = { ...latestDisplay.current, error: null, buttonLabel: '구매 중…' };
    let result: EpisodePurchaseResponse;
    try {
      result = await purchaseEpisode(user.uuid, selectedEpisode.uuid);
    } catch (error) {
      setPurchaseError(error instanceof EpisodePurchaseError
        && error.errorCode === 'POINT_INSUFFICIENT_BALANCE'
        ? '포인트가 부족해요. 포인트 충전 후 다시 시도해 주세요.'
        : '회차를 구매하지 못했어요. 다시 시도해 주세요.');
      inFlight.current = false;
      setPurchasing(false);
      return;
    }
    beginClose({ kind: 'purchase', episode: selectedEpisode });
    setPoints(result.availablePoints);
    inFlight.current = false;
    setPurchasing(false);
  };

  return (
    <Modal transparent visible={modalVisible} animationType="none" onShow={onShow}
      onDismiss={Platform.OS === 'android' ? undefined : completeDismiss}
      onRequestClose={close} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <View style={styles.dialog} accessibilityRole="alert" accessibilityLabel="회차 열기">
          <Pressable style={styles.close} accessibilityRole="button" accessibilityLabel="팝업 닫기" disabled={purchasing || isClosing} onPress={close}>
            <Icon name="x" size={20} color={colors.muted} />
          </Pressable>
          <View style={styles.lockIcon}><Icon name="lock" size={25} color={colors.accent} /></View>
          <AppText weight="bold" style={styles.title}>다음 이야기가 기다려요</AppText>
          <AppText style={styles.subtitle}>{display.dramaTitle} · {display.episodeNumber}화</AppText>
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <AppText style={styles.summaryLabel}>이번 회차</AppText>
              <AppText weight="semibold" style={styles.summaryValue}>{display.pricePoints} P</AppText>
            </View>
            <View style={styles.summaryRow}>
              <AppText style={styles.summaryLabel}>내 포인트</AppText>
              <AppText weight="semibold" style={styles.summaryValue}>{display.amount} P</AppText>
            </View>
          </View>
          <AppText style={styles.notice}>{display.notice}</AppText>
          {display.error ? <AppText accessibilityRole="alert" style={styles.error}>{display.error}</AppText> : null}
          <Button
            label={display.buttonLabel}
            disabled={purchasing || isClosing}
            onPress={canPurchase ? () => { void purchase(); } : () => beginClose({ kind: 'charge' })}
            style={styles.chargeButton}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="닫기" disabled={purchasing || isClosing} onPress={close} style={styles.dismiss}>
            <AppText weight="medium" style={styles.dismissLabel}>닫기</AppText>
          </Pressable>
        </View>
      </Animated.View>
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
