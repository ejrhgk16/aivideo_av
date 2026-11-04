import React from 'react';
import { Text } from 'react-native';
import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter, testRouter } from 'expo-router/testing-library';
import { getDramaList, getGenres, type DramaListPage, type DramaSummary, type GenreSummary } from '@/features/drama/dramaContent';
import { getHomeCollection } from '@/features/home/homeContent';
import type { HomeCollection } from '@/features/home/homeResponses';
import { useUser, type User } from '@/features/user/UserProvider';
import { HomeScreen } from '@/screens/HomeScreen';

jest.mock('@/features/drama/dramaContent', () => ({ getDramaList: jest.fn(), getGenres: jest.fn() }));
jest.mock('@/features/home/homeContent', () => ({ getHomeCollection: jest.fn() }));
jest.mock('@/features/user/UserProvider', () => ({ useUser: jest.fn() }));

type Deferred<T> = { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const user: User = { uuid: 'user-1', displayName: null, accountType: 'MEMBER' };
const session = (version = 1, isRestoring = false): ReturnType<typeof useUser> => ({
  user, points: 0, accessToken: null, isRestoring, restoreError: null, sessionExpired: false,
  sessionVersion: version, subtitlesEnabled: true, autoplayNext: false, setUser: jest.fn(), setPoints: jest.fn(),
  login: jest.fn(), logout: jest.fn(), dismissSessionExpired: jest.fn(), isCurrentSession: (candidate) => candidate === version,
  setSubtitlesEnabled: jest.fn(), setAutoplayNext: jest.fn(),
});
const romance: GenreSummary = { id: 1, code: 'ROMANCE', name: '로맨스', tileImage: 'genres/romance/tile.webp' };
const action: GenreSummary = { id: 2, code: 'ACTION', name: '액션', tileImage: null };
const makeDrama = (uuid: string, title: string, genre: GenreSummary, posterLandscape: string | null = null): DramaSummary => ({
  uuid, slug: uuid, title, shortDescription: '소개', productionCompany: null,
  genres: [{ id: genre.id, code: genre.code, name: genre.name }],
  imageUrls: { poster: 'https://cdn.example.test/poster.webp', posterLandscape, homeHero: null, detailCover: null, campaigns: [] },
  previewVideos: [], episodeCount: 1, freeEpisodeCount: 1,
});
const first = makeDrama('drama-1', '첫 작품', romance, 'https://cdn.example.test/landscape.webp');
const second = makeDrama('drama-2', '둘째 작품', romance);
const page = (items: DramaSummary[], pageNumber: number, hasNext: boolean): DramaListPage => ({ items, page: pageNumber, hasNext });
const emptyCollection = (code: string): HomeCollection => ({ code, title: code, description: null, dramas: [] });

function renderHome(initialSession = session()) {
  let activeSession = initialSession;
  let refresh!: () => void;
  function HomeRoute() {
    const [, rerender] = React.useReducer((count) => count + 1, 0);
    refresh = rerender;
    jest.mocked(useUser).mockReturnValue(activeSession);
    return <HomeScreen />;
  }
  const view = renderRouter({
    _layout: () => <Stack screenOptions={{ animation: 'none' }} />,
    index: HomeRoute,
    search: () => <Text>검색 화면</Text>,
    away: () => <Text>다른 화면</Text>,
    'drama/[id]': () => <Text>작품 상세</Text>,
  });
  return {
    ...view,
    setSession(next: ReturnType<typeof useUser>) {
      act(() => { activeSession = next; refresh(); });
    },
  };
}

function setupRequests() {
  const requests: Deferred<DramaListPage>[] = [];
  jest.mocked(getDramaList).mockImplementation(() => {
    const request = deferred<DramaListPage>();
    requests.push(request);
    return request.promise;
  });
  jest.mocked(getGenres).mockResolvedValue([romance, action]);
  jest.mocked(getHomeCollection).mockImplementation(async (code) => emptyCollection(code));
  return requests;
}

async function resolvePage(request: Deferred<DramaListPage>, value: DramaListPage) {
  await act(async () => { request.resolve(value); await request.promise; });
}

test('prefetches catalog and genres on the home focus, then appends unique pages from Latest', async () => {
  const requests = setupRequests();
  const view = renderHome();
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(getHomeCollection).toHaveBeenCalledTimes(4);
  expect(getDramaList).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
  expect(getGenres).toHaveBeenCalledTimes(1);
  await resolvePage(requests[0], page([first], 1, true));
  await userEvent.setup().press(screen.getByRole('tab', { name: '최신' }));
  expect(await screen.findByRole('button', { name: '첫 작품 작품 소개' })).toBeOnTheScreen();
  await userEvent.setup().press(screen.getByRole('button', { name: '더 보기' }));
  expect(getDramaList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  expect(getDramaList).toHaveBeenCalledTimes(2);
  await resolvePage(requests[1], page([first, second], 2, false));
  expect(await screen.findByRole('button', { name: '둘째 작품 작품 소개' })).toBeOnTheScreen();
  expect(screen.getAllByRole('button', { name: '첫 작품 작품 소개' })).toHaveLength(1);
  expect(screen.queryByRole('button', { name: '더 보기' })).toBeNull();
  view.unmount();
});

test('keeps the genre catalog independent of the loaded drama page and opens its code', async () => {
  const requests = setupRequests();
  const view = renderHome();
  jest.mocked(getGenres).mockResolvedValue([romance, action]);
  await waitFor(() => expect(requests).toHaveLength(1));
  await resolvePage(requests[0], page([first], 1, false));
  await userEvent.setup().press(screen.getByRole('tab', { name: '장르' }));
  expect(await screen.findByRole('button', { name: '로맨스 작품 찾기' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '액션 작품 찾기' })).toBeOnTheScreen();
  expect(screen.getByLabelText('로맨스 표지')).toHaveProp('source', [{ uri: 'https://cdn.example.test/landscape.webp' }]);
  expect(screen.getByLabelText('액션 표지 없음')).toBeOnTheScreen();
  await userEvent.setup().press(screen.getByRole('button', { name: '액션 작품 찾기' }));
  await waitFor(() => expect(view.getPathnameWithParams()).toBe('/search?genre=ACTION'));
  expect(await screen.findByText('검색 화면')).toBeOnTheScreen();
  view.unmount();
});

test('late responses from an old focus and session do not replace current catalog', async () => {
  const requests = setupRequests();
  const view = renderHome(session(1, true));
  expect(getDramaList).not.toHaveBeenCalled();
  view.setSession(session(2, false));
  await waitFor(() => expect(requests).toHaveLength(1));
  view.setSession(session(3, false));
  await waitFor(() => expect(requests).toHaveLength(2));
  await resolvePage(requests[0], page([makeDrama('stale', '이전 계정 작품', romance)], 1, false));
  await resolvePage(requests[1], page([second], 1, false));
  await userEvent.setup().press(screen.getByRole('tab', { name: '최신' }));
  expect(await screen.findByRole('button', { name: '둘째 작품 작품 소개' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: '이전 계정 작품 작품 소개' })).toBeNull();
  view.unmount();
});

test('ignores an older focus request and retries a failed first page', async () => {
  const requests = setupRequests();
  const view = renderHome();
  await waitFor(() => expect(requests).toHaveLength(1));
  testRouter.push('/away');
  await screen.findByText('다른 화면');
  testRouter.back('/');
  await waitFor(() => expect(requests).toHaveLength(2));
  await resolvePage(requests[0], page([makeDrama('stale', '이전 포커스 작품', romance)], 1, false));
  await act(async () => { requests[1].reject(new Error('offline')); try { await requests[1].promise; } catch {} });
  await userEvent.setup().press(screen.getByRole('tab', { name: '최신' }));
  expect(await screen.findByText('최신 작품을 불러오지 못했어요')).toBeOnTheScreen();
  await userEvent.setup().press(screen.getByRole('button', { name: '다시 시도' }));
  expect(getDramaList).toHaveBeenCalledTimes(3);
  await resolvePage(requests[2], page([first], 1, false));
  expect(await screen.findByRole('button', { name: '첫 작품 작품 소개' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: '이전 포커스 작품 작품 소개' })).toBeNull();
  view.unmount();
});

test('genre fetch failure does not discard catalog and can be retried independently', async () => {
  const requests = setupRequests();
  jest.mocked(getGenres).mockRejectedValueOnce(new Error('offline')).mockResolvedValue([romance, action]);
  const view = renderHome();
  await waitFor(() => expect(requests).toHaveLength(1));
  await resolvePage(requests[0], page([first], 1, false));
  await userEvent.setup().press(screen.getByRole('tab', { name: '최신' }));
  expect(await screen.findByRole('button', { name: '첫 작품 작품 소개' })).toBeOnTheScreen();
  await userEvent.setup().press(screen.getByRole('tab', { name: '장르' }));
  expect(await screen.findByText('장르를 불러오지 못했어요')).toBeOnTheScreen();
  await userEvent.setup().press(screen.getByRole('button', { name: '다시 시도' }));
  expect(await screen.findByRole('button', { name: '액션 작품 찾기' })).toBeOnTheScreen();
  view.unmount();
});

test('a failed next page keeps the first page, blocks duplicate loads, and retries the same page', async () => {
  const requests = setupRequests();
  const view = renderHome();
  await waitFor(() => expect(requests).toHaveLength(1));
  await resolvePage(requests[0], page([first], 1, true));
  await userEvent.setup().press(screen.getByRole('tab', { name: '최신' }));
  const user = userEvent.setup();
  await user.press(screen.getByRole('button', { name: '더 보기' }));
  await waitFor(() => expect(requests).toHaveLength(2));
  const moreButton = screen.queryByRole('button', { name: '더 보기' });
  if (moreButton) await user.press(moreButton);
  expect(getDramaList).toHaveBeenCalledTimes(2);
  expect(screen.getByText('더 불러오는 중이에요')).toBeOnTheScreen();
  await act(async () => { requests[1].reject(new Error('offline')); try { await requests[1].promise; } catch {} });
  expect(screen.getByRole('button', { name: '첫 작품 작품 소개' })).toBeOnTheScreen();
  await user.press(await screen.findByRole('button', { name: '다시 시도' }));
  await waitFor(() => expect(requests).toHaveLength(3));
  expect(getDramaList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  await resolvePage(requests[2], page([second], 2, false));
  expect(await screen.findByRole('button', { name: '둘째 작품 작품 소개' })).toBeOnTheScreen();
  view.unmount();
});
