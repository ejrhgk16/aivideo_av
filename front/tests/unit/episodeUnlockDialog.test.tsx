import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Animated, Modal, Platform } from 'react-native';
import { Image } from 'expo-image';
import { ApiError } from '@/common/http/api';
import { getErrorMessage } from '@/common/http/errorMessages';
import type { DramaContent } from '@/features/drama/dramaContent';
import type { EpisodePurchaseResponse } from '@/features/economy/economyResponses';
import { purchaseEpisode } from '@/features/economy/episodePurchase';
import { useUser } from '@/features/user/UserProvider';
import { EpisodeUnlockDialog } from '@/components/EpisodeUnlockDialog';

jest.mock('@/features/economy/episodePurchase', () => ({ purchaseEpisode: jest.fn() }));
jest.mock('@/common/http/errorMessages', () => ({ getErrorMessage: jest.fn(() => '요청에 실패했어요.') }));
jest.mock('@/features/user/UserProvider', () => ({ useUser: jest.fn() }));

type Episode = DramaContent['episodes'][number];
type Session = ReturnType<typeof useUser>;
type AnimationCallback = (result: { finished: boolean }) => void;

const episode: Episode = {
  uuid: 'episode-9', episodeNumber: 9, title: '9화', synopsis: null,
  durationMs: 60_000, videoUuid: 'video-9', isSaved: false,
  pricePoints: 50, isUnlocked: false, image: null, watchProgress: null,
};

const animations: AnimationCallback[] = [];
let session: Session;

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    user: { uuid: 'user-1', displayName: null, accountType: 'MEMBER' },
    points: 120,
    accessToken: 'token-1',
    isRestoring: false,
    restoreError: null,
    sessionExpired: false,
    sessionVersion: 0,
    subtitlesEnabled: true,
    preferredSubtitleLanguage: 'ko',
    autoplayNext: false,
    setUser: jest.fn(),
    setPoints: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    dismissSessionExpired: jest.fn(),
    isCurrentSession: (version) => version === 0,
    setSubtitlesEnabled: jest.fn(),
    setPreferredSubtitleLanguage: jest.fn(),
    setAutoplayNext: jest.fn(),
    ...overrides,
  };
}

const mockedPurchase = jest.mocked(purchaseEpisode);
const mockedUseUser = jest.mocked(useUser);
const mockedGetErrorMessage = jest.mocked(getErrorMessage);

function modal() {
  // Modal callbacks are native boundaries; this type query is only used to fire those callbacks.
  return screen.UNSAFE_getByType(Modal);
}

function finishAnimation(finished = true) {
  const callback = animations.shift();
  if (!callback) throw new Error('Expected an Animated.timing callback');
  act(() => callback({ finished }));
}

function renderDialog(props: Partial<React.ComponentProps<typeof EpisodeUnlockDialog>> = {}) {
  const callbacks = {
    onClose: jest.fn(),
    onCharge: jest.fn(),
    onPurchased: jest.fn(),
  };
  const view = render(
    <EpisodeUnlockDialog episode={episode} dramaTitle="작품 A" {...callbacks} {...props} />,
  );
  return { ...view, ...callbacks };
}

function setPlatform(value: 'ios' | 'android' | 'web') {
  const original = Object.getOwnPropertyDescriptor(Platform, 'OS');
  Object.defineProperty(Platform, 'OS', { configurable: true, value });
  return () => {
    if (original) Object.defineProperty(Platform, 'OS', original);
  };
}

beforeEach(() => {
  animations.length = 0;
  session = makeSession();
  mockedUseUser.mockReturnValue(session);
  mockedPurchase.mockReset();
  mockedPurchase.mockResolvedValue({
    episodeUuid: episode.uuid,
    entitlementUuid: 'entitlement-9',
    chargedPoints: 50,
    availablePoints: 70,
  });
  mockedGetErrorMessage.mockReturnValue('요청에 실패했어요.');
  jest.spyOn(Animated, 'timing').mockImplementation((_value, _config) => ({
    start: (callback?: AnimationCallback) => { if (callback) animations.push(callback); },
    stop: jest.fn(),
  } as unknown as Animated.CompositeAnimation));
});

test('dismiss keeps the selected episode visible until fade and native dismissal finish without purchasing', () => {
  const restorePlatform = setPlatform('ios');
  try {
    const dialog = renderDialog();
    const nativeModal = modal();
    fireEvent(nativeModal, 'show');
    finishAnimation();
    fireEvent.press(screen.getByRole('button', { name: '닫기' }));
    fireEvent(nativeModal, 'requestClose');
    dialog.rerender(
      <EpisodeUnlockDialog episode={null} dramaTitle="작품 A" onClose={dialog.onClose}
        onCharge={dialog.onCharge} onPurchased={dialog.onPurchased} />,
    );

    expect(screen.getByText('9화 열기')).toBeOnTheScreen();
    expect(screen.getByText('50P')).toBeOnTheScreen();
    expect(screen.getByText('120P')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '50P로 9화 열기' })).toBeDisabled();
    expect(dialog.onClose).not.toHaveBeenCalled();
    expect(mockedPurchase).not.toHaveBeenCalled();

    fireEvent(nativeModal, 'dismiss');
    expect(dialog.onClose).not.toHaveBeenCalled();
    finishAnimation();
    expect(dialog.onClose).not.toHaveBeenCalled();
    fireEvent(nativeModal, 'dismiss');
    fireEvent(nativeModal, 'dismiss');
    expect(dialog.onClose).toHaveBeenCalledTimes(1);
    expect(dialog.onPurchased).not.toHaveBeenCalled();
  } finally {
    restorePlatform();
  }
});

test('purchase updates points once but waits for fade and iOS dismissal before onPurchased', async () => {
  const restorePlatform = setPlatform('ios');
  try {
    const dialog = renderDialog();
    const nativeModal = modal();
    fireEvent(nativeModal, 'show');
    finishAnimation();
    const purchaseButton = screen.getByRole('button', { name: '50P로 9화 열기' });
    fireEvent.press(purchaseButton);
    fireEvent.press(purchaseButton);
    expect(mockedPurchase).toHaveBeenCalledTimes(1);

    await act(async () => { await Promise.resolve(); });
    expect(session.setPoints).toHaveBeenCalledWith(70);
    expect(dialog.onPurchased).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '여는 중…' })).toBeDisabled();
    expect(screen.getByText('열기 버튼을 누를 때만 포인트를 사용해요.')).toBeOnTheScreen();

    fireEvent(nativeModal, 'dismiss');
    expect(dialog.onPurchased).not.toHaveBeenCalled();
    finishAnimation();
    expect(dialog.onPurchased).not.toHaveBeenCalled();
    fireEvent(nativeModal, 'dismiss');
    fireEvent(nativeModal, 'dismiss');
    expect(dialog.onClose).toHaveBeenCalledTimes(1);
    expect(dialog.onPurchased).toHaveBeenCalledTimes(1);
    expect(dialog.onPurchased).toHaveBeenCalledWith(episode);
  } finally {
    restorePlatform();
  }
});

test('purchase error stays during dismissal and a later episode opens with fresh state', async () => {
  const restorePlatform = setPlatform('ios');
  try {
    mockedPurchase.mockRejectedValueOnce(new Error('offline'));
    const dialog = renderDialog();
    const nativeModal = modal();
    fireEvent(nativeModal, 'show');
    finishAnimation();
    fireEvent.press(screen.getByRole('button', { name: '50P로 9화 열기' }));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText('요청에 실패했어요.')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: '닫기' }));
    dialog.rerender(
      <EpisodeUnlockDialog episode={null} dramaTitle="작품 A" onClose={dialog.onClose}
        onCharge={dialog.onCharge} onPurchased={dialog.onPurchased} />,
    );
    expect(screen.getByText('요청에 실패했어요.')).toBeOnTheScreen();
    finishAnimation();
    fireEvent(nativeModal, 'dismiss');

    const nextEpisode = { ...episode, uuid: 'episode-10', episodeNumber: 10, pricePoints: 130 };
    dialog.rerender(
      <EpisodeUnlockDialog episode={nextEpisode} dramaTitle="작품 A" onClose={dialog.onClose}
        onCharge={dialog.onCharge} onPurchased={dialog.onPurchased} />,
    );
    expect(screen.getByText('10화 열기')).toBeOnTheScreen();
    expect(screen.queryByText('요청에 실패했어요.')).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '포인트 충전하기' })).toBeOnTheScreen();
    expect(dialog.onPurchased).not.toHaveBeenCalled();
  } finally {
    restorePlatform();
  }
});

test('Android completes charge after hidden commit and an interrupted fade does not dismiss', () => {
  const restorePlatform = setPlatform('android');
  try {
    const dialog = renderDialog({ episode: { ...episode, pricePoints: 200 } });
    const nativeModal = modal();
    fireEvent(nativeModal, 'show');
    finishAnimation();
    fireEvent.press(screen.getByRole('button', { name: '포인트 충전하기' }));
    expect(dialog.onCharge).not.toHaveBeenCalled();
    finishAnimation();
    expect(dialog.onClose).toHaveBeenCalledTimes(1);
    expect(dialog.onCharge).toHaveBeenCalledTimes(1);
    expect(nativeModal.props.onDismiss).toBeUndefined();

    const interrupted = renderDialog();
    const interruptedModal = interrupted.UNSAFE_getByType(Modal);
    fireEvent(interruptedModal, 'show');
    finishAnimation();
    fireEvent.press(interrupted.getByRole('button', { name: '닫기' }));
    finishAnimation(false);
    expect(interrupted.onClose).not.toHaveBeenCalled();
    expect(interrupted.onCharge).not.toHaveBeenCalled();
  } finally {
    restorePlatform();
  }
});

test('anonymous users are offered login and do not call the purchase API', () => {
  const restorePlatform = setPlatform('web');
  try {
    session = makeSession({ user: null, points: null });
    mockedUseUser.mockReturnValue(session);
    const dialog = renderDialog();
    const nativeModal = modal();
    expect(screen.getByText('로그인 후 회차를 열 수 있어요.')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: '로그인하기' }));
    finishAnimation();
    fireEvent(nativeModal, 'dismiss');
    expect(dialog.onCharge).toHaveBeenCalledTimes(1);
    expect(mockedPurchase).not.toHaveBeenCalled();
  } finally {
    restorePlatform();
  }
});

test('session change ignores an old purchase and permits a purchase in the new session', async () => {
  const restorePlatform = setPlatform('web');
  try {
    let resolvePurchase!: (value: EpisodePurchaseResponse) => void;
    mockedPurchase.mockReturnValueOnce(new Promise((resolve) => { resolvePurchase = resolve; }));
    const dialog = renderDialog();
    fireEvent.press(screen.getByRole('button', { name: '50P로 9화 열기' }));
    session = makeSession({ sessionVersion: 1, isCurrentSession: (version) => version === 1 });
    mockedUseUser.mockReturnValue(session);
    dialog.rerender(
      <EpisodeUnlockDialog episode={episode} dramaTitle="작품 A" onClose={dialog.onClose}
        onCharge={dialog.onCharge} onPurchased={dialog.onPurchased} />,
    );
    await act(async () => {
      resolvePurchase({ episodeUuid: episode.uuid, entitlementUuid: 'entitlement-9', chargedPoints: 50, availablePoints: 70 });
      await Promise.resolve();
    });
    expect(session.setPoints).not.toHaveBeenCalled();
    expect(dialog.onPurchased).not.toHaveBeenCalled();

    mockedPurchase.mockResolvedValueOnce({
      episodeUuid: episode.uuid,
      entitlementUuid: 'entitlement-9',
      chargedPoints: 50,
      availablePoints: 80,
    });
    fireEvent.press(screen.getByRole('button', { name: '50P로 9화 열기' }));
    await act(async () => { await Promise.resolve(); });
    expect(session.setPoints).toHaveBeenCalledWith(80);
  } finally {
    restorePlatform();
  }
});

test('session change during purchase dismissal animation cancels navigation', async () => {
  const restorePlatform = setPlatform('web');
  try {
    const dialog = renderDialog();
    const nativeModal = modal();
    fireEvent.press(screen.getByRole('button', { name: '50P로 9화 열기' }));
    await act(async () => { await Promise.resolve(); });
    session = makeSession({ sessionVersion: 1, isCurrentSession: (version) => version === 1 });
    mockedUseUser.mockReturnValue(session);
    dialog.rerender(
      <EpisodeUnlockDialog episode={episode} dramaTitle="작품 A" onClose={dialog.onClose}
        onCharge={dialog.onCharge} onPurchased={dialog.onPurchased} />,
    );
    finishAnimation();
    fireEvent(nativeModal, 'dismiss');
    expect(dialog.onPurchased).not.toHaveBeenCalled();
    expect(dialog.onCharge).not.toHaveBeenCalled();
  } finally {
    restorePlatform();
  }
});

test('401 handled by session expiration is not shown as a purchase error', async () => {
  const restorePlatform = setPlatform('web');
  try {
    let rejectPurchase!: (error: Error) => void;
    mockedPurchase.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectPurchase = reject; }));
    const dialog = renderDialog();
    fireEvent.press(screen.getByRole('button', { name: '50P로 9화 열기' }));
    session = makeSession({ sessionExpired: true });
    mockedUseUser.mockReturnValue(session);
    dialog.rerender(
      <EpisodeUnlockDialog episode={episode} dramaTitle="작품 A" onClose={dialog.onClose}
        onCharge={dialog.onCharge} onPurchased={dialog.onPurchased} />,
    );
    await act(async () => { rejectPurchase(new ApiError(401, 'AUTH_INVALID_TOKEN')); await Promise.resolve(); });
    expect(screen.queryByText('요청에 실패했어요.')).not.toBeOnTheScreen();
    expect(dialog.onPurchased).not.toHaveBeenCalled();
  } finally {
    restorePlatform();
  }
});

function mascot() {
  // 마스코트는 장식이라 접근성 트리에서 숨긴다. 어떤 그림 파일인지는 Image의 source로만 확인할 수 있다.
  return JSON.stringify(screen.UNSAFE_getByType(Image).props.source);
}

test('enough points show the hatched chick, the balance after opening and one "{price}P로 N화 열기" button', () => {
  renderDialog({ episode: { ...episode, title: '마지막 인사' } });
  expect(screen.getByRole('header', { name: '9화 열기' })).toBeOnTheScreen();
  expect(screen.getByText('작품 A · 마지막 인사')).toBeOnTheScreen();
  expect(screen.getByText('사용 후 잔액')).toBeOnTheScreen();
  expect(screen.getByText('70P')).toBeOnTheScreen();
  expect(screen.getByText('한 번 연 회차는 다시 볼 때 무료예요.')).toBeOnTheScreen();
  expect(mascot()).toContain('loading.png');
  expect(screen.getAllByRole('button').map((button) => button.props.accessibilityLabel)).toEqual(['닫기', '50P로 9화 열기']);
});

test('short points show the egg, a warning with the missing amount and the charge button without balance after', () => {
  session = makeSession({ points: 30 });
  mockedUseUser.mockReturnValue(session);
  renderDialog();
  expect(mascot()).toContain('locked.png');
  expect(screen.getByText('포인트가 20P 모자라요. 충전하면 바로 열 수 있어요.')).toBeOnTheScreen();
  expect(screen.queryByText('사용 후 잔액')).not.toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '포인트 충전하기' })).toBeOnTheScreen();
});

test('keyboard presses within 0.8s of opening are ignored while touch presses are accepted at once', async () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
  try {
    renderDialog();
    const open = screen.getByRole('button', { name: '50P로 9화 열기' });
    now.mockReturnValue(1_799);
    fireEvent.press(open, { type: 'keyup' });
    fireEvent.press(open, { type: 'click', detail: 0 });
    expect(mockedPurchase).not.toHaveBeenCalled();

    now.mockReturnValue(1_800);
    fireEvent.press(open, { type: 'keyup' });
    expect(mockedPurchase).toHaveBeenCalledTimes(1);
    await act(async () => { await Promise.resolve(); });
  } finally {
    now.mockRestore();
  }

  mockedPurchase.mockClear();
  renderDialog();
  fireEvent.press(screen.getAllByRole('button', { name: '50P로 9화 열기' }).at(-1)!, { type: 'click', detail: 1 });
  expect(mockedPurchase).toHaveBeenCalledTimes(1);
  await act(async () => { await Promise.resolve(); });
});
