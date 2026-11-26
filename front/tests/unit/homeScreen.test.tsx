import React from 'react';
import { Text } from 'react-native';
import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter, testRouter } from 'expo-router/testing-library';
import { getDramaContent, getDramaList, getGenres, type DramaContent, type DramaListPage, type DramaSummary, type GenreSummary } from '@/features/drama/dramaContent';
import { getHomeCollection } from '@/features/home/homeContent';
import type { HomeCollection, HomeCollectionDrama } from '@/features/home/homeResponses';
import { getWatchHistory, type WatchHistoryItem, type WatchHistoryPage } from '@/features/playback/watchHistory';
import { useUser, type User } from '@/features/user/UserProvider';
import { HomeScreen } from '@/screens/HomeScreen';

jest.mock('@/features/drama/dramaContent', () => ({ getDramaContent: jest.fn(), getDramaList: jest.fn(), getGenres: jest.fn() }));
jest.mock('@/features/home/homeContent', () => ({ getHomeCollection: jest.fn() }));
jest.mock('@/features/playback/watchHistory', () => ({ getWatchHistory: jest.fn() }));
jest.mock('@/features/playback/savedVideos', () => ({ saveVideo: jest.fn(), removeSavedVideo: jest.fn() }));
jest.mock('@/features/user/UserProvider', () => ({ useUser: jest.fn() }));
jest.mock('@/components/EpisodeUnlockDialog', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    EpisodeUnlockDialog: (props: {
      episode: { episodeNumber: number } | null;
      onPurchased: (episode: unknown) => void;
      onClose: () => void;
    }) => props.episode ? React.createElement(React.Fragment, null,
      React.createElement(Text, null, `${props.episode.episodeNumber}화 잠금 창`),
      React.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: '구매 완료 테스트', onPress: () => props.onPurchased(props.episode) }, React.createElement(Text, null, '구매 완료')),
      React.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: '팝업 닫기 테스트', onPress: props.onClose }, React.createElement(Text, null, '닫기')),
    ) : null,
  };
});

type Deferred<T> = { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const member: User = { uuid: 'user-1', displayName: null, accountType: 'MEMBER' };
const session = (version = 1, isRestoring = false, user: User | null = member): ReturnType<typeof useUser> => ({
  user, points: 0, accessToken: null, isRestoring, restoreError: null, sessionExpired: false,
  sessionVersion: version, subtitlesEnabled: true, preferredSubtitleLanguage: 'ko', autoplayNext: false, setUser: jest.fn(), setPoints: jest.fn(),
  login: jest.fn(), logout: jest.fn(), dismissSessionExpired: jest.fn(), isCurrentSession: (candidate) => candidate === version,
  setSubtitlesEnabled: jest.fn(), setPreferredSubtitleLanguage: jest.fn(), setAutoplayNext: jest.fn(),
});
const romance: GenreSummary = { id: 1, code: 'ROMANCE', name: '로맨스', tileImage: 'genres/romance/tile.webp' };
const action: GenreSummary = { id: 2, code: 'ACTION', name: '액션', tileImage: null };
const makeDrama = (uuid: string, title: string, genre: GenreSummary, posterLandscape: string | null = null, freeEpisodeCount = 1): DramaSummary => ({
  uuid, slug: uuid, title, shortDescription: '소개', productionCompany: null,
  genres: [{ id: genre.id, code: genre.code, name: genre.name }],
  imageUrls: { poster: 'https://cdn.example.test/poster.webp', posterLandscape, homeHero: null, detailCover: null, campaigns: [] },
  previewVideos: [], episodeCount: 1, freeEpisodeCount,
});
const collectionDrama = (uuid: string, title: string, displayOrder = 1): HomeCollectionDrama => ({
  uuid, displayOrder, slug: uuid, title, shortDescription: '소개', productionCompany: null,
  genres: [{ id: 1, code: 'ROMANCE', name: '로맨스' }],
  imageUrls: { poster: null, posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] },
  previewVideos: [], publishedEpisodeCount: 3, freeEpisodeCount: 1,
});
type Episode = DramaContent['episodes'][number];
const episode = (number: number, overrides: Partial<Episode> = {}): Episode => ({
  uuid: `ep-${number}`, episodeNumber: number, title: null, synopsis: null, durationMs: 60_000, videoUuid: `video-${number}`,
  isSaved: false, pricePoints: number === 1 ? 0 : 10, isUnlocked: number === 1, image: null, watchProgress: null, ...overrides,
});
const content = (uuid: string, episodes: Episode[]): DramaContent => ({
  uuid, slug: uuid, title: uuid, shortDescription: '', synopsis: '', productionCompany: null, genres: [],
  imageUrls: { poster: null, posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] },
  previewVideos: [], episodes,
});
const progress = (isCompleted: boolean, lastPlayedAt: string) => ({ positionMs: 0, isCompleted, lastPlayedAt });
const historyItem = (dramaUuid: string, dramaTitle: string, episodeNumber: number, contentType: 'EPISODE' | 'PREVIEW' = 'EPISODE'): WatchHistoryItem => (contentType === 'EPISODE'
  ? { contentType, videoUuid: `${dramaUuid}-v${episodeNumber}`, dramaUuid, dramaTitle, imageUrl: null, durationMs: 60_000, episodeUuid: `${dramaUuid}-ep${episodeNumber}`, episodeNumber, episodeTitle: null, lastPlayedAt: '2026-11-01T00:00:00.000Z' }
  : { contentType, videoUuid: `${dramaUuid}-preview`, dramaUuid, dramaTitle, imageUrl: null, durationMs: 60_000, episodeUuid: null, episodeNumber: null, episodeTitle: null, lastPlayedAt: '2026-11-01T00:00:00.000Z' });
const first = makeDrama('drama-1', '첫 작품', romance, 'https://cdn.example.test/landscape.webp');
const second = makeDrama('drama-2', '둘째 작품', romance);
const page = (items: DramaSummary[], pageNumber: number, hasNext: boolean): DramaListPage => ({ items, page: pageNumber, hasNext });
const emptyCollection = (code: string): HomeCollection => ({ code, title: code, description: null, dramas: [] });
const historyPage = (items: WatchHistoryItem[]): WatchHistoryPage => ({ items, page: 1, hasNext: false });

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
    recommend: () => <Text>빼꼼 화면</Text>,
    library: () => <Text>보관함 화면</Text>,
    away: () => <Text>다른 화면</Text>,
    'drama/[id]': () => <Text>작품 상세</Text>,
    'episode/[id]': () => <Text>회차 재생</Text>,
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
  jest.mocked(getWatchHistory).mockResolvedValue(historyPage([]));
  jest.mocked(getDramaContent).mockImplementation(async (uuid) => content(uuid, [episode(1), episode(2)]));
  return requests;
}

function withCollections(collections: Partial<Record<string, HomeCollectionDrama[]>>) {
  jest.mocked(getHomeCollection).mockImplementation(async (code) => ({ ...emptyCollection(code), dramas: collections[code] ?? [] }));
}

async function resolvePage(request: Deferred<DramaListPage>, value: DramaListPage) {
  await act(async () => { request.resolve(value); await request.promise; });
}

beforeEach(() => {
  jest.mocked(getDramaContent).mockReset();
  jest.mocked(getDramaList).mockReset();
  jest.mocked(getGenres).mockReset();
  jest.mocked(getHomeCollection).mockReset();
  jest.mocked(getWatchHistory).mockReset();
});

test('prefetches home data on focus and shows pill tabs 오늘·랭킹·장르 without the old tabs', async () => {
  const requests = setupRequests();
  const view = renderHome();
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(getHomeCollection).toHaveBeenCalledTimes(3);
  expect(getHomeCollection).not.toHaveBeenCalledWith('RECOMMENDATION_DAILY');
  expect(getDramaList).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
  expect(getGenres).toHaveBeenCalledTimes(1);
  expect(getWatchHistory).toHaveBeenCalledWith(1);
  expect(screen.getByRole('tab', { name: '오늘', selected: true })).toBeOnTheScreen();
  expect(screen.getByRole('tab', { name: '랭킹' })).toBeOnTheScreen();
  expect(screen.getByRole('tab', { name: '장르' })).toBeOnTheScreen();
  expect(screen.queryByRole('tab', { name: '최신' })).toBeNull();
  expect(screen.queryByRole('tab', { name: '추천' })).toBeNull();
  view.unmount();
});

test('orders Today sections and opens each section target', async () => {
  const requests = setupRequests();
  withCollections({
    HOME_FEATURED: [collectionDrama('hero-1', '대표 작품')],
    EDITORIAL_TOP_3: [collectionDrama('top-1', '일위 작품', 1), collectionDrama('top-2', '이위 작품', 2), collectionDrama('top-3', '삼위 작품', 3)],
  });
  jest.mocked(getWatchHistory).mockResolvedValue(historyPage([
    historyItem('watch-1', '보던 작품', 4), historyItem('watch-1', '보던 작품', 3), historyItem('watch-2', '미리 본 작품', 0, 'PREVIEW'),
  ]));
  const view = renderHome();
  await waitFor(() => expect(requests).toHaveLength(1));
  await resolvePage(requests[0], page([first, makeDrama('paid', '유료 작품', action, null, 0)], 1, false));

  expect(await screen.findByRole('button', { name: '대표 작품 작품 소개' })).toBeOnTheScreen();
  expect(screen.getAllByRole('header').map((header) => header.props.children))
    .toEqual(['이어보기', '지금 눈여겨볼 TOP 3', '새로 올라온 이야기', '무료로 시작하기 좋은 이야기']);
  expect(screen.getAllByRole('button', { name: /화 이어보기$/ }).map((button) => button.props.accessibilityLabel)).toEqual(['보던 작품 4화 이어보기']);
  expect(screen.getByRole('button', { name: '1위 일위 작품 작품 소개' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '3위 삼위 작품 작품 소개' })).toBeOnTheScreen();
  expect(screen.getByText('3')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '첫 작품 작품 소개, 1화까지 무료' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /^유료 작품 작품 소개, / })).toBeNull();
  expect(screen.getByRole('button', { name: '유료 작품 작품 소개' })).toBeOnTheScreen();
  expect(screen.queryByText(/오늘의 발견|QUICK ESCAPE|분위기 미리보기|본편/)).toBeNull();

  await userEvent.setup().press(screen.getByRole('button', { name: '보던 작품 4화 이어보기' }));
  await waitFor(() => expect(view.getPathnameWithParams()).toBe('/episode/watch-1-ep4?dramaId=watch-1'));
  testRouter.back('/');
  await waitFor(() => expect(requests).toHaveLength(2));
  await resolvePage(requests[1], page([first], 1, false));
  await userEvent.setup().press(await screen.findByRole('button', { name: '빼꼼에서 넘겨보기, 미리보기로 다음 작품을 골라보세요.' }));
  await waitFor(() => expect(view.getPathname()).toBe('/recommend'));
  view.unmount();
});

test('hides Continue Watching without history and does not request history for anonymous users', async () => {
  const requests = setupRequests();
  const anonymous = renderHome(session(1, false, null));
  await waitFor(() => expect(requests).toHaveLength(1));
  await resolvePage(requests[0], page([first], 1, false));
  expect(await screen.findByText('새로 올라온 이야기')).toBeOnTheScreen();
  expect(getWatchHistory).not.toHaveBeenCalled();
  expect(screen.queryByText('이어보기')).toBeNull();
  anonymous.unmount();
});

test('TOP 3 전체보기 switches to the Ranking tab without a visible tab title', async () => {
  const requests = setupRequests();
  withCollections({ EDITORIAL_TOP_3: [collectionDrama('top-1', '일위 작품')] });
  const view = renderHome();
  await waitFor(() => expect(requests).toHaveLength(1));
  await resolvePage(requests[0], page([], 1, false));
  expect(await screen.findByText('지금 눈여겨볼 TOP 3')).toBeOnTheScreen();
  await userEvent.setup().press(screen.getByRole('button', { name: '전체보기' }));
  expect(screen.getByRole('tab', { name: '랭킹', selected: true })).toBeOnTheScreen();
  expect(screen.queryByText('지금 눈여겨볼 TOP 3')).toBeNull();
  await userEvent.setup().press(screen.getByRole('button', { name: '1위 일위 작품 작품 소개' }));
  await waitFor(() => expect(view.getPathnameWithParams()).toBe('/drama/top-1'));
  view.unmount();
});

test.each([
  ['no progress on a free first episode', [episode(1), episode(2)], '1화 무료로 보기', '/episode/ep-1?dramaId=hero-1'],
  ['an unfinished episode', [episode(1, { watchProgress: progress(true, '2026-11-01T00:00:00Z') }), episode(2, { isUnlocked: true, watchProgress: progress(false, '2026-11-02T00:00:00Z') })], '2화 이어보기', '/episode/ep-2?dramaId=hero-1'],
  ['a completed episode with a free next one', [episode(1, { watchProgress: progress(true, '2026-11-01T00:00:00Z') }), episode(2, { pricePoints: 0 })], '2화 보기', '/episode/ep-2?dramaId=hero-1'],
  ['the last episode completed', [episode(1), episode(2, { isUnlocked: true, watchProgress: progress(true, '2026-11-01T00:00:00Z') })], '2화 다시 보기', '/episode/ep-2?dramaId=hero-1'],
])('hero primary button follows the resume point for %s', async (_name, episodes, label, target) => {
  const requests = setupRequests();
  withCollections({ HOME_FEATURED: [collectionDrama('hero-1', '대표 작품')] });
  jest.mocked(getDramaContent).mockResolvedValue(content('hero-1', episodes));
  const view = renderHome();
  await waitFor(() => expect(requests).toHaveLength(1));
  await resolvePage(requests[0], page([], 1, false));
  await userEvent.setup().press(await screen.findByRole('button', { name: label }));
  await waitFor(() => expect(view.getPathnameWithParams()).toBe(target));
  view.unmount();
});

test('a locked resume episode opens the unlock dialog and plays it after purchase', async () => {
  const requests = setupRequests();
  withCollections({ HOME_FEATURED: [collectionDrama('hero-1', '대표 작품')] });
  jest.mocked(getDramaContent).mockResolvedValue(content('hero-1', [episode(1, { watchProgress: progress(true, '2026-11-01T00:00:00Z') }), episode(2)]));
  const view = renderHome();
  await waitFor(() => expect(requests).toHaveLength(1));
  await resolvePage(requests[0], page([], 1, false));
  await userEvent.setup().press(await screen.findByRole('button', { name: '2화 보기' }));
  await userEvent.setup().press(await screen.findByRole('button', { name: '구매 완료 테스트' }));
  await waitFor(() => expect(view.getPathnameWithParams()).toBe('/episode/ep-2?dramaId=hero-1'));
  view.unmount();
});

test('hero primary button opens the unlock dialog for a locked next episode and falls back to the detail when content fails', async () => {
  const requests = setupRequests();
  withCollections({ HOME_FEATURED: [collectionDrama('hero-1', '대표 작품'), collectionDrama('hero-2', '둘째 대표', 2)] });
  jest.mocked(getDramaContent).mockImplementation(async (uuid) => {
    if (uuid === 'hero-2') throw new Error('offline');
    return content(uuid, [episode(1, { watchProgress: progress(true, '2026-11-01T00:00:00Z') }), episode(2)]);
  });
  const view = renderHome();
  await waitFor(() => expect(requests).toHaveLength(1));
  await resolvePage(requests[0], page([], 1, false));
  await userEvent.setup().press(await screen.findByRole('button', { name: '2화 보기' }));
  expect(await screen.findByText('2화 잠금 창')).toBeOnTheScreen();
  expect(view.getPathname()).toBe('/');
  await userEvent.setup().press(screen.getByRole('button', { name: '팝업 닫기 테스트' }));
  expect(screen.queryByText('2화 잠금 창')).toBeNull();

  expect(screen.getByText('1 / 2')).toBeOnTheScreen();
  await userEvent.setup().press(screen.getByRole('button', { name: '둘째 대표 대표 작품으로 보기, 2편 중 2번째' }));
  expect(screen.getByRole('button', { name: '둘째 대표 대표 작품으로 보기, 2편 중 2번째', selected: true })).toBeOnTheScreen();
  expect(screen.getByText('2 / 2')).toBeOnTheScreen();
  await userEvent.setup().press(await screen.findByRole('button', { name: '작품 소개 보기' }));
  await waitFor(() => expect(view.getPathnameWithParams()).toBe('/drama/hero-2'));
  view.unmount();
});

test('shows one loader for the selected Home tab until its requests settle', async () => {
  const requests = setupRequests();
  const collections = new Map<string, Deferred<HomeCollection>>();
  jest.mocked(getHomeCollection).mockImplementation((code) => {
    const request = deferred<HomeCollection>();
    collections.set(code, request);
    return request.promise;
  });
  const genreRequest = deferred<GenreSummary[]>();
  jest.mocked(getGenres).mockReturnValue(genreRequest.promise);
  const historyRequest = deferred<WatchHistoryPage>();
  jest.mocked(getWatchHistory).mockReturnValue(historyRequest.promise);
  const view = renderHome();
  await waitFor(() => expect(requests).toHaveLength(1));

  expect(screen.getByRole('button', { name: '홈으로 이동' })).toBeOnTheScreen();
  expect(screen.getAllByRole('progressbar', { name: '로딩 중' })).toHaveLength(1);

  await userEvent.setup().press(screen.getByRole('tab', { name: '랭킹' }));
  expect(screen.getAllByRole('progressbar', { name: '로딩 중' })).toHaveLength(1);
  await act(async () => {
    collections.get('EDITORIAL_TOP_3')!.resolve(emptyCollection('EDITORIAL_TOP_3'));
    await collections.get('EDITORIAL_TOP_3')!.promise;
  });
  expect(await screen.findByText('TOP 3 작품이 없어요')).toBeOnTheScreen();
  expect(screen.queryByRole('progressbar', { name: '로딩 중' })).toBeNull();

  await userEvent.setup().press(screen.getByRole('tab', { name: '장르' }));
  expect(screen.getAllByRole('progressbar', { name: '로딩 중' })).toHaveLength(1);
  await act(async () => { genreRequest.resolve([]); await genreRequest.promise; });
  expect(await screen.findByText('장르가 없어요')).toBeOnTheScreen();

  await userEvent.setup().press(screen.getByRole('tab', { name: '오늘' }));
  expect(screen.getAllByRole('progressbar', { name: '로딩 중' })).toHaveLength(1);
  await act(async () => {
    collections.get('HOME_FEATURED')!.reject(new Error('offline'));
    try { await collections.get('HOME_FEATURED')!.promise; } catch {}
  });
  await resolvePage(requests[0], page([], 1, false));
  expect(screen.getAllByRole('progressbar', { name: '로딩 중' })).toHaveLength(1);
  await act(async () => { historyRequest.resolve(historyPage([])); await historyRequest.promise; });
  expect(await screen.findByText('추천 작품을 불러오지 못했어요')).toBeOnTheScreen();
  expect(screen.queryByRole('progressbar', { name: '로딩 중' })).toBeNull();
  expect(getHomeCollection).toHaveBeenCalledTimes(3);

  await act(async () => {
    collections.get('HOME_CAMPAIGN')!.resolve(emptyCollection('HOME_CAMPAIGN'));
    await collections.get('HOME_CAMPAIGN')!.promise;
  });
  view.unmount();
});

test('keeps the genre catalog independent of the loaded drama page and opens its code', async () => {
  const requests = setupRequests();
  const view = renderHome();
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
  expect(await screen.findByRole('button', { name: '둘째 작품 작품 소개' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: '이전 계정 작품 작품 소개' })).toBeNull();
  view.unmount();
});

test('ignores an older focus request and retries a failed catalog', async () => {
  const requests = setupRequests();
  const view = renderHome();
  await waitFor(() => expect(requests).toHaveLength(1));
  testRouter.push('/away');
  await screen.findByText('다른 화면');
  testRouter.back('/');
  await waitFor(() => expect(requests).toHaveLength(2));
  await resolvePage(requests[0], page([makeDrama('stale', '이전 포커스 작품', romance)], 1, false));
  await act(async () => { requests[1].reject(new Error('offline')); try { await requests[1].promise; } catch {} });
  expect(await screen.findByText('작품을 불러오지 못했어요')).toBeOnTheScreen();
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
  expect(await screen.findByRole('button', { name: '첫 작품 작품 소개' })).toBeOnTheScreen();
  await userEvent.setup().press(screen.getByRole('tab', { name: '장르' }));
  expect(await screen.findByText('장르를 불러오지 못했어요')).toBeOnTheScreen();
  await userEvent.setup().press(screen.getByRole('button', { name: '다시 시도' }));
  expect(await screen.findByRole('button', { name: '액션 작품 찾기' })).toBeOnTheScreen();
  view.unmount();
});
