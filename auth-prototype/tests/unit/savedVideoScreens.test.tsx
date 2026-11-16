import { useState } from 'react';
import Slider from '@react-native-community/slider';
import { Text } from 'react-native';
import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
import { renderRouter, testRouter } from 'expo-router/testing-library';
import { Stack, useLocalSearchParams } from 'expo-router';
import { getDramaContent, getDramaList, getGenres } from '@/features/drama/dramaContent';
import type { DramaContent } from '@/features/drama/dramaResponses';
import { getHomeCollection } from '@/features/home/homeContent';
import type { HomeCollection, HomeCollectionDrama } from '@/features/home/homeResponses';
import { getPreviewPlayback } from '@/features/playback/previewPlayback';
import type { PreviewPlayback } from '@/features/playback/playbackResponses';
import { removeSavedVideo, saveVideo } from '@/features/playback/savedVideos';
import { saveWatchProgress } from '@/features/playback/watchProgress';
import { useUser } from '@/features/user/UserProvider';
import type { User } from '@/features/user/sessionClient';
import { HomeScreen } from '@/screens/HomeScreen';
import { PlaybackScreenPreview } from '@/screens/playbackScreen_preview';
import { mockVideoPlayers } from '../support/video';

jest.mock('@/features/drama/dramaContent', () => ({ getDramaContent: jest.fn(), getDramaList: jest.fn(), getGenres: jest.fn() }));
jest.mock('@/features/home/homeContent', () => ({ getHomeCollection: jest.fn() }));
jest.mock('@/features/playback/previewPlayback', () => ({ getPreviewPlayback: jest.fn() }));
jest.mock('@/features/playback/savedVideos', () => ({ saveVideo: jest.fn(), removeSavedVideo: jest.fn() }));
jest.mock('@/features/playback/watchProgress', () => {
  const actual = jest.requireActual<typeof import('@/features/playback/watchProgress')>('@/features/playback/watchProgress');
  return { ...actual, saveWatchProgress: jest.fn() };
});
jest.mock('@/features/user/UserProvider', () => ({ useUser: jest.fn() }));

type Session = ReturnType<typeof useUser>;
type Deferred<T> = { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void };

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const member: User = { uuid: 'user-1', displayName: null, accountType: 'MEMBER' };
function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    user: member, points: 120, accessToken: 'access-test', isRestoring: false,
    restoreError: null, sessionExpired: false, sessionVersion: 1,
    subtitlesEnabled: true, autoplayNext: false, setUser: jest.fn(), setPoints: jest.fn(),
    login: jest.fn(), logout: jest.fn(), dismissSessionExpired: jest.fn(),
    isCurrentSession: (version) => version === 1,
    setSubtitlesEnabled: jest.fn(), setAutoplayNext: jest.fn(), ...overrides,
  };
}

const drama: DramaContent = {
  uuid: 'drama-1', slug: 'one', title: '추천 작품', shortDescription: '', synopsis: '',
  productionCompany: null, genres: [{ id: 1, code: 'DRAMA', name: '드라마' }],
  imageUrls: { poster: null, posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] },
  previewVideos: [
    { uuid: 'preview-other', storageKey: 'other.mp4', durationMs: 60_000, isSaved: false },
    { uuid: 'preview-exact', storageKey: 'exact.mp4', durationMs: 60_000, isSaved: true },
  ],
  episodes: [],
};
const previewPlayback: PreviewPlayback = {
  url: 'https://cdn.example.test/preview.mp4', videoUuid: 'preview-exact', isSaved: true, durationMs: 60_000,
};

let currentSession: Session;
let originalRouterImportMode: string | undefined;
let refreshRoute: (() => void) | undefined;
let dramaReads: Deferred<DramaContent>[];
let previewReads: Deferred<PreviewPlayback>[];
let nextDramaRead: number;
let nextPreviewRead: number;
let savedWrites: Deferred<void>[];
let deferWrites: boolean;

function PreviewRoute() {
  const [, rerender] = useState(0);
  refreshRoute = () => rerender((value) => value + 1);
  jest.mocked(useUser).mockReturnValue(currentSession);
  const { dramaId, videoId } = useLocalSearchParams<{ dramaId: string; videoId: string }>();
  return <PlaybackScreenPreview dramaId={dramaId} videoId={videoId} />;
}

function PreviewTarget() {
  const { dramaId, videoId } = useLocalSearchParams<{ dramaId: string; videoId: string }>();
  return <Text>{`${dramaId}:${videoId}`}</Text>;
}

function AwayRoute() { return <Text>away fixture</Text>; }
function TestRootLayout() { return <Stack screenOptions={{ headerShown: false, animation: 'none' }} />; }
function HomeRoute() {
  jest.mocked(useUser).mockReturnValue(currentSession);
  return <HomeScreen />;
}

function renderPreview(session = makeSession()) {
  currentSession = session;
  return renderRouter({
    _layout: TestRootLayout,
    'preview/[dramaId]/[videoId]': PreviewRoute,
    'target/[dramaId]/[videoId]': PreviewTarget,
    login: AwayRoute,
    away: AwayRoute,
  }, { initialUrl: '/preview/drama-1/preview-exact' });
}

function renderHome(session = makeSession()) {
  currentSession = session;
  return renderRouter({
    _layout: TestRootLayout,
    index: HomeRoute,
    'preview/[dramaId]/[videoId]': PreviewTarget,
    login: AwayRoute,
    away: AwayRoute,
  });
}

function setSession(next: Session) {
  act(() => {
    currentSession = next;
    refreshRoute?.();
  });
}

async function loadPreview() {
  await waitFor(() => {
    expect(getDramaContent).toHaveBeenCalled();
    expect(getPreviewPlayback).toHaveBeenCalled();
  });
  const dramaRead = dramaReads[nextDramaRead++];
  const previewRead = previewReads[nextPreviewRead++];
  await act(async () => {
    dramaRead?.resolve(drama);
    previewRead?.resolve(previewPlayback);
  });
  await waitFor(() => expect(
    screen.queryByRole('button', { name: '일시정지' }) ?? screen.queryByRole('button', { name: '재생' }),
  ).not.toBeNull());
  const player = mockVideoPlayers[mockVideoPlayers.length - 1];
  act(() => player.emit('playingChange', { isPlaying: true }));
  return player;
}

function emit(player: (typeof mockVideoPlayers)[number], name: 'timeUpdate' | 'sourceLoad' | 'statusChange' | 'playingChange', payload: Record<string, unknown>) {
  act(() => player.emit(name, payload));
}

const emptyCollection = (code: string): HomeCollection => ({ code, title: code, description: null, dramas: [] });
const hero = (uuid: string, previewId: string | null): HomeCollectionDrama => ({
  uuid, displayOrder: 1, slug: uuid, title: `작품 ${uuid}`, shortDescription: '소개', productionCompany: null,
  genres: [], imageUrls: { poster: null, posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] },
  previewVideos: previewId ? [{ uuid: previewId, storageKey: '', durationMs: 60_000, isSaved: false }] : [],
  publishedEpisodeCount: 1, freeEpisodeCount: 1,
});

let featuredQueue: HomeCollection[];

beforeEach(() => {
  originalRouterImportMode = process.env.EXPO_ROUTER_IMPORT_MODE;
  currentSession = makeSession();
  refreshRoute = undefined;
  dramaReads = [];
  previewReads = [];
  nextDramaRead = 0;
  nextPreviewRead = 0;
  savedWrites = [];
  deferWrites = false;
  featuredQueue = [];
  jest.mocked(getDramaContent).mockReset();
  jest.mocked(getDramaList).mockReset();
  jest.mocked(getGenres).mockReset();
  jest.mocked(getHomeCollection).mockReset();
  jest.mocked(getPreviewPlayback).mockReset();
  jest.mocked(saveVideo).mockReset();
  jest.mocked(removeSavedVideo).mockReset();
  jest.mocked(saveWatchProgress).mockReset();
  jest.mocked(getDramaContent).mockImplementation(() => {
    const request = deferred<DramaContent>();
    dramaReads.push(request);
    return request.promise;
  });
  jest.mocked(getPreviewPlayback).mockImplementation(() => {
    const request = deferred<PreviewPlayback>();
    previewReads.push(request);
    return request.promise;
  });
  jest.mocked(saveVideo).mockImplementation(() => {
    if (!deferWrites) return Promise.resolve();
    const request = deferred<void>();
    savedWrites.push(request);
    return request.promise;
  });
  jest.mocked(removeSavedVideo).mockImplementation(() => {
    if (!deferWrites) return Promise.resolve();
    const request = deferred<void>();
    savedWrites.push(request);
    return request.promise;
  });
  jest.mocked(saveWatchProgress).mockResolvedValue(undefined);
  jest.mocked(getHomeCollection).mockImplementation((code) => {
    if (code === 'HOME_FEATURED' && featuredQueue.length) return Promise.resolve(featuredQueue.shift()!);
    return Promise.resolve(emptyCollection(code));
  });
  jest.mocked(getDramaList).mockResolvedValue({ items: [], page: 1, hasNext: false });
  jest.mocked(getGenres).mockResolvedValue([]);
});

afterEach(() => {
  if (originalRouterImportMode === undefined) delete process.env.EXPO_ROUTER_IMPORT_MODE;
  else process.env.EXPO_ROUTER_IMPORT_MODE = originalRouterImportMode;
  currentSession = makeSession();
  refreshRoute = undefined;
});

test('preview save uses the selected route video and focus refresh preserves player and position', async () => {
  const view = renderPreview();
  const player = await loadPreview();
  expect(getPreviewPlayback).toHaveBeenCalledWith('drama-1', 'preview-exact');
  expect(mockVideoPlayers).toHaveLength(1);
  expect(screen.getByRole('button', { name: '저장 해제' })).toBeEnabled();
  await userEvent.setup().press(screen.getByRole('button', { name: '저장 해제' }));
  expect(removeSavedVideo).toHaveBeenCalledWith('preview-exact');
  expect(saveVideo).not.toHaveBeenCalled();
  expect(await screen.findByRole('button', { name: '작품 저장' })).toBeOnTheScreen();

  player.currentTime = 23;
  testRouter.push('/away');
  await screen.findByText('away fixture');
  testRouter.back('/preview/drama-1/preview-exact');
  const refreshedDrama = { ...drama, previewVideos: drama.previewVideos.map((video) => ({ ...video, isSaved: true })) };
  await waitFor(() => expect(getDramaContent).toHaveBeenCalledTimes(2));
  await act(async () => {
    dramaReads[1].resolve(refreshedDrama);
  });
  expect(await screen.findByRole('button', { name: '저장 해제' })).toBeOnTheScreen();
  expect(getPreviewPlayback).toHaveBeenCalledTimes(1);
  expect(mockVideoPlayers).toHaveLength(1);
  expect(mockVideoPlayers[0]).toBe(player);
  expect(player.currentTime).toBe(23);
  expect(view.getPathnameWithParams()).toBe('/preview/drama-1/preview-exact');
});

test('preview records the selected video once using server duration after playback advances', async () => {
  renderPreview();
  const player = await loadPreview();
  emit(player, 'statusChange', { status: 'readyToPlay' });
  emit(player, 'sourceLoad', { duration: 90 });
  expect(saveWatchProgress).not.toHaveBeenCalled();
  emit(player, 'timeUpdate', { currentTime: 0 });
  for (let second = 1; second <= 39; second += 1) emit(player, 'timeUpdate', { currentTime: second });
  await waitFor(() => expect(saveWatchProgress).toHaveBeenCalledWith('preview-exact', { event: 'STARTED', positionMs: 0 }));
  expect(saveWatchProgress).toHaveBeenCalledTimes(1);

  emit(player, 'timeUpdate', { currentTime: 40 });
  emit(player, 'timeUpdate', { currentTime: 41 });
  await waitFor(() => expect(saveWatchProgress).toHaveBeenCalledWith('preview-exact', { event: 'COMPLETED', positionMs: 40_000 }));
  expect(saveWatchProgress).toHaveBeenCalledTimes(2);
});

test('preview ignores paused, sought, and blurred time updates while keeping player controls', async () => {
  const view = renderPreview();
  const player = await loadPreview();
  emit(player, 'statusChange', { status: 'readyToPlay' });
  act(() => player.pause());
  emit(player, 'timeUpdate', { currentTime: 1 });
  expect(saveWatchProgress).not.toHaveBeenCalled();
  act(() => player.play());
  emit(player, 'timeUpdate', { currentTime: 0 });
  emit(player, 'timeUpdate', { currentTime: 1 });
  await waitFor(() => expect(saveWatchProgress).toHaveBeenCalledWith('preview-exact', { event: 'STARTED', positionMs: 0 }));

  const slider = screen.UNSAFE_getByType(Slider);
  fireEvent(slider, 'slidingStart');
  emit(player, 'timeUpdate', { currentTime: 40 });
  expect(saveWatchProgress).toHaveBeenCalledTimes(1);
  fireEvent(slider, 'slidingComplete', 40);
  emit(player, 'timeUpdate', { currentTime: 40.5 });
  expect(saveWatchProgress).toHaveBeenCalledTimes(1);
  emit(player, 'timeUpdate', { currentTime: 41 });
  await waitFor(() => expect(saveWatchProgress).toHaveBeenCalledTimes(2));

  testRouter.push('/preview/drama-1/preview-next');
  await waitFor(() => expect(getPreviewPlayback).toHaveBeenCalledTimes(2));
  await act(async () => {
    dramaReads[1].resolve({ ...drama, previewVideos: [...drama.previewVideos, { uuid: 'preview-next', storageKey: 'next.mp4', durationMs: 60_000, isSaved: false }] });
    previewReads[1].resolve({ ...previewPlayback, videoUuid: 'preview-next', isSaved: false });
  });
  nextDramaRead = 2;
  nextPreviewRead = 2;
  await waitFor(() => expect(view.getPathnameWithParams()).toBe('/preview/drama-1/preview-next'));
  const nextPlayer = mockVideoPlayers[mockVideoPlayers.length - 1];
  emit(nextPlayer, 'statusChange', { status: 'readyToPlay' });
  emit(nextPlayer, 'timeUpdate', { currentTime: 0 });
  emit(nextPlayer, 'timeUpdate', { currentTime: 1 });
  await waitFor(() => expect(saveWatchProgress).toHaveBeenCalledWith('preview-next', { event: 'STARTED', positionMs: 0 }));

  testRouter.push('/away');
  emit(nextPlayer, 'timeUpdate', { currentTime: 2 });
  expect(saveWatchProgress).toHaveBeenCalledTimes(3);
});

test('preview bookmark save and removal keep a user-paused player paused', async () => {
  deferWrites = true;
  renderPreview();
  const player = await loadPreview();
  await userEvent.setup().press(screen.getByRole('button', { name: '일시정지' }));
  const playCalls = player.play.mock.calls.length;
  const playerCount = mockVideoPlayers.length;
  player.currentTime = 19;

  fireEvent.press(screen.getByRole('button', { name: '저장 해제' }));
  await waitFor(() => expect(removeSavedVideo).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('button', { name: '저장 해제' })).toBeDisabled();
  expect(player.playing).toBe(false);
  act(() => savedWrites[0].resolve());
  expect(await screen.findByRole('button', { name: '작품 저장' })).toBeOnTheScreen();
  expect(player.playing).toBe(false);
  expect(player.play).toHaveBeenCalledTimes(playCalls);
  expect(mockVideoPlayers).toHaveLength(playerCount);
  expect(player.currentTime).toBe(19);

  fireEvent.press(screen.getByRole('button', { name: '작품 저장' }));
  await waitFor(() => expect(saveVideo).toHaveBeenCalledTimes(1));
  act(() => savedWrites[1].resolve());
  expect(await screen.findByRole('button', { name: '저장 해제' })).toBeOnTheScreen();
  expect(player.playing).toBe(false);
  expect(player.play).toHaveBeenCalledTimes(playCalls);
  expect(mockVideoPlayers).toHaveLength(playerCount);
  expect(player.currentTime).toBe(19);
});

test('preview save locks duplicate taps, preserves state on failure, and permits retry', async () => {
  deferWrites = true;
  renderPreview();
  await loadPreview();
  const remove = screen.getByRole('button', { name: '저장 해제' });
  fireEvent.press(remove);
  fireEvent.press(remove);
  expect(removeSavedVideo).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: '저장 해제' })).toBeDisabled();
  act(() => savedWrites[0].reject(new Error('offline')));
  expect(await screen.findByRole('alert')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '저장 해제' })).toBeEnabled();
  fireEvent.press(screen.getByRole('button', { name: '저장 해제' }));
  await waitFor(() => expect(removeSavedVideo).toHaveBeenCalledTimes(2));
  act(() => savedWrites[1].resolve());
  expect(await screen.findByRole('button', { name: '작품 저장' })).toBeOnTheScreen();
});

test('preview requires login for anonymous writes, disables during restoration, and ignores late writes after route or account change', async () => {
  const anonymous = renderPreview(makeSession({ user: null }));
  await loadPreview();
  await userEvent.setup().press(screen.getByRole('button', { name: '저장 해제' }));
  await waitFor(() => expect(anonymous.getPathname()).toBe('/login'));
  expect(saveVideo).not.toHaveBeenCalled();
  anonymous.unmount();

  currentSession = makeSession({ isRestoring: true });
  const restoring = renderPreview(currentSession);
  expect(screen.getByText('영상을 불러오는 중이에요')).toBeOnTheScreen();
  expect(getPreviewPlayback).toHaveBeenCalledTimes(1);
  restoring.unmount();

  deferWrites = true;
  const routeChange = renderPreview();
  await loadPreview();
  fireEvent.press(screen.getByRole('button', { name: '저장 해제' }));
  await waitFor(() => expect(removeSavedVideo).toHaveBeenCalledTimes(1));
  testRouter.push('/preview/drama-1/preview-next');
  await waitFor(() => expect(getPreviewPlayback).toHaveBeenCalledTimes(3));
  await act(async () => {
    dramaReads[2].resolve({ ...drama, previewVideos: [...drama.previewVideos, { uuid: 'preview-next', storageKey: 'next.mp4', durationMs: 60_000, isSaved: false }] });
    previewReads[2].resolve({ ...previewPlayback, videoUuid: 'preview-next', isSaved: false });
  });
  nextDramaRead = 3;
  nextPreviewRead = 3;
  act(() => savedWrites[0].resolve());
  await waitFor(() => expect(routeChange.getPathnameWithParams()).toBe('/preview/drama-1/preview-next'));
  expect(await screen.findByRole('button', { name: '작품 저장' })).toBeOnTheScreen();
  routeChange.unmount();

  const accountChange = renderPreview();
  await loadPreview();
  fireEvent.press(screen.getByRole('button', { name: '저장 해제' }));
  await waitFor(() => expect(removeSavedVideo).toHaveBeenCalledTimes(2));
  setSession(makeSession({ user: { uuid: 'user-2', displayName: null, accountType: 'MEMBER' }, sessionVersion: 2,
    isCurrentSession: (version) => version === 2 }));
  act(() => savedWrites[1].resolve());
  await waitFor(() => expect(getPreviewPlayback).toHaveBeenCalledTimes(5));
  await act(async () => {
    dramaReads[4].resolve(drama);
    previewReads[4].resolve(previewPlayback);
  });
  expect(await screen.findByRole('button', { name: '저장 해제' })).toBeOnTheScreen();
  expect(accountChange.getPathnameWithParams()).toBe('/preview/drama-1/preview-exact');
});

test('home hero opens the current first preview for members and anonymous users without save writes', async () => {
  featuredQueue.push({ ...emptyCollection('HOME_FEATURED'), dramas: [hero('drama-hero', 'hero-preview')] });
  const memberView = renderHome();
  await screen.findByRole('button', { name: '분위기 미리보기' });
  await userEvent.setup().press(await screen.findByRole('button', { name: '분위기 미리보기' }));
  await waitFor(() => expect(memberView.getPathnameWithParams()).toBe('/preview/drama-hero/hero-preview'));
  expect(screen.getByText('drama-hero:hero-preview')).toBeOnTheScreen();
  expect(saveVideo).not.toHaveBeenCalled();
  memberView.unmount();

  featuredQueue.push({ ...emptyCollection('HOME_FEATURED'), dramas: [hero('drama-hero', 'hero-preview')] });
  const anonymousView = renderHome(makeSession({ user: null }));
  await userEvent.setup().press(await screen.findByRole('button', { name: '분위기 미리보기' }));
  await waitFor(() => expect(anonymousView.getPathnameWithParams()).toBe('/preview/drama-hero/hero-preview'));
  expect(saveVideo).not.toHaveBeenCalled();
});

test('home hero without a preview is disabled and changing the hero selects its own first preview', async () => {
  featuredQueue.push({ ...emptyCollection('HOME_FEATURED'), dramas: [hero('drama-empty', null)] });
  const noPreview = renderHome();
  expect(await screen.findByRole('button', { name: '분위기 미리보기' })).toBeDisabled();
  expect(noPreview.getPathname()).toBe('/');
  noPreview.unmount();

  featuredQueue.push({ ...emptyCollection('HOME_FEATURED'), dramas: [hero('drama-hero', 'hero-preview'), hero('drama-next', 'next-preview')] });
  const changingHero = renderHome();
  await screen.findByRole('button', { name: '분위기 미리보기' });
  await userEvent.setup().press(screen.getByRole('button', { name: '작품 drama-next 추천 보기' }));
  await userEvent.setup().press(screen.getByRole('button', { name: '분위기 미리보기' }));
  await waitFor(() => expect(changingHero.getPathnameWithParams()).toBe('/preview/drama-next/next-preview'));
  expect(screen.getByText('drama-next:next-preview')).toBeOnTheScreen();
});

test('home does not request personalized collections during session restoration', async () => {
  renderHome(makeSession({ isRestoring: true }));
  expect(getHomeCollection).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: '분위기 미리보기' })).toBeNull();
});
