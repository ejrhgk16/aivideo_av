import React from 'react';
import { Modal, Text } from 'react-native';
import { act, fireEvent, screen, userEvent, within } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter, testRouter } from 'expo-router/testing-library';
import { getPointHistory, type PointHistoryItem, type PointHistoryPage } from '@/features/economy/pointHistory';
import { useUser, type User } from '@/features/user/UserProvider';
import { PointsScreen } from '@/screens/PointsScreen';

jest.mock('@/features/economy/pointHistory', () => ({ getPointHistory: jest.fn() }));
jest.mock('@/features/user/UserProvider', () => ({ useUser: jest.fn() }));

type Deferred<T> = { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const makeUser = (uuid: string): User => ({ uuid, displayName: null, accountType: 'MEMBER' });
const makeSession = (user: User | null, points: number | null, version: number, isRestoring = false): ReturnType<typeof useUser> => ({
  user, points, accessToken: null, isRestoring, restoreError: null,
  sessionExpired: false, sessionVersion: version, subtitlesEnabled: true, autoplayNext: false,
  setUser: jest.fn(), setPoints: jest.fn(), login: jest.fn(), logout: jest.fn(),
  dismissSessionExpired: jest.fn(), isCurrentSession: (candidate: number) => candidate === version,
  setSubtitlesEnabled: jest.fn(), setAutoplayNext: jest.fn(),
});

function renderPoints(initial: ReturnType<typeof useUser> = makeSession(makeUser('user-a'), 2000, 1), tab = 'history') {
  let setSession!: React.Dispatch<React.SetStateAction<ReturnType<typeof useUser>>>;
  function Route() {
    const [session, updateSession] = React.useState(initial);
    setSession = updateSession;
    jest.mocked(useUser).mockReturnValue(session);
    return <PointsScreen />;
  }
  const view = renderRouter({
    _layout: () => <Stack screenOptions={{ animation: 'none' }} />,
    index: Route,
    away: () => <Text>다른 화면</Text>,
    login: () => <Text>로그인 화면</Text>,
    account: () => <Text>계정 화면</Text>,
  }, { initialUrl: tab ? `/?tab=${tab}` : '/' });
  return { ...view, setSession: (next: ReturnType<typeof useUser>) => act(() => setSession(next)) };
}

function installRequests() {
  const requests: Deferred<PointHistoryPage>[] = [];
  const pages: number[] = [];
  jest.mocked(getPointHistory).mockImplementation((page = 1) => {
    const request = deferred<PointHistoryPage>(); requests.push(request); pages.push(page); return request.promise;
  });
  return { requests, pages };
}

const page = (items: PointHistoryItem[], pageNumber = 1, hasNext = false): PointHistoryPage => ({ items, page: pageNumber, hasNext });
const transaction = (uuid: string, transactionType: PointHistoryItem['transactionType'], amount: number, balanceAfter: number,
  episode: PointHistoryItem['episode'] = null, createdAt = '2026-11-03T18:04:00.000Z'): PointHistoryItem =>
  ({ uuid, transactionType, amount, balanceAfter, createdAt, episode });

test('charge tab exposes demo actions and sample prices without loading history; history route loads page one', async () => {
  const chargeRequests = installRequests();
  const charge = renderPoints(makeSession(makeUser('user-a'), 1234, 1), 'charge');
  expect(getPointHistory).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '광고 보고 포인트 받기' })).toBeOnTheScreen();
  expect(screen.getByText('광고 보상 체험 · 0/5회')).toBeOnTheScreen();
  expect(screen.getByText('필요한 만큼 충전해요')).toBeOnTheScreen();
  expect(screen.getByText('1,234 P')).toBeOnTheScreen();
  expect(screen.getByText('100 P')).toBeOnTheScreen();
  expect(screen.getByText('300 P')).toBeOnTheScreen();
  expect(screen.getByText('600 P')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '100 P 충전 체험' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '300 P 충전 체험' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '600 P 충전 체험' })).toBeOnTheScreen();
  expect(screen.getByText('₩1,100')).toBeOnTheScreen();
  expect(screen.getByText('₩3,300')).toBeOnTheScreen();
  expect(screen.getByText('₩6,600')).toBeOnTheScreen();
  expect(screen.queryByText('준비 중')).toBeNull();
  expect(screen.getByText('실제 결제되지 않으며 체험 포인트는 이 화면을 나가면 초기화돼요.')).toBeOnTheScreen();
  expect(chargeRequests.pages).toEqual([]);
  charge.unmount();

  const historyRequests = installRequests();
  const history = renderPoints(makeSession(makeUser('user-a'), 2000, 1), 'history');
  expect(historyRequests.pages).toEqual([1]);
  history.unmount();
});

test('ad reward cancel adds nothing and five confirmed rewards disable the action', async () => {
  const input = userEvent.setup();
  installRequests();
  const view = renderPoints(makeSession(makeUser('user-a'), 1234, 1), 'charge');

  await input.press(screen.getByRole('button', { name: '광고 보고 포인트 받기' }));
  expect(screen.getByText('광고 체험')).toBeOnTheScreen();
  await input.press(screen.getByRole('button', { name: '취소' }));
  expect(screen.getByText('1,234 P')).toBeOnTheScreen();
  expect(screen.getByText('광고 보상 체험 · 0/5회')).toBeOnTheScreen();

  for (let count = 1; count <= 5; count += 1) {
    await input.press(screen.getByRole('button', { name: '광고 보고 포인트 받기' }));
    await input.press(screen.getByRole('button', { name: '체험 완료' }));
    expect(screen.getByText(`${(1234 + count * 10).toLocaleString('ko-KR')} P`)).toBeOnTheScreen();
    expect(screen.getByText(`광고 보상 체험 · ${count}/5회`)).toBeOnTheScreen();
  }
  expect(screen.getByRole('button', { name: '광고 보고 포인트 받기' })).toBeDisabled();
  expect(screen.getAllByText('+10 P').length).toBeGreaterThanOrEqual(5);
  view.unmount();
});

test('each demo pack shows its example price, can be canceled, and can be purchased again', async () => {
  const input = userEvent.setup();
  installRequests();
  const view = renderPoints(makeSession(makeUser('user-a'), 1234, 1), 'charge');
  let balance = 1234;

  const packs = [
    { label: '100 P 충전 체험', points: 100, price: '₩1,100' },
    { label: '300 P 충전 체험', points: 300, price: '₩3,300' },
    { label: '600 P 충전 체험', points: 600, price: '₩6,600' },
  ];
  for (const pack of packs) {
    await input.press(screen.getByRole('button', { name: pack.label }));
    // React Native Modal is a native boundary; scope this assertion to its rendered subtree.
    const modal = within(screen.UNSAFE_getByType(Modal));
    expect(modal.getByText(pack.price)).toBeOnTheScreen();
    await input.press(screen.getByRole('button', { name: '취소' }));
    expect(screen.getByText(`${balance.toLocaleString('ko-KR')} P`)).toBeOnTheScreen();

    await input.press(screen.getByRole('button', { name: pack.label }));
    await input.press(screen.getByRole('button', { name: '체험 충전하기' }));
    balance += pack.points;
    expect(screen.getByText(`${balance.toLocaleString('ko-KR')} P`)).toBeOnTheScreen();
  }
  await input.press(screen.getByRole('button', { name: '100 P 충전 체험' }));
  await input.press(screen.getByRole('button', { name: '체험 충전하기' }));
  balance += 100;
  expect(screen.getByText(`${balance.toLocaleString('ko-KR')} P`)).toBeOnTheScreen();
  view.unmount();
});

test('confirming a charge twice from the same modal applies it once', async () => {
  const input = userEvent.setup();
  installRequests();
  const view = renderPoints(makeSession(makeUser('user-a'), 1234, 1), 'charge');
  await input.press(screen.getByRole('button', { name: '100 P 충전 체험' }));
  const confirm = screen.getByRole('button', { name: '체험 충전하기' });

  fireEvent.press(confirm);
  fireEvent.press(confirm);

  expect(screen.getByText('1,334 P')).toBeOnTheScreen();
  expect(screen.getAllByText('+100 P')).toHaveLength(1);
  view.unmount();
});

test('demo balance and rows stay local across tabs and remain separate from real history', async () => {
  const input = userEvent.setup();
  const requests = installRequests();
  const session = makeSession(makeUser('user-a'), 1234, 1);
  const view = renderPoints(session, 'charge');

  await input.press(screen.getByRole('button', { name: '광고 보고 포인트 받기' }));
  await input.press(screen.getByRole('button', { name: '체험 완료' }));
  await input.press(screen.getByRole('button', { name: '100 P 충전 체험' }));
  await input.press(screen.getByRole('button', { name: '체험 충전하기' }));
  expect(screen.getByText('1,344 P')).toBeOnTheScreen();

  await input.press(screen.getByRole('tab', { name: '이용 내역' }));
  expect(screen.getByText('체험 내역')).toBeOnTheScreen();
  expect(screen.getByText('실제 이용 내역')).toBeOnTheScreen();
  expect(screen.getByText('이용 내역을 불러오는 중이에요')).toBeOnTheScreen();
  await act(async () => {
    requests.requests[0].resolve(page([
      transaction('real-1', 'EPISODE_UNLOCK', -30, 970, { dramaTitle: '작품', episodeNumber: 1 }),
    ]));
    await requests.requests[0].promise;
  });
  expect(screen.getByText('작품 · 1화')).toBeOnTheScreen();
  expect(screen.getByText('거래 후 잔액 970 P')).toBeOnTheScreen();
  expect(screen.getByText('1,344 P')).toBeOnTheScreen();
  expect(session.setPoints).not.toHaveBeenCalled();
  expect(session.setUser).not.toHaveBeenCalled();

  view.setSession(makeSession(makeUser('user-a'), 9999, 1));
  expect(screen.getByText('1,344 P')).toBeOnTheScreen();
  expect(screen.getByText('거래 후 잔액 970 P')).toBeOnTheScreen();

  await input.press(screen.getByRole('tab', { name: '충전하기' }));
  expect(screen.getByText('1,344 P')).toBeOnTheScreen();
  expect(screen.getAllByText('체험 내역')).toHaveLength(1);
  view.unmount();
});

test('demo rows remain visible with actual history loading, failure and empty states', async () => {
  const input = userEvent.setup();
  const requests = installRequests();
  const view = renderPoints(makeSession(makeUser('user-a'), 1234, 1), 'charge');
  await input.press(screen.getByRole('button', { name: '광고 보고 포인트 받기' }));
  await input.press(screen.getByRole('button', { name: '체험 완료' }));
  await input.press(screen.getByRole('tab', { name: '이용 내역' }));
  expect(screen.getByText('체험 내역')).toBeOnTheScreen();
  expect(screen.getByText('이용 내역을 불러오는 중이에요')).toBeOnTheScreen();

  await act(async () => {
    requests.requests[0].reject(new Error('offline'));
    try { await requests.requests[0].promise; } catch {}
  });
  expect(screen.getByText('체험 내역')).toBeOnTheScreen();
  expect(screen.getByText('이용 내역을 불러오지 못했어요')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));
  expect(requests.pages).toEqual([1, 1]);
  await act(async () => {
    requests.requests[1].resolve(page([]));
    await requests.requests[1].promise;
  });
  expect(screen.getByText('체험 내역')).toBeOnTheScreen();
  expect(screen.getByText('포인트 이용 내역이 없어요')).toBeOnTheScreen();
  view.unmount();
});

test('demo survives tab and query changes, then resets on blur, unmount and account or session change', async () => {
  const input = userEvent.setup();
  installRequests();
  const view = renderPoints(makeSession(makeUser('user-a'), 1234, 1), 'charge');

  await input.press(screen.getByRole('button', { name: '광고 보고 포인트 받기' }));
  await input.press(screen.getByRole('button', { name: '체험 완료' }));
  await input.press(screen.getByRole('tab', { name: '이용 내역' }));
  expect(screen.getByText('1,244 P')).toBeOnTheScreen();
  act(() => testRouter.setParams({ tab: 'history' }));
  expect(screen.getByText('1,244 P')).toBeOnTheScreen();
  act(() => testRouter.setParams({ tab: 'charge' }));
  expect(screen.getByText('1,244 P')).toBeOnTheScreen();

  await input.press(screen.getByRole('button', { name: '광고 보고 포인트 받기' }));
  testRouter.push('/away');
  testRouter.back();
  expect(screen.getByText('1,234 P')).toBeOnTheScreen();
  expect(screen.queryByText('체험 내역')).toBeNull();

  await input.press(screen.getByRole('button', { name: '광고 보고 포인트 받기' }));
  view.setSession(makeSession(makeUser('user-b'), 4321, 2));
  expect(screen.queryByText('광고 체험')).toBeNull();
  expect(screen.getByText('4,321 P')).toBeOnTheScreen();

  await input.press(screen.getByRole('button', { name: '광고 보고 포인트 받기' }));
  view.setSession(makeSession(makeUser('user-b'), 4321, 3));
  expect(screen.queryByText('광고 체험')).toBeNull();
  expect(screen.getByText('4,321 P')).toBeOnTheScreen();
  view.unmount();

  const reentered = renderPoints(makeSession(makeUser('user-b'), 4321, 3), 'charge');
  expect(screen.getByText('4,321 P')).toBeOnTheScreen();
  expect(screen.queryByText('체험 내역')).toBeNull();
  reentered.unmount();
});

test('demo works for anonymous users and is disabled while restoring the session', async () => {
  const input = userEvent.setup();
  installRequests();
  const view = renderPoints(makeSession(null, null, 2), 'charge');
  expect(screen.getByText('— P')).toBeOnTheScreen();
  await input.press(screen.getByRole('button', { name: '광고 보고 포인트 받기' }));
  await input.press(screen.getByRole('button', { name: '체험 완료' }));
  expect(screen.getByText('10 P')).toBeOnTheScreen();
  view.unmount();

  installRequests();
  const restoring = renderPoints(makeSession(makeUser('user-a'), 1234, 3, true), 'charge');
  expect(screen.getByRole('button', { name: '광고 보고 포인트 받기' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '100 P 충전 체험' })).toBeDisabled();
  restoring.unmount();
});

test('history waits for session restoration and routes anonymous users to login before loading', async () => {
  const requests = installRequests();
  const view = renderPoints(makeSession(makeUser('user-a'), 2000, 1, true));
  expect(getPointHistory).not.toHaveBeenCalled();
  expect(screen.getByText('로그인 상태를 확인하고 있어요')).toBeOnTheScreen();
  view.setSession(makeSession(null, null, 2));
  expect(getPointHistory).not.toHaveBeenCalled();
  expect(screen.getByText('로그인이 필요해요')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: '로그인' }));
  expect(view.getPathname()).toBe('/login');
  testRouter.back();
  view.setSession(makeSession(makeUser('user-a'), 2000, 3, true));
  expect(getPointHistory).not.toHaveBeenCalled();
  view.setSession(makeSession(makeUser('user-a'), 2000, 3, false));
  expect(requests.pages).toEqual([1]);
  view.unmount();
});

test('history shows transaction labels, signed amounts, after-balances, episode details and Seoul time', async () => {
  const { requests } = installRequests();
  const view = renderPoints(makeSession(makeUser('user-a'), 2000, 1));
  expect(screen.getByText('이용 내역을 불러오는 중이에요')).toBeOnTheScreen();
  const items = [
    transaction('purchase', 'PURCHASE', 1000, 1000),
    transaction('ad', 'AD_REWARD', 10, 1010),
    transaction('unlock', 'EPISODE_UNLOCK', -30, 980, { dramaTitle: '달빛 아래', episodeNumber: 2 }),
    transaction('admin', 'ADMIN_ADJUSTMENT', -5, 975),
    transaction('refund', 'REFUND', 30, 1005, null, '2026-11-03T15:00:00.000Z'),
    transaction('midnight', 'AD_REWARD', 1, 1006, null, '2026-11-03T15:00:00.000Z'),
  ];
  await act(async () => { requests[0].resolve(page(items)); await requests[0].promise; });
  for (const label of ['포인트 충전', '광고 보상', '회차 구매', '관리자 조정', '환불']) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  expect(screen.getByText('+1,000 P')).toBeOnTheScreen();
  expect(screen.getByText('+10 P')).toBeOnTheScreen();
  expect(screen.getByText('-30 P')).toBeOnTheScreen();
  expect(screen.getByText('-5 P')).toBeOnTheScreen();
  expect(screen.getByText('+30 P')).toBeOnTheScreen();
  expect(screen.getByText('거래 후 잔액 980 P')).toBeOnTheScreen();
  expect(screen.getByText('달빛 아래 · 2화')).toBeOnTheScreen();
  expect(screen.getAllByText('2026.11.04 03:04')).toHaveLength(4);
  expect(screen.getAllByText('2026.11.04 00:00')).toHaveLength(2);
  expect(screen.getByText('2,000 P')).toBeOnTheScreen();
  expect(screen.getByText('거래 후 잔액 1,000 P')).toBeOnTheScreen();
  expect(view.unmount).toBeDefined();
  view.unmount();
});

test('empty and failed first pages have distinct states and retry page one', async () => {
  const emptyRequests = installRequests();
  const empty = renderPoints();
  await act(async () => { emptyRequests.requests[0].resolve(page([])); await emptyRequests.requests[0].promise; });
  expect(await screen.findByText('포인트 이용 내역이 없어요')).toBeOnTheScreen();
  empty.unmount();

  const retryRequests = installRequests();
  const failed = renderPoints();
  await act(async () => { retryRequests.requests[0].reject(new Error('offline')); try { await retryRequests.requests[0].promise; } catch {} });
  expect(await screen.findByText('이용 내역을 불러오지 못했어요')).toBeOnTheScreen();
  expect(screen.getByText('네트워크 연결을 확인하고 다시 시도해 주세요.')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));
  expect(retryRequests.pages).toEqual([1, 1]);
  await act(async () => { retryRequests.requests[1].resolve(page([transaction('ok', 'PURCHASE', 100, 100)])); await retryRequests.requests[1].promise; });
  expect(await screen.findByText('포인트 충전')).toBeOnTheScreen();
  failed.unmount();
});

test('pagination prevents duplicate loads, retries the same page, deduplicates UUIDs and stops at the end', async () => {
  const { requests, pages } = installRequests();
  const view = renderPoints();
  const first = transaction('tx-1', 'EPISODE_UNLOCK', -30, 970, { dramaTitle: '작품', episodeNumber: 1 });
  await act(async () => { requests[0].resolve(page([first], 1, true)); await requests[0].promise; });
  const more = screen.getByRole('button', { name: '더 보기' });
  fireEvent.press(more);
  fireEvent.press(more);
  expect(pages).toEqual([1, 2]);
  await act(async () => { requests[1].reject(new Error('offline')); try { await requests[1].promise; } catch {} });
  expect(screen.getByText('작품 · 1화')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '다시 시도' })).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));
  expect(pages).toEqual([1, 2, 2]);
  await act(async () => { requests[2].resolve(page([first, transaction('tx-2', 'AD_REWARD', 10, 980)], 2, false)); await requests[2].promise; });
  expect(screen.getAllByText('회차 구매')).toHaveLength(1);
  expect(screen.getByText('광고 보상')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: '더 보기' })).toBeNull();
  view.unmount();
});

test('account changes hide prior rows and discard late responses from the previous account', async () => {
  const { requests, pages } = installRequests();
  const view = renderPoints(makeSession(makeUser('user-a'), 1234, 1));
  await act(async () => { requests[0].resolve(page([transaction('a-1', 'PURCHASE', 100, 100)], 1, true)); await requests[0].promise; });
  fireEvent.press(screen.getByRole('button', { name: '더 보기' }));
  expect(pages).toEqual([1, 2]);
  view.setSession(makeSession(makeUser('user-b'), 4321, 2));
  expect(pages).toEqual([1, 2, 1]);
  expect(screen.queryByText('포인트 충전')).toBeNull();
  expect(screen.getByText('4,321 P')).toBeOnTheScreen();
  await act(async () => { requests[1].resolve(page([transaction('a-late', 'PURCHASE', 999, 999)], 2)); await requests[1].promise; });
  expect(screen.queryByText('포인트 충전')).toBeNull();
  await act(async () => { requests[2].resolve(page([transaction('b-1', 'AD_REWARD', 10, 10)])); await requests[2].promise; });
  expect(await screen.findByText('광고 보상')).toBeOnTheScreen();
  view.unmount();
});

test('tab changes, blur and unmount discard stale work, while refocus reloads page one', async () => {
  const tabRequests = installRequests();
  const changedTab = renderPoints();
  fireEvent.press(screen.getByRole('tab', { name: '충전하기' }));
  await act(async () => { tabRequests.requests[0].reject(new Error('late tab error')); try { await tabRequests.requests[0].promise; } catch {} });
  expect(screen.queryByText('late tab error')).toBeNull();
  expect(tabRequests.requests).toHaveLength(1);
  changedTab.unmount();

  const blurRequests = installRequests();
  const blurred = renderPoints();
  testRouter.push('/away');
  testRouter.back();
  expect(blurRequests.pages).toEqual([1, 1]);
  await act(async () => { blurRequests.requests[0].resolve(page([transaction('late', 'PURCHASE', 10, 10)])); await blurRequests.requests[0].promise; });
  expect(screen.getByText('이용 내역을 불러오는 중이에요')).toBeOnTheScreen();
  await act(async () => { blurRequests.requests[1].resolve(page([transaction('fresh', 'REFUND', 30, 40)])); await blurRequests.requests[1].promise; });
  expect(await screen.findByText('환불')).toBeOnTheScreen();
  blurred.unmount();

  const unmountRequests = installRequests();
  const unmounted = renderPoints();
  unmounted.unmount();
  await act(async () => { unmountRequests.requests[0].resolve(page([transaction('late', 'PURCHASE', 10, 10)])); await unmountRequests.requests[0].promise; });
});

test('history route parameter changes load history without changing the current point balance', async () => {
  const { requests, pages } = installRequests();
  const view = renderPoints(makeSession(makeUser('user-a'), 4321, 1), 'charge');
  expect(getPointHistory).not.toHaveBeenCalled();
  expect(screen.getByText('4,321 P')).toBeOnTheScreen();
  act(() => testRouter.setParams({ tab: 'history' }));
  expect(view.getSearchParams()).toEqual({ tab: 'history' });
  expect(pages).toEqual([1]);
  expect(screen.getByText('4,321 P')).toBeOnTheScreen();
  await act(async () => { requests[0].resolve(page([transaction('old', 'PURCHASE', 100, 100)])); await requests[0].promise; });
  expect(screen.getByText('4,321 P')).toBeOnTheScreen();
  expect(screen.getByText('거래 후 잔액 100 P')).toBeOnTheScreen();
  view.unmount();
});
