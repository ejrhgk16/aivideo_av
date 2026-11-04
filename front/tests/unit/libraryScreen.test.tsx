import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Stack } from 'expo-router';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { renderRouter, testRouter } from 'expo-router/testing-library';
import { getSavedVideos, type SavedVideoItem, type SavedVideoPage, type WatchHistoryItem } from '@/features/playback/savedVideos';
import { getWatchHistory } from '@/features/playback/watchHistory';
import { useUser, type User } from '@/features/user/UserProvider';
import { LibraryScreen } from '@/screens/LibraryScreen';

jest.mock('@/features/playback/savedVideos', () => ({ ...jest.requireActual('@/features/playback/savedVideos'), getSavedVideos: jest.fn() }));
jest.mock('@/features/playback/watchHistory', () => ({ ...jest.requireActual('@/features/playback/watchHistory'), getWatchHistory: jest.fn() }));
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

const preview: SavedVideoItem = {
  videoUuid: 'preview-1', savedAt: '2026-11-03T00:00:00.000Z', dramaUuid: 'drama-1', dramaTitle: '작품 하나', imageUrl: null,
  durationMs: 60_000, contentType: 'PREVIEW', episodeUuid: null, episodeNumber: null, episodeTitle: null,
};
const episode: SavedVideoItem = {
  videoUuid: 'episode-video-1', savedAt: '2026-11-03T00:00:00.000Z', dramaUuid: 'drama-2', dramaTitle: '작품 둘', imageUrl: 'https://cdn.example.test/cover.jpg',
  durationMs: 125_000, contentType: 'EPISODE', episodeUuid: 'episode-1', episodeNumber: 2, episodeTitle: '두 번째',
};
const historyPreview: WatchHistoryItem = { ...preview, lastPlayedAt: '2026-11-03T00:00:00.000Z' };
const historyEpisode: WatchHistoryItem = { ...episode, lastPlayedAt: '2026-11-02T00:00:00.000Z' };

function renderLibrary(initial: ReturnType<typeof useUser> = makeSession(null, 1, true), tab?: string) {
  let setSession!: React.Dispatch<React.SetStateAction<ReturnType<typeof useUser>>>;
  function Route() {
    const [session, updateSession] = React.useState(initial);
    setSession = updateSession;
    jest.mocked(useUser).mockReturnValue(session);
    return <LibraryScreen />;
  }
  const view = renderRouter({
    _layout: () => <Stack screenOptions={{ animation: 'none' }} />,
    index: Route,
    away: () => <Text>다른 화면</Text>,
    login: () => <Text>로그인 화면</Text>,
    'episode/[id]': () => <Text>회차 화면</Text>,
    'preview/[dramaId]/[videoId]': () => <Text>미리보기 화면</Text>,
  }, { initialUrl: tab ? `/?tab=${tab}` : '/' });
  return { ...view, setSession: (next: ReturnType<typeof useUser>) => act(() => setSession(next)) };
}

function installRequests() {
  const saved: Deferred<SavedVideoPage>[] = [];
  const history: Deferred<{ items: WatchHistoryItem[]; page: number; hasNext: boolean }>[] = [];
  const savedPages: number[] = [];
  const historyPages: number[] = [];
  jest.mocked(getSavedVideos).mockImplementation((page = 1) => {
    const request = deferred<SavedVideoPage>(); saved.push(request); savedPages.push(page); return request.promise;
  });
  jest.mocked(getWatchHistory).mockImplementation((page = 1) => {
    const request = deferred<{ items: WatchHistoryItem[]; page: number; hasNext: boolean }>(); history.push(request); historyPages.push(page); return request.promise;
  });
  return { saved, history, savedPages, historyPages };
}

const savedPage = (items: SavedVideoItem[], page = 1, hasNext = false): SavedVideoPage => ({ items, page, hasNext });
const historyPage = (items: WatchHistoryItem[], page = 1, hasNext = false) => ({ items, page, hasNext });

test('saved library waits for restoration, loads cards, and routes preview and episode items', async () => {
  const requests = installRequests();
  const view = renderLibrary();
  expect(screen.getByText('로그인 상태를 확인하고 있어요')).toBeOnTheScreen();
  expect(getSavedVideos).not.toHaveBeenCalled();
  view.setSession(makeSession(makeUser('user-a'), 1, false));
  expect(requests.savedPages).toEqual([1]);
  await act(async () => { requests.saved[0].resolve(savedPage([preview, episode])); await requests.saved[0].promise; });
  expect(await screen.findByRole('button', { name: '작품 하나 미리보기' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '작품 둘 에피소드 2화' })).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: '작품 하나 미리보기' }));
  await screen.findByText('미리보기 화면');
  expect(view.getPathnameWithParams()).toBe('/preview/drama-1/preview-1');
  testRouter.back('/');
  await waitFor(() => expect(requests.savedPages).toEqual([1, 1]));
  await act(async () => { requests.saved[1].resolve(savedPage([preview, episode])); await requests.saved[1].promise; });
  await screen.findByRole('button', { name: '작품 둘 에피소드 2화' });
  fireEvent.press(screen.getByRole('button', { name: '작품 둘 에피소드 2화' }));
  await screen.findByText('회차 화면');
  expect(view.getPathnameWithParams()).toBe('/episode/episode-1?dramaId=drama-2');
  view.unmount();
});

test('saved cards show content kind and accurate short duration, including missing images', async () => {
  const requests = installRequests();
  const view = renderLibrary();
  view.setSession(makeSession(makeUser('user-a'), 1, false));
  await act(async () => { requests.saved[0].resolve(savedPage([preview, episode, { ...preview, videoUuid: 'short', dramaTitle: '짧은 영상', durationMs: 2_000 }])); await requests.saved[0].promise; });
  const first = screen.getByRole('button', { name: '작품 하나 미리보기' });
  expect(first).toBeOnTheScreen();
  const imageCard = screen.getByRole('button', { name: '작품 둘 에피소드 2화' });
  const image = within(imageCard).UNSAFE_getByType(ExpoImage);
  // The native image layout is passed through ExpoImage's style prop; RNTL style matchers require host nodes.
  expect(StyleSheet.flatten(image.props.style)).toMatchObject({ width: 112, height: 63 });
  expect(within(first).getByText('미리보기')).toBeOnTheScreen();
  expect(screen.getByText('1분')).toBeOnTheScreen();
  expect(screen.getByText('2분 5초')).toBeOnTheScreen();
  expect(screen.getByText('2초')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '작품 둘 에피소드 2화' })).toBeOnTheScreen();
  view.unmount();
});

test('saved library separates an empty result from a first page error and retries page one', async () => {
  const requests = installRequests();
  const view = renderLibrary();
  view.setSession(makeSession(makeUser('user-a'), 1, false));
  await act(async () => { requests.saved[0].resolve(savedPage([])); await requests.saved[0].promise; });
  expect(await screen.findByText('저장한 영상이 없어요')).toBeOnTheScreen();
  view.unmount();

  const retryRequests = installRequests();
  const failed = renderLibrary();
  failed.setSession(makeSession(makeUser('user-a'), 2, false));
  await act(async () => { retryRequests.saved[0].reject(new Error('offline')); try { await retryRequests.saved[0].promise; } catch {} });
  expect(await screen.findByText('저장한 영상을 불러오지 못했어요')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '다시 시도' })).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));
  expect(retryRequests.savedPages).toEqual([1, 1]);
  await act(async () => { retryRequests.saved[1].resolve(savedPage([preview])); await retryRequests.saved[1].promise; });
  expect(await screen.findByRole('button', { name: '작품 하나 미리보기' })).toBeOnTheScreen();
  failed.unmount();
});

test('history tab requests history only and routes preview and episode entries', async () => {
  const requests = installRequests();
  const view = renderLibrary();
  fireEvent.press(screen.getByRole('tab', { name: '시청 기록' }));
  view.setSession(makeSession(makeUser('user-a'), 1, false));
  expect(requests.savedPages).toEqual([]);
  expect(requests.historyPages).toEqual([1]);
  await act(async () => { requests.history[0].resolve(historyPage([historyPreview, historyEpisode])); await requests.history[0].promise; });
  expect(await screen.findByRole('button', { name: '작품 하나 미리보기' })).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: '작품 둘 에피소드 2화' }));
  await screen.findByText('회차 화면');
  expect(view.getPathnameWithParams()).toBe('/episode/episode-1?dramaId=drama-2');
  testRouter.back('/');
  await waitFor(() => expect(requests.historyPages).toEqual([1, 1]));
  await act(async () => { requests.history[1].resolve(historyPage([historyPreview, historyEpisode])); await requests.history[1].promise; });
  await screen.findByRole('button', { name: '작품 하나 미리보기' });
  fireEvent.press(screen.getByRole('button', { name: '작품 하나 미리보기' }));
  await screen.findByText('미리보기 화면');
  expect(view.getPathnameWithParams()).toBe('/preview/drama-1/preview-1');
  view.unmount();
});

test('history pagination blocks duplicate loads, retries the same page, deduplicates UUIDs, and stops at the end', async () => {
  const requests = installRequests();
  const view = renderLibrary(undefined, 'history');
  view.setSession(makeSession(makeUser('user-a'), 1, false));
  await act(async () => { requests.history[0].resolve(historyPage([historyPreview], 1, true)); await requests.history[0].promise; });
  const more = screen.getByRole('button', { name: '더 보기' });
  fireEvent.press(more);
  fireEvent.press(more);
  expect(requests.historyPages).toEqual([1, 2]);
  await act(async () => { requests.history[1].reject(new Error('offline')); try { await requests.history[1].promise; } catch {} });
  expect(screen.getByRole('button', { name: '작품 하나 미리보기' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '다시 시도' })).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));
  expect(requests.historyPages).toEqual([1, 2, 2]);
  await act(async () => { requests.history[2].resolve(historyPage([historyPreview, historyEpisode], 2, false)); await requests.history[2].promise; });
  expect(screen.getAllByRole('button', { name: '작품 하나 미리보기' })).toHaveLength(1);
  expect(screen.getByRole('button', { name: '작품 둘 에피소드 2화' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: '더 보기' })).toBeNull();
  view.unmount();
});

test('history distinguishes no records from an initial request failure and retries page one', async () => {
  const requests = installRequests();
  const view = renderLibrary(undefined, 'history');
  fireEvent.press(screen.getByRole('tab', { name: '시청 기록' }));
  view.setSession(makeSession(makeUser('user-a'), 1, false));
  await act(async () => { requests.history[0].resolve(historyPage([])); await requests.history[0].promise; });
  expect(await screen.findByText('시청 기록이 없어요')).toBeOnTheScreen();
  view.unmount();

  const retryRequests = installRequests();
  const failed = renderLibrary(undefined, 'history');
  failed.setSession(makeSession(makeUser('user-b'), 2, false));
  await act(async () => { retryRequests.history[0].reject(new Error('offline')); try { await retryRequests.history[0].promise; } catch {} });
  expect(await screen.findByText('시청 기록을 불러오지 못했어요')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));
  expect(retryRequests.historyPages).toEqual([1, 1]);
  await act(async () => { retryRequests.history[1].resolve(historyPage([historyPreview])); await retryRequests.history[1].promise; });
  expect(await screen.findByRole('button', { name: '작품 하나 미리보기' })).toBeOnTheScreen();
  failed.unmount();
});

test('session changes hide old cards and tab changes discard late responses', async () => {
  const requests = installRequests();
  const view = renderLibrary();
  view.setSession(makeSession(makeUser('user-a'), 1, false));
  await act(async () => { requests.saved[0].resolve(savedPage([preview])); await requests.saved[0].promise; });
  expect(await screen.findByRole('button', { name: '작품 하나 미리보기' })).toBeOnTheScreen();
  view.setSession(makeSession(makeUser('user-b'), 2, false));
  expect(requests.savedPages).toEqual([1, 1]);
  expect(screen.queryByRole('button', { name: '작품 하나 미리보기' })).toBeNull();
  fireEvent.press(screen.getByRole('tab', { name: '시청 기록' }));
  expect(requests.historyPages).toEqual([1]);
  await act(async () => { requests.saved[1].resolve(savedPage([preview])); await requests.saved[1].promise; });
  expect(screen.queryByRole('button', { name: '작품 하나 미리보기' })).toBeNull();
  await act(async () => { requests.history[0].resolve(historyPage([historyEpisode])); await requests.history[0].promise; });
  expect(await screen.findByRole('button', { name: '작품 둘 에피소드 2화' })).toBeOnTheScreen();
  view.unmount();
});

test('focus refresh replaces saved videos and ignores a pending older page', async () => {
  const requests = installRequests();
  const view = renderLibrary();
  view.setSession(makeSession(makeUser('user-a'), 1, false));
  await act(async () => { requests.saved[0].resolve(savedPage([preview], 1, true)); await requests.saved[0].promise; });
  fireEvent.press(screen.getByRole('button', { name: '더 보기' }));
  expect(requests.savedPages).toEqual([1, 2]);

  testRouter.push('/away');
  await screen.findByText('다른 화면');
  await waitFor(() => expect(view.getPathnameWithParams()).toBe('/away'));
  testRouter.back('/');
  await waitFor(() => expect(view.getPathnameWithParams()).toBe('/'));
  await waitFor(() => expect(requests.savedPages).toEqual([1, 2, 1]));
  await act(async () => { requests.saved[1].resolve(savedPage([episode], 2)); await requests.saved[1].promise; });
  expect(screen.getByText('저장한 영상을 불러오는 중이에요')).toBeOnTheScreen();
  await act(async () => { requests.saved[2].resolve(savedPage([episode])); await requests.saved[2].promise; });
  expect(await screen.findByRole('button', { name: '작품 둘 에피소드 2화' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: '작품 하나 미리보기' })).toBeNull();
  view.unmount();
});
