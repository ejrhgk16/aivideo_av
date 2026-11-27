import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, View, type GestureResponderEvent } from 'react-native';
import { AppText, Button, Icon, isKeyboardPress, KEYBOARD_PRESS_GUARD_MS, Peeka } from '@/components/ui';
import { ApiError } from '@/common/http/api';
import { getErrorMessage } from '@/common/http/errorMessages';
import { createThemedStyles, useColors } from '@/common/theme/theme';
import { radius, spacing, textSizes } from '@/common/theme/tokens';
import type { DramaContent } from '@/features/drama/dramaContent';
import { purchaseEpisode } from '@/features/economy/episodePurchase';
import { useUser } from '@/features/user/UserProvider';

type Episode = DramaContent['episodes'][number];
type CloseAction = { kind: 'dismiss' } | { kind: 'purchase'; episode: Episode; version: number } | { kind: 'charge' };
type PopupDisplay = {
  title: string;
  subtitle: string;
  price: string;
  amount: string;
  amountAfter: string | null;
  canOpen: boolean;
  warning: string | null;
  notice: string | null;
  error: string | null;
  buttonLabel: string;
};

const formatPoints = (value: number) => `${value.toLocaleString('ko-KR')}P`;

export function EpisodeUnlockDialog({ episode, dramaTitle, onClose, onCharge, onPurchased }: {
  episode: Episode | null;
  dramaTitle: string;
  onClose: () => void;
  onCharge: () => void;
  onPurchased: (episode: Episode) => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  const { user, points, setPoints, sessionVersion, isCurrentSession, sessionExpired } = useUser();
  const inFlight = useRef(false);
  const purchaseRequest = useRef(0);
  const sessionExpiredRef = useRef(sessionExpired);
  sessionExpiredRef.current = sessionExpired;
  const closing = useRef(false);
  const mounted = useRef(true);
  const hiddenReady = useRef(false);
  const pendingAction = useRef<CloseAction | null>(null);
  const animation = useRef<ReturnType<typeof Animated.timing> | null>(null);
  const opacity = useRef(new Animated.Value(episode === null ? 0 : 1)).current;
  const previousEpisode = useRef(episode);
  const previousSessionVersion = useRef(sessionVersion);
  const openedAt = useRef(Date.now());
  const [modalVisible, setModalVisible] = useState(episode !== null);
  const [isClosing, setIsClosing] = useState(false);
  const [awaitingDismiss, setAwaitingDismiss] = useState(false);
  const [closingDisplay, setClosingDisplay] = useState<PopupDisplay | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const canPurchase = user !== null && points !== null
    && episode !== null && episode.pricePoints <= points;
  const episodeNumber = episode?.episodeNumber;
  const price = episode?.pricePoints ?? 0;
  const episodeTitle = episode?.title && episode.title !== `${episodeNumber}화` ? ` · ${episode.title}` : '';
  const liveDisplay: PopupDisplay = {
    title: `${episodeNumber}화 열기`,
    subtitle: `${dramaTitle}${episodeTitle}`,
    price: formatPoints(price),
    amount: points === null ? '—' : formatPoints(points),
    amountAfter: canPurchase ? formatPoints(points - price) : null,
    canOpen: canPurchase,
    // TODO(backend): 광고 보상 API가 생기면 포인트가 모자랄 때의 주 버튼을 "광고 보고 10P 받기"로 바꾼다.
    warning: user !== null && points !== null && !canPurchase
      ? `포인트가 ${formatPoints(price - points)} 모자라요. 충전하면 바로 열 수 있어요.` : null,
    notice: user === null ? '로그인 후 회차를 열 수 있어요.' : canPurchase ? '열기 버튼을 누를 때만 포인트를 사용해요.' : null,
    error: purchaseError,
    buttonLabel: purchasing ? '여는 중…' : user === null ? '로그인하기'
      : canPurchase ? `${formatPoints(price)}로 ${episodeNumber}화 열기` : '포인트 충전하기',
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
    if (action.kind === 'purchase' && isCurrentSession(action.version)) onPurchased(action.episode);
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
      openedAt.current = Date.now();
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
    if (previousSessionVersion.current === sessionVersion) return;
    previousSessionVersion.current = sessionVersion;
    purchaseRequest.current += 1;
    inFlight.current = false;
    setPurchaseError(null);
    setPurchasing(false);
    if (pendingAction.current?.kind === 'purchase') {
      pendingAction.current = null;
      hiddenReady.current = false;
      closing.current = false;
      animation.current?.stop();
      opacity.stopAnimation();
      setIsClosing(false);
      setAwaitingDismiss(false);
      setClosingDisplay(null);
      setModalVisible(episode !== null);
    }
  }, [sessionVersion, episode, opacity]);

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
    const version = sessionVersion;
    const requestId = ++purchaseRequest.current;
    inFlight.current = true;
    setPurchasing(true);
    setPurchaseError(null);
    latestDisplay.current = { ...latestDisplay.current, error: null, buttonLabel: '여는 중…' };
    try {
      const result = await purchaseEpisode(selectedEpisode.uuid);
      if (!mounted.current || !isCurrentSession(version) || requestId !== purchaseRequest.current) return;
      beginClose({ kind: 'purchase', episode: selectedEpisode, version });
      setPoints(result.availablePoints);
    } catch (error) {
      const sessionExpiry = sessionExpiredRef.current && error instanceof ApiError
        && error.status === 401 && error.errorCode === 'AUTH_INVALID_TOKEN';
      if (mounted.current && isCurrentSession(version) && requestId === purchaseRequest.current && !sessionExpiry) {
        setPurchaseError(getErrorMessage(error));
      }
    } finally {
      if (mounted.current && requestId === purchaseRequest.current) {
        inFlight.current = false;
        setPurchasing(false);
      }
    }
  };

  const pressPrimary = (event: GestureResponderEvent) => {
    // 창을 연 Enter가 그대로 포인트를 쓰지 않게, 창이 열린 직후의 키보드 입력은 버린다.
    if (isKeyboardPress(event) && Date.now() - openedAt.current < KEYBOARD_PRESS_GUARD_MS) return;
    if (canPurchase) void purchase();
    else beginClose({ kind: 'charge' });
  };

  return (
    <Modal transparent visible={modalVisible} animationType="none" onShow={onShow}
      onDismiss={Platform.OS === 'android' ? undefined : completeDismiss}
      onRequestClose={close} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <View style={styles.dialog} accessibilityRole="alert" accessibilityLabel={display.title}>
          <Pressable style={styles.close} accessibilityRole="button" accessibilityLabel="닫기" disabled={purchasing || isClosing} onPress={close}>
            <Icon name="x" size={20} color={colors.muted} />
          </Pressable>
          <Peeka slot={display.canOpen ? 'loading' : 'locked'} size={88} />
          <View style={styles.heading}>
            <AppText weight="bold" accessibilityRole="header" style={styles.title}>{display.title}</AppText>
            <AppText style={styles.subtitle}>{display.subtitle}</AppText>
          </View>
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <AppText style={styles.summaryLabel}>이번 회차</AppText>
              <AppText weight="semibold" style={styles.summaryValue}>{display.price}</AppText>
            </View>
            <View style={styles.summaryRow}>
              <AppText style={styles.summaryLabel}>내 포인트</AppText>
              <AppText weight="semibold" style={styles.summaryValue}>{display.amount}</AppText>
            </View>
            {display.amountAfter !== null ? <View style={[styles.summaryRow, styles.summaryTotal]}>
              <AppText style={styles.summaryLabel}>사용 후 잔액</AppText>
              <AppText weight="bold" style={styles.summaryValue}>{display.amountAfter}</AppText>
            </View> : null}
          </View>
          {display.warning ? <View style={styles.warning} accessibilityLiveRegion="polite">
            <Icon name="alert-circle" size={18} color={colors.danger} />
            <AppText weight="medium" style={styles.warningText}>{display.warning}</AppText>
          </View> : null}
          {display.error ? <AppText accessibilityRole="alert" style={styles.error}>{display.error}</AppText> : null}
          <Button label={display.buttonLabel} disabled={purchasing || isClosing} onPress={pressPrimary} style={styles.primary} />
          <View style={styles.fineprint}>
            {display.notice ? <AppText style={styles.notice}>{display.notice}</AppText> : null}
            <AppText style={styles.notice}>한 번 연 회차는 다시 볼 때 무료예요.</AppText>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const useStyles = createThemedStyles((colors) => ({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: colors.backdrop },
  dialog: { width: '100%', maxWidth: 420, alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, borderCurve: 'continuous' },
  close: { position: 'absolute', top: spacing.xs, right: spacing.xs, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  heading: { alignItems: 'center', gap: spacing.xxs },
  title: { color: colors.text, textAlign: 'center', ...textSizes.heading24 },
  subtitle: { color: colors.muted, textAlign: 'center', ...textSizes.label14 },
  summary: { width: '100%', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.background, borderRadius: radius.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryTotal: { paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  summaryLabel: { color: colors.muted, ...textSizes.label14 },
  summaryValue: { color: colors.text, ...textSizes.label14 },
  warning: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, backgroundColor: colors.warn, borderRadius: radius.md },
  warningText: { flex: 1, color: colors.text, ...textSizes.label14 },
  error: { color: colors.danger, textAlign: 'center', ...textSizes.caption12 },
  primary: { alignSelf: 'stretch' },
  fineprint: { alignItems: 'center', gap: spacing.xxs },
  notice: { color: colors.muted, textAlign: 'center', ...textSizes.caption12 },
}));
