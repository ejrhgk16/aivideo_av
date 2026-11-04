import React from 'react';
import { ScrollView, Text } from 'react-native';
import { act, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter, testRouter } from 'expo-router/testing-library';
import { getDramaList, type DramaSummary } from '@/features/drama/dramaContent';
import { useUser, type User } from '@/features/user/UserProvider';
import { SearchScreen } from '@/screens/SearchScreen';

jest.mock('@/features/drama/dramaContent', () => ({ getDramaList: jest.fn() }));
jest.mock('@/features/user/UserProvider', () => ({ useUser: jest.fn() }));

type Deferred<T> = { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const makeUser = (uuid: string): User => ({ uuid, displayName: null, accountType: 'MEMBER' });
const makeSession = (user: User | null, version: number, isRestoring: boolean): ReturnType<typeof useUser> => ({
  user, points: user ? 200 : null, accessToken: null, isRestoring, restoreError: null,
  sessionExpired: false, sessionVersion: version, subtitlesEnabled: true, autoplayNext: false,
  setUser: jest.fn(), setPoints: jest.fn(), login: jest.fn(), logout: jest.fn(),
  dismissSessionExpired: jest.fn(), isCurrentSession: (candidate: number) => candidate === version,
  setSubtitlesEnabled: jest.fn(), setAutoplayNext: jest.fn(),
});

const dramas: DramaSummary[] = [
  { uuid: 'drama-1', slug: 'one', title: '첫 작품', shortDescription: '소개', productionCompany: null, genres: [{ id: 1, code: 'romance', name: '로맨스' }], imageUrls: { poster: null, posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] }, previewVideos: [], episodeCount: 1, freeEpisodeCount: 1 },
  { uuid: 'drama-2', slug: 'two', title: '둘째 작품', shortDescription: '소개', productionCompany: null, genres: [{ id: 2, code: 'action', name: '액션' }], imageUrls: { poster: null, posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] }, previewVideos: [], episodeCount: 1, freeEpisodeCount: 1 },
];

function renderSearch(initial: ReturnType<typeof useUser> = makeSession(null, 1, true)) {
  let setSession!: React.Dispatch<React.SetStateAction<ReturnType<typeof useUser>>>;
  function Route() {
    const [session, updateSession] = React.useState(initial);
    setSession = updateSession;
    jest.mocked(useUser).mockReturnValue(session);
    return <SearchScreen />;
  }
  const view = renderRouter({
    _layout: () => <Stack screenOptions={{ animation: 'none' }} />,
    index: Route,
    away: () => <Text>다른 화면</Text>,
    'drama/[id]': () => <Text>작품 상세</Text>,
  }, { initialUrl: '/' });
  return { ...view, setSession: (next: ReturnType<typeof useUser>) => act(() => setSession(next)) };
}

function installRequests() {
  const requests: Deferred<DramaSummary[]>[] = [];
  jest.mocked(getDramaList).mockImplementation(() => {
    const request = deferred<DramaSummary[]>();
    requests.push(request);
    return request.promise;
  });
  return requests;
}

// Search results also expose genre text, so query the actual horizontal filter row.
function getGenreFilter(selected: boolean) {
  const filters = screen.UNSAFE_getAllByType(ScrollView).find((item) => item.props.horizontal);
  if (!filters) throw new Error('genre filter row was not rendered');
  return within(filters).getByRole('button', { name: '액션', selected });
}

test('search waits for restoration, then reloads anonymous results after session expiration', async () => {
  const requests = installRequests();
  const view = renderSearch();
  expect(screen.getByText('작품을 불러오는 중')).toBeOnTheScreen();
  expect(getDramaList).not.toHaveBeenCalled();

  view.setSession(makeSession(makeUser('account-a'), 1, false));
  expect(requests).toHaveLength(1);
  view.setSession(makeSession(null, 2, false));
  expect(requests).toHaveLength(2);
  await act(async () => { requests[1].resolve(dramas); await requests[1].promise; });
  expect(await screen.findByRole('button', { name: '첫 작품 작품 소개' })).toBeOnTheScreen();
  await act(async () => { requests[0].reject(new Error('expired request rejected')); try { await requests[0].promise; } catch {} });
  expect(screen.getByRole('button', { name: '첫 작품 작품 소개' })).toBeOnTheScreen();
  view.unmount();
});

test('search preserves title and genre filters on focus refetch and retry while discarding stale account responses', async () => {
  const requests = installRequests();
  const view = renderSearch(makeSession(makeUser('account-a'), 1, false));
  await act(async () => { requests[0].resolve(dramas); await requests[0].promise; });
  expect(await screen.findByRole('button', { name: '첫 작품 작품 소개' })).toBeOnTheScreen();

  const user = userEvent.setup();
  await user.type(screen.getByLabelText('작품 제목이나 장르 검색'), '둘째');
  await user.press(getGenreFilter(false));
  expect(screen.getByRole('button', { name: '둘째 작품 작품 소개' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: '첫 작품 작품 소개' })).not.toBeOnTheScreen();

  testRouter.push('/away');
  await screen.findByText('다른 화면');
  await waitFor(() => expect(view.getPathnameWithParams()).toBe('/away'));
  testRouter.back('/');
  await waitFor(() => expect(view.getPathnameWithParams()).toBe('/'));
  await waitFor(() => expect(requests).toHaveLength(2));
  view.setSession(makeSession(makeUser('account-b'), 2, false));
  expect(requests).toHaveLength(3);
  await act(async () => { requests[1].resolve([]); await requests[1].promise; });
  expect(screen.getByText('작품을 불러오는 중')).toBeOnTheScreen();
  await act(async () => { requests[2].reject(new Error('offline')); try { await requests[2].promise; } catch {} });
  expect(await screen.findByRole('button', { name: '다시 시도' })).toBeOnTheScreen();
  expect(screen.getByLabelText('작품 제목이나 장르 검색')).toHaveProp('value', '둘째');

  await user.press(screen.getByRole('button', { name: '다시 시도' }));
  expect(requests).toHaveLength(4);
  expect(screen.getByLabelText('작품 제목이나 장르 검색')).toHaveProp('value', '둘째');
  await act(async () => { requests[3].resolve([{ ...dramas[1], title: '검색어와 무관한 작품' }]); await requests[3].promise; });
  expect(await screen.findByText('아직 찾는 이야기가 없어요')).toBeOnTheScreen();
  expect(getGenreFilter(true)).toBeSelected();
  view.unmount();
});

test('search does not request during restoration and refetches when focus returns', async () => {
  const requests = installRequests();
  const view = renderSearch(makeSession(null, 0, true));
  expect(getDramaList).not.toHaveBeenCalled();
  view.setSession(makeSession(null, 1, false));
  expect(requests).toHaveLength(1);
  testRouter.push('/away');
  await screen.findByText('다른 화면');
  await waitFor(() => expect(view.getPathnameWithParams()).toBe('/away'));
  testRouter.back('/');
  await waitFor(() => expect(view.getPathnameWithParams()).toBe('/'));
  await waitFor(() => expect(requests).toHaveLength(2));
  await act(async () => { requests[1].resolve(dramas); await requests[1].promise; });
  expect(await screen.findByRole('button', { name: '첫 작품 작품 소개' })).toBeOnTheScreen();
  view.unmount();
});
