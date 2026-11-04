import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';
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
  const view = renderRouter({ index: Route, away: () => <Text>다른 화면</Text>, login: () => <Text>로그인 화면</Text>, account: () => <Text>계정 화면</Text> }, { initialUrl: tab ? `/?tab=${tab}` : '/' });
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

test('charge tab keeps sample packs without loading history; history route loads page one', async () => {
  const chargeRequests = installRequests();
  const charge = renderPoints(makeSession(makeUser('user-a'), 1234, 1), 'charge');
  expect(getPointHistory).not.toHaveBeenCalled();
  expect(screen.getByText('광고 보고 +10 P')).toBeOnTheScreen();
  expect(screen.getByText('포인트 충전')).toBeOnTheScreen();
  expect(screen.getByText('1,234 P')).toBeOnTheScreen();
  expect(screen.getByText('100 P')).toBeOnTheScreen();
  expect(screen.getByText('300 P')).toBeOnTheScreen();
  expect(screen.getByText('600 P')).toBeOnTheScreen();
  expect(screen.getByText('예시 가격 · ₩1,100')).toBeOnTheScreen();
  expect(screen.getAllByRole('button', { name: '준비 중' })).toHaveLength(4);
  expect(chargeRequests.pages).toEqual([]);
  charge.unmount();

  const historyRequests = installRequests();
  const history = renderPoints(makeSession(makeUser('user-a'), 2000, 1), 'history');
  expect(historyRequests.pages).toEqual([1]);
  history.unmount();
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
