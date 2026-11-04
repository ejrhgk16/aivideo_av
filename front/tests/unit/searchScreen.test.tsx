import React from 'react';
import { Text } from 'react-native';
import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter, testRouter } from 'expo-router/testing-library';
import { getDramaList, getGenres, type DramaListPage, type DramaSummary, type GenreSummary } from '@/features/drama/dramaContent';
import { useUser, type User } from '@/features/user/UserProvider';
import { SearchScreen } from '@/screens/SearchScreen';

jest.mock('@/features/drama/dramaContent', () => ({ getDramaList: jest.fn(), getGenres: jest.fn() }));
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

const romance: GenreSummary = { id: 1, code: 'ROMANCE', name: '로맨스', tileImage: 'genres/romance/tile.webp' };
const action: GenreSummary = { id: 2, code: 'ACTION', name: '액션', tileImage: null };
const genres = [romance, action];
const makeDrama = (uuid: string, title: string, genre = romance): DramaSummary => ({
  uuid, slug: uuid, title, shortDescription: '소개', productionCompany: null,
  genres: [{ id: genre.id, code: genre.code, name: genre.name }],
  imageUrls: { poster: null, posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] },
  previewVideos: [], episodeCount: 1, freeEpisodeCount: 1,
});
const dramas = [makeDrama('drama-1', '첫 작품'), makeDrama('drama-2', '둘째 작품', action)];
const page = (items: DramaSummary[], pageNumber = 1, hasNext = false): DramaListPage => ({ items, page: pageNumber, hasNext });

function renderSearch(initial: ReturnType<typeof useUser> = makeSession(null, 1, false), initialUrl = '/') {
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
  }, { initialUrl });
  return { ...view, setSession: (next: ReturnType<typeof useUser>) => act(() => setSession(next)) };
}

function setupRequests() {
  const requests: Deferred<DramaListPage>[] = [];
  jest.mocked(getGenres).mockResolvedValue(genres);
  jest.mocked(getDramaList).mockImplementation(() => {
    const request = deferred<DramaListPage>();
    requests.push(request);
    return request.promise;
  });
  return requests;
}

async function resolvePage(request: Deferred<DramaListPage>, value: DramaListPage) {
  await act(async () => { request.resolve(value); await request.promise; });
}

function getGenreFilter(name: string, selected: boolean) {
  return screen.getByRole('button', { name, selected });
}

test('waits for session restoration and genre loading before requesting the first page', async () => {
  const genreRequest = deferred<GenreSummary[]>();
  const pageRequest = deferred<DramaListPage>();
  jest.mocked(getGenres).mockReturnValue(genreRequest.promise);
  jest.mocked(getDramaList).mockReturnValue(pageRequest.promise);
  const view = renderSearch(makeSession(null, 0, true));

  expect(getGenres).not.toHaveBeenCalled();
  expect(getDramaList).not.toHaveBeenCalled();
  view.setSession(makeSession(null, 1, false));
  expect(getGenres).toHaveBeenCalledTimes(1);
  expect(getDramaList).not.toHaveBeenCalled();
  await act(async () => { genreRequest.resolve(genres); await genreRequest.promise; });
  expect(getDramaList).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
  await resolvePage(pageRequest, page(dramas));
  expect(await screen.findByRole('button', { name: '첫 작품 작품 소개' })).toBeOnTheScreen();
  view.unmount();
});

test('uses all genres and server results, then appends the next page without duplicate UUIDs', async () => {
  const requests = setupRequests();
  const view = renderSearch();
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(getDramaList).toHaveBeenCalledTimes(1);
  expect(getDramaList).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
  await resolvePage(requests[0], page([dramas[0]], 1, true));
  expect(getGenreFilter('액션', false)).toBeOnTheScreen();
  expect(screen.getByText('불러온 작품 1개')).toBeOnTheScreen();

  const user = userEvent.setup();
  await user.press(screen.getByRole('button', { name: '더 보기' }));
  expect(getDramaList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  await resolvePage(requests[1], page([dramas[0], dramas[1]], 2, false));
  expect(await screen.findByRole('button', { name: '둘째 작품 작품 소개' })).toBeOnTheScreen();
  expect(screen.getAllByRole('button', { name: '첫 작품 작품 소개' })).toHaveLength(1);
  expect(screen.getByText('불러온 작품 2개')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: '더 보기' })).toBeNull();
  view.unmount();
});

test('debounces search for 300ms and sends server conditions without locally filtering results', async () => {
  const requests = setupRequests();
  const view = renderSearch();
  await waitFor(() => expect(requests).toHaveLength(1));
  await resolvePage(requests[0], page(dramas));
  jest.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const before = jest.mocked(getDramaList).mock.calls.length;
  await user.type(screen.getByLabelText('작품 제목이나 장르 검색'), '봄');
  expect(screen.queryByRole('button', { name: '첫 작품 작품 소개' })).toBeNull();
  await act(async () => { jest.advanceTimersByTime(299); });
  expect(getDramaList).toHaveBeenCalledTimes(before);
  await act(async () => { jest.advanceTimersByTime(1); });
  expect(getDramaList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, q: '봄' }));
  await resolvePage(requests[1], page([makeDrama('server-result', '서버가 찾은 결과')], 1, false));
  expect(await screen.findByRole('button', { name: '서버가 찾은 결과 작품 소개' })).toBeOnTheScreen();
  expect(screen.getByText('불러온 작품 1개')).toBeOnTheScreen();
  const completedSearchCalls = jest.mocked(getDramaList).mock.calls.length;
  await user.type(screen.getByLabelText('작품 제목이나 장르 검색'), ' ');
  await act(async () => { jest.advanceTimersByTime(300); });
  expect(getDramaList).toHaveBeenCalledTimes(completedSearchCalls);
  view.unmount();
});

test('All works clears the search and genre and requests the unfiltered first page', async () => {
  const requests = setupRequests();
  const view = renderSearch(makeSession(null, 1, false), '/?genre=ACTION');
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(getDramaList).toHaveBeenCalledWith(expect.objectContaining({ page: 1, genre: 'ACTION' }));
  await resolvePage(requests[0], page([]));
  await userEvent.setup().press(screen.getByRole('button', { name: '모든 작품 보기' }));
  expect(screen.getByLabelText('작품 제목이나 장르 검색')).toHaveProp('value', '');
  expect(getDramaList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
  await resolvePage(requests[1], page(dramas));
  expect(await screen.findByRole('button', { name: '첫 작품 작품 소개' })).toBeOnTheScreen();
  view.unmount();
});

test('an unknown route genre falls back to all genres', async () => {
  const requests = setupRequests();
  const view = renderSearch(makeSession(null, 1, false), '/?genre=UNKNOWN');
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(getGenreFilter('전체', true)).toBeSelected();
  expect(getDramaList).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
  await resolvePage(requests[0], page(dramas));
  expect(await screen.findByRole('button', { name: '첫 작품 작품 소개' })).toBeOnTheScreen();
  view.unmount();
});

test('does not send the all-genres sentinel as a server genre filter', async () => {
  const requests = setupRequests();
  const view = renderSearch();
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(jest.mocked(getDramaList).mock.calls[0][0]?.genre).toBeUndefined();
  await resolvePage(requests[0], page(dramas));
  view.unmount();
});

test('applies the route genre after retrying an initial genre load failure', async () => {
  const requests = setupRequests();
  jest.mocked(getGenres).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(genres);
  const view = renderSearch(makeSession(null, 1, false), '/?genre=ACTION');
  expect(await screen.findByText('장르를 불러오지 못했어요')).toBeOnTheScreen();
  await userEvent.setup().press(screen.getByRole('button', { name: '다시 시도' }));
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(getDramaList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, genre: 'ACTION' }));
  await resolvePage(requests[0], page([dramas[1]]));
  view.unmount();
});

test('keeps the all-genres selection after returning to a route that started with a genre', async () => {
  const requests = setupRequests();
  const view = renderSearch(makeSession(null, 1, false), '/?genre=ACTION');
  await waitFor(() => expect(requests).toHaveLength(1));
  await resolvePage(requests[0], page([dramas[1]]));
  const user = userEvent.setup();
  await user.press(getGenreFilter('전체', false));
  await waitFor(() => expect(requests).toHaveLength(2));
  await resolvePage(requests[1], page(dramas));
  testRouter.push('/away');
  await screen.findByText('다른 화면');
  testRouter.back('/?genre=ACTION');
  await waitFor(() => expect(requests).toHaveLength(3));
  const sentGenres = jest.mocked(getDramaList).mock.calls.map(([params]) => params?.genre);
  expect(sentGenres).toEqual(['ACTION', undefined, undefined]);
  await resolvePage(requests[2], page(dramas));
  expect(getGenreFilter('전체', true)).toBeSelected();
  view.unmount();
});

test('keeps pending typed input aligned with the request after focus returns before debounce', async () => {
  const genreRequests = [deferred<GenreSummary[]>(), deferred<GenreSummary[]>()];
  let genreCall = 0;
  const listRequests: Deferred<DramaListPage>[] = [];
  jest.mocked(getGenres).mockImplementation(() => genreRequests[genreCall++].promise);
  jest.mocked(getDramaList).mockImplementation(() => {
    const request = deferred<DramaListPage>();
    listRequests.push(request);
    return request.promise;
  });
  const view = renderSearch();
  jest.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await user.type(screen.getByLabelText('작품 제목이나 장르 검색'), '봄');
  testRouter.push('/away');
  await screen.findByText('다른 화면');
  await act(async () => { genreRequests[0].resolve(genres); await genreRequests[0].promise; });
  testRouter.back('/');
  await waitFor(() => expect(getGenres).toHaveBeenCalledTimes(2));
  await act(async () => { genreRequests[1].resolve(genres); await genreRequests[1].promise; });
  await waitFor(() => expect(listRequests).toHaveLength(1));
  expect(getDramaList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, q: '봄' }));
  await resolvePage(listRequests[0], page([makeDrama('spring', '봄 이야기')]));
  expect(await screen.findByRole('button', { name: '봄 이야기 작품 소개' })).toBeOnTheScreen();
  view.unmount();
});

test('genre selection immediately applies the current query and route values accept code or name', async () => {
  const requests = setupRequests();
  const view = renderSearch(makeSession(null, 1, false), '/?genre=로맨스');
  await waitFor(() => expect(requests).toHaveLength(1));
  await resolvePage(requests[0], page(dramas));
  expect(getGenreFilter('로맨스', true)).toBeSelected();
  jest.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await user.type(screen.getByLabelText('작품 제목이나 장르 검색'), '둘째');
  await user.press(getGenreFilter('액션', false));
  expect(requests).toHaveLength(2);
  expect(getDramaList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, q: '둘째', genre: 'ACTION' }));
  await act(async () => { jest.advanceTimersByTime(301); });
  expect(requests).toHaveLength(2);
  await resolvePage(requests[1], page([dramas[1]], 1, false));
  expect(await screen.findByRole('button', { name: '둘째 작품 작품 소개' })).toBeOnTheScreen();
  testRouter.push('/away');
  await screen.findByText('다른 화면');
  testRouter.back('/?genre=%EB%A1%9C%EB%A7%A8%EC%8A%A4');
  await act(async () => { await Promise.resolve(); });
  await waitFor(() => expect(requests).toHaveLength(3));
  expect(getDramaList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, q: '둘째', genre: 'ACTION' }));
  await resolvePage(requests[2], page([dramas[1]], 1, false));
  expect(getGenreFilter('액션', true)).toBeSelected();
  view.unmount();
});

test('failed next page keeps current items and retries that same page', async () => {
  const requests = setupRequests();
  const view = renderSearch();
  await waitFor(() => expect(requests).toHaveLength(1));
  await resolvePage(requests[0], page([dramas[0]], 1, true));
  const user = userEvent.setup();
  await user.press(screen.getByRole('button', { name: '더 보기' }));
  await waitFor(() => expect(requests).toHaveLength(2));
  await act(async () => { requests[1].reject(new Error('offline')); try { await requests[1].promise; } catch {} });
  expect(screen.getByRole('button', { name: '첫 작품 작품 소개' })).toBeOnTheScreen();
  expect(await screen.findByRole('button', { name: '다시 시도' })).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: '다시 시도' }));
  expect(getDramaList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  await resolvePage(requests[2], page([dramas[1]], 2, false));
  expect(await screen.findByRole('button', { name: '둘째 작품 작품 소개' })).toBeOnTheScreen();
  view.unmount();
});

test('failed first page can be retried with the current search condition', async () => {
  const requests = setupRequests();
  const view = renderSearch();
  await waitFor(() => expect(requests).toHaveLength(1));
  await act(async () => { requests[0].reject(new Error('offline')); try { await requests[0].promise; } catch {} });
  await userEvent.setup().press(await screen.findByRole('button', { name: '다시 시도' }));
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(getDramaList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
  await resolvePage(requests[1], page([dramas[0]]));
  expect(await screen.findByRole('button', { name: '첫 작품 작품 소개' })).toBeOnTheScreen();
  view.unmount();
});

test('ignores the first-page response from the previous search condition', async () => {
  const requests = setupRequests();
  const view = renderSearch();
  await waitFor(() => expect(requests).toHaveLength(1));
  jest.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await user.type(screen.getByLabelText('작품 제목이나 장르 검색'), '새 검색');
  await act(async () => { jest.advanceTimersByTime(300); });
  expect(requests).toHaveLength(2);
  await resolvePage(requests[0], page([makeDrama('stale', '이전 검색 결과')]));
  expect(screen.queryByRole('button', { name: '이전 검색 결과 작품 소개' })).toBeNull();
  await resolvePage(requests[1], page([makeDrama('current', '현재 검색 결과')]));
  expect(await screen.findByRole('button', { name: '현재 검색 결과 작품 소개' })).toBeOnTheScreen();
  view.unmount();
});

test('ignores an in-flight next page after search conditions change', async () => {
  const requests = setupRequests();
  const view = renderSearch();
  await waitFor(() => expect(requests).toHaveLength(1));
  await resolvePage(requests[0], page([dramas[0]], 1, true));
  jest.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await user.press(screen.getByRole('button', { name: '더 보기' }));
  await waitFor(() => expect(requests).toHaveLength(2));
  await user.type(screen.getByLabelText('작품 제목이나 장르 검색'), '현재');
  await act(async () => { jest.advanceTimersByTime(300); });
  await waitFor(() => expect(requests).toHaveLength(3));
  await resolvePage(requests[1], page([makeDrama('stale-page', '오래된 다음 페이지')], 2, false));
  expect(screen.queryByRole('button', { name: '오래된 다음 페이지 작품 소개' })).toBeNull();
  await resolvePage(requests[2], page([makeDrama('current-search', '현재 조건 결과')], 1, false));
  expect(await screen.findByRole('button', { name: '현재 조건 결과 작품 소개' })).toBeOnTheScreen();
  view.unmount();
});

test('discards a stale account response and refetches the current query on focus return', async () => {
  const requests = setupRequests();
  const view = renderSearch(makeSession(makeUser('account-a'), 1, false));
  await waitFor(() => expect(requests).toHaveLength(1));
  view.setSession(makeSession(makeUser('account-b'), 2, false));
  await waitFor(() => expect(requests).toHaveLength(2));
  await resolvePage(requests[0], page([makeDrama('stale', '오래된 결과')]));
  expect(screen.queryByRole('button', { name: '오래된 결과 작품 소개' })).toBeNull();
  await resolvePage(requests[1], page([dramas[0]]));
  testRouter.push('/away');
  await screen.findByText('다른 화면');
  testRouter.back('/');
  await waitFor(() => expect(requests).toHaveLength(3));
  await resolvePage(requests[2], page([dramas[1]]));
  expect(await screen.findByRole('button', { name: '둘째 작품 작품 소개' })).toBeOnTheScreen();
  view.unmount();
});

test('genre load error has an independent retry action', async () => {
  const requests = setupRequests();
  jest.mocked(getGenres).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(genres);
  const view = renderSearch();
  expect(await screen.findByText('장르를 불러오지 못했어요')).toBeOnTheScreen();
  expect(getDramaList).not.toHaveBeenCalled();
  await userEvent.setup().press(screen.getByRole('button', { name: '다시 시도' }));
  await waitFor(() => expect(getDramaList).toHaveBeenCalledWith(expect.objectContaining({ page: 1 })));
  await resolvePage(requests[0], page(dramas));
  expect(await screen.findByRole('button', { name: '첫 작품 작품 소개' })).toBeOnTheScreen();
  view.unmount();
});
