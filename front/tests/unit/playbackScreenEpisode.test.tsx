import { useState } from 'react';
import Slider from '@react-native-community/slider';
import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
import { renderRouter, testRouter } from 'expo-router/testing-library';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { ApiError } from '@/common/http/api';
import { getDramaContent } from '@/features/drama/dramaContent';
import { getEpisodePlayback } from '@/features/playback/episodePlayback';
import { removeSavedVideo, saveVideo } from '@/features/playback/savedVideos';
import { saveWatchProgress } from '@/features/playback/watchProgress';
import { useUser } from '@/features/user/UserProvider';
import type { DramaContent } from '@/features/drama/dramaResponses';
import type { EpisodePlayback } from '@/features/playback/playbackResponses';
import type { User } from '@/features/user/sessionClient';
import { mockVideoPlayers } from '../support/video';
import { PlaybackScreenEpisode } from '@/screens/playbackScreen_episode';

jest.mock('@/features/drama/dramaContent', () => ({ getDramaContent: jest.fn() }));
jest.mock('@/features/playback/episodePlayback', () => ({ getEpisodePlayback: jest.fn() }));
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
const makeSession = (overrides: Partial<Session> = {}): Session => ({
  user: member,
  points: 120,
  accessToken: 'access-test',
  isRestoring: false,
  restoreError: null,
  sessionExpired: false,
  sessionVersion: 1,
  subtitlesEnabled: true,
  autoplayNext: false,
  setUser: jest.fn(),
  setPoints: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  dismissSessionExpired: jest.fn(),
  isCurrentSession: (version) => version === 1,
  setSubtitlesEnabled: jest.fn(),
  setAutoplayNext: jest.fn(),
  ...overrides,
});

const drama: DramaContent = {
  uuid: 'drama-1', slug: 'one', title: '작품 하나', shortDescription: '', synopsis: '',
  productionCompany: null, genres: [],
  imageUrls: { poster: null, posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] },
  previewVideos: [],
  episodes: [],
};
const playback: EpisodePlayback = {
  url: 'https://cdn.example.test/episode.mp4', videoUuid: 'video-1', isSaved: false,
  title: '첫 회', episodeNumber: 1, durationMs: 90_000,
};

let currentSession: Session;
let originalRouterImportMode: string | undefined;
let refreshRoute: (() => void) | undefined;
let playbackRequests: Deferred<EpisodePlayback>[];
let nextPlaybackRequest: number;
let dramaReads: Deferred<DramaContent>[];
let savedWrites: Deferred<void>[];
let deferWrites: boolean;

function EpisodeRoute() {
  const [, rerender] = useState(0);
  refreshRoute = () => rerender((value) => value + 1);
  jest.mocked(useUser).mockReturnValue(currentSession);
  const { id, dramaId } = useLocalSearchParams<{ id: string; dramaId?: string }>();
  return <PlaybackScreenEpisode id={id} dramaId={dramaId} />;
}

function AwayRoute() {
  return <Text>away fixture</Text>;
}

function TestRootLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'none' }} />;
}

function LoginRoute() {
  return <>{/* The pathname is asserted through the memory router result. */}</>;
}

function DramaRoute() {
  return null;
}

function renderEpisode(session = makeSession()) {
  currentSession = session;
  const view = renderRouter({
    _layout: TestRootLayout,
    'episode/[id]': EpisodeRoute,
    login: LoginRoute,
    away: AwayRoute,
    'drama/[id]': DramaRoute,
  }, { initialUrl: '/episode/episode-1?dramaId=drama-1' });
  return view;
}

function setSession(next: Session) {
  act(() => {
    currentSession = next;
    refreshRoute?.();
  });
}

function resolvePlayback(view: ReturnType<typeof renderEpisode>, result: EpisodePlayback = playback) {
  const request = playbackRequests[nextPlaybackRequest++];
  act(() => request.resolve(result));
  return waitFor(() => expect(
    screen.queryByRole('button', { name: '일시정지' }) ?? screen.queryByRole('button', { name: '재생' }),
  ).not.toBeNull()).then(() => {
    const player = mockVideoPlayers[mockVideoPlayers.length - 1];
    act(() => player.emit('playingChange', { isPlaying: player.playing }));
    return view;
  });
}

function emit(player: (typeof mockVideoPlayers)[number], name: 'timeUpdate' | 'sourceLoad' | 'statusChange' | 'playingChange', payload: Record<string, unknown>) {
  act(() => player.emit(name, payload));
}

beforeEach(() => {
  originalRouterImportMode = process.env.EXPO_ROUTER_IMPORT_MODE;
  currentSession = makeSession();
  refreshRoute = undefined;
  playbackRequests = [];
  nextPlaybackRequest = 0;
  dramaReads = [];
  savedWrites = [];
  deferWrites = false;
  jest.mocked(getEpisodePlayback).mockReset();
  jest.mocked(getDramaContent).mockReset();
  jest.mocked(saveVideo).mockReset();
  jest.mocked(removeSavedVideo).mockReset();
  jest.mocked(saveWatchProgress).mockReset();
  jest.mocked(getEpisodePlayback).mockImplementation(() => {
    const request = deferred<EpisodePlayback>();
    playbackRequests.push(request);
    return request.promise;
  });
  jest.mocked(getDramaContent).mockImplementation(() => dramaReads.shift()?.promise ?? Promise.resolve(drama));
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
});

afterEach(() => {
  if (originalRouterImportMode === undefined) delete process.env.EXPO_ROUTER_IMPORT_MODE;
  else process.env.EXPO_ROUTER_IMPORT_MODE = originalRouterImportMode;
  currentSession = makeSession();
  refreshRoute = undefined;
});

test('playback waits for restore and an anonymous paid episode offers an explicit login route', async () => {
  const view = renderEpisode(makeSession({ user: null, isRestoring: true }));
  expect(screen.getByText('영상을 불러오는 중이에요')).toBeOnTheScreen();
  expect(getEpisodePlayback).not.toHaveBeenCalled();

  setSession(makeSession({ user: null, isRestoring: false }));
  await waitFor(() => expect(getEpisodePlayback).toHaveBeenCalledTimes(1));
  act(() => playbackRequests[0].reject(new ApiError(401, 'AUTH_INVALID_TOKEN')));
  await userEvent.setup().press(await screen.findByRole('button', { name: '로그인' }));
  await waitFor(() => expect(view.getPathname()).toBe('/login'));
});

test('playback keeps paid access denied separate from missing media and offers a retry for network failures', async () => {
  const denied = renderEpisode();
  await waitFor(() => expect(getEpisodePlayback).toHaveBeenCalledTimes(1));
  act(() => playbackRequests[0].reject(new ApiError(403, 'EPISODE_ACCESS_DENIED')));
  await userEvent.setup().press(await screen.findByRole('button', { name: '회차 보기' }));
  await waitFor(() => expect(denied.getPathnameWithParams()).toBe('/drama/drama-1?tab=episodes'));
  denied.unmount();

  const missing = renderEpisode();
  await waitFor(() => expect(getEpisodePlayback).toHaveBeenCalledTimes(2));
  act(() => playbackRequests[1].reject(new ApiError(404, 'CONTENT_NOT_FOUND')));
  expect(await screen.findByText('재생할 영상을 찾을 수 없어요')).toBeOnTheScreen();
  missing.unmount();

  const offline = renderEpisode();
  await waitFor(() => expect(getEpisodePlayback).toHaveBeenCalledTimes(3));
  act(() => playbackRequests[2].reject(new Error('offline')));
  await userEvent.setup().press(await screen.findByRole('button', { name: '다시 시도' }));
  await waitFor(() => expect(getEpisodePlayback).toHaveBeenCalledTimes(4));
  act(() => playbackRequests[3].resolve(playback));
  expect(await screen.findByRole('button', { name: '작품 저장' })).toBeOnTheScreen();
  offline.unmount();
});

test('logged in playback records once after real progress and after resumed forward seeking', async () => {
  const view = renderEpisode();
  await resolvePlayback(view);
  const player = mockVideoPlayers[0];
  emit(player, 'statusChange', { status: 'readyToPlay' });
  emit(player, 'sourceLoad', { duration: 90 });
  emit(player, 'timeUpdate', { currentTime: 1 });
  emit(player, 'timeUpdate', { currentTime: 1.5 });
  await waitFor(() => expect(saveWatchProgress).toHaveBeenCalledWith('video-1', { event: 'STARTED', positionMs: 0 }));

  act(() => player.pause());
  emit(player, 'timeUpdate', { currentTime: 2 });
  act(() => player.play());
  emit(player, 'timeUpdate', { currentTime: 3 });
  emit(player, 'timeUpdate', { currentTime: 3.5 });
  await act(async () => Promise.resolve());
  expect(saveWatchProgress).toHaveBeenCalledTimes(1);

  const slider = screen.UNSAFE_getByType(Slider);
  fireEvent(slider, 'slidingStart');
  emit(player, 'timeUpdate', { currentTime: 70 });
  fireEvent(slider, 'slidingComplete', 70);
  emit(player, 'timeUpdate', { currentTime: 70.5 });
  expect(saveWatchProgress).toHaveBeenCalledTimes(1);
  emit(player, 'timeUpdate', { currentTime: 71 });
  await waitFor(() => expect(saveWatchProgress).toHaveBeenCalledWith('video-1', { event: 'COMPLETED', positionMs: 71_000 }));
  emit(player, 'timeUpdate', { currentTime: 20 });
  emit(player, 'timeUpdate', { currentTime: 20.5 });
  await act(async () => Promise.resolve());
  expect(saveWatchProgress).toHaveBeenCalledTimes(2);
});

test('episode bookmark uses the playback video UUID and server saved state', async () => {
  const view = renderEpisode();
  await resolvePlayback(view, { ...playback, isSaved: true });
  expect(screen.getByRole('button', { name: '저장 해제' })).toBeEnabled();
  await userEvent.setup().press(screen.getByRole('button', { name: '저장 해제' }));
  expect(removeSavedVideo).toHaveBeenCalledWith('video-1');
  expect(saveVideo).not.toHaveBeenCalled();
});

test('saving and removing an episode bookmark keep a user-paused player paused', async () => {
  deferWrites = true;
  await resolvePlayback(renderEpisode());
  const player = mockVideoPlayers[0];
  await userEvent.setup().press(screen.getByRole('button', { name: '일시정지' }));
  const playCalls = player.play.mock.calls.length;
  player.currentTime = 31;

  await userEvent.setup().press(screen.getByRole('button', { name: '작품 저장' }));
  expect(screen.getByRole('button', { name: '작품 저장' })).toBeDisabled();
  expect(player.playing).toBe(false);
  act(() => savedWrites[0].resolve());
  expect(await screen.findByRole('button', { name: '저장 해제' })).toBeOnTheScreen();
  expect(player.playing).toBe(false);
  expect(player.play).toHaveBeenCalledTimes(playCalls);
  expect(player.currentTime).toBe(31);

  fireEvent.press(screen.getByRole('button', { name: '저장 해제' }));
  await waitFor(() => expect(removeSavedVideo).toHaveBeenCalledTimes(1));
  expect(player.playing).toBe(false);
  act(() => savedWrites[1].resolve());
  expect(await screen.findByRole('button', { name: '작품 저장' })).toBeOnTheScreen();
  expect(screen.getByText('저장')).toBeOnTheScreen();
  expect(player.playing).toBe(false);
  expect(player.play).toHaveBeenCalledTimes(playCalls);
  expect(player.currentTime).toBe(31);
  expect(mockVideoPlayers[0]).toBe(player);
});

test('episode save locks duplicate taps, preserves saved state on failure, and permits retry', async () => {
  deferWrites = true;
  await resolvePlayback(renderEpisode(), { ...playback, isSaved: true });
  const remove = screen.getByRole('button', { name: '저장 해제' });
  fireEvent.press(remove);
  fireEvent.press(remove);
  expect(removeSavedVideo).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: '저장 해제' })).toBeDisabled();
  act(() => savedWrites[0].reject(new Error('offline')));
  expect(await screen.findByRole('button', { name: '저장 해제' })).toBeOnTheScreen();
  expect(screen.getByRole('alert')).toBeOnTheScreen();

  await userEvent.setup().press(screen.getByRole('button', { name: '저장 해제' }));
  expect(removeSavedVideo).toHaveBeenCalledTimes(2);
  act(() => savedWrites[1].resolve());
  expect(await screen.findByRole('button', { name: '작품 저장' })).toBeOnTheScreen();
});

test('episode focus metadata cannot overwrite pending or completed saves and matches both episode and video UUID', async () => {
  deferWrites = true;
  const view = await resolvePlayback(renderEpisode());

  testRouter.push('/away');
  await screen.findByText('away fixture');
  const mismatchedRead = deferred<DramaContent>();
  dramaReads.push(mismatchedRead);
  testRouter.back('/episode/episode-1?dramaId=drama-1');
  expect(view.getPathnameWithParams()).toBe('/episode/episode-1?dramaId=drama-1');
  await waitFor(() => expect(getDramaContent).toHaveBeenCalledTimes(2));
  const mismatchedDrama: DramaContent = {
    ...drama,
    episodes: [
      { uuid: 'episode-1', episodeNumber: 1, title: null, synopsis: null, durationMs: 90_000, videoUuid: 'another-video', isSaved: true, pricePoints: 0, isUnlocked: true, image: null, watchProgress: null },
      { uuid: 'another-episode', episodeNumber: 2, title: null, synopsis: null, durationMs: 90_000, videoUuid: 'video-1', isSaved: true, pricePoints: 0, isUnlocked: true, image: null, watchProgress: null },
      { uuid: 'episode-1', episodeNumber: 1, title: null, synopsis: null, durationMs: 90_000, videoUuid: 'video-1', isSaved: false, pricePoints: 0, isUnlocked: true, image: null, watchProgress: null },
    ],
  };
  await act(async () => {
    mismatchedRead.resolve(mismatchedDrama);
    await mismatchedRead.promise;
  });
  expect(screen.getByRole('button', { name: '작품 저장' })).toBeOnTheScreen();

  testRouter.push('/away');
  await screen.findByText('away fixture');
  const pendingRead = deferred<DramaContent>();
  dramaReads.push(pendingRead);
  testRouter.back('/episode/episode-1?dramaId=drama-1');
  expect(view.getPathnameWithParams()).toBe('/episode/episode-1?dramaId=drama-1');
  await waitFor(() => expect(getDramaContent).toHaveBeenCalledTimes(3));
  await userEvent.setup().press(screen.getByRole('button', { name: '작품 저장' }));
  const metadata = { ...mismatchedDrama, episodes: mismatchedDrama.episodes.map((episode) => ({ ...episode,
    isSaved: episode.uuid === 'episode-1' && episode.videoUuid === 'video-1' })) };
  await act(async () => {
    pendingRead.resolve(metadata);
    await pendingRead.promise;
  });
  expect(screen.getByRole('button', { name: '작품 저장' })).toBeOnTheScreen();

  testRouter.push('/away');
  await screen.findByText('away fixture');
  const staleRead = deferred<DramaContent>();
  dramaReads.push(staleRead);
  testRouter.back('/episode/episode-1?dramaId=drama-1');
  expect(view.getPathnameWithParams()).toBe('/episode/episode-1?dramaId=drama-1');
  await waitFor(() => expect(getDramaContent).toHaveBeenCalledTimes(4));
  act(() => savedWrites[0].resolve());
  expect(await screen.findByRole('button', { name: '저장 해제' })).toBeOnTheScreen();
  await act(async () => {
    staleRead.resolve({ ...drama, episodes: [
      { uuid: 'episode-1', episodeNumber: 1, title: null, synopsis: null, durationMs: 90_000, videoUuid: 'video-1', isSaved: false, pricePoints: 0, isUnlocked: true, image: null, watchProgress: null },
    ] });
    await staleRead.promise;
  });
  expect(await screen.findByRole('button', { name: '저장 해제' })).toBeOnTheScreen();
});

test('anonymous episode saves open login, and a late write after account change is ignored', async () => {
  const anonymous = renderEpisode(makeSession({ user: null }));
  await resolvePlayback(anonymous);
  await userEvent.setup().press(screen.getByRole('button', { name: '작품 저장' }));
  await waitFor(() => expect(anonymous.getPathname()).toBe('/login'));
  expect(saveVideo).not.toHaveBeenCalled();
  anonymous.unmount();

  deferWrites = true;
  const authenticated = renderEpisode();
  await resolvePlayback(authenticated);
  await userEvent.setup().press(screen.getByRole('button', { name: '작품 저장' }));
  expect(saveVideo).toHaveBeenCalledWith('video-1', 'EPISODE');
  const requestCountBeforeAccountChange = jest.mocked(getEpisodePlayback).mock.calls.length;
  setSession(makeSession({ user: { uuid: 'user-2', displayName: null, accountType: 'MEMBER' }, sessionVersion: 2,
    isCurrentSession: (version) => version === 2 }));
  await waitFor(() => expect(getEpisodePlayback).toHaveBeenCalledTimes(requestCountBeforeAccountChange + 1));
  expect(screen.getByText('영상을 불러오는 중이에요')).toBeOnTheScreen();
  act(() => savedWrites[0].resolve());
  act(() => playbackRequests[requestCountBeforeAccountChange].resolve({ ...playback, isSaved: false }));
  expect(await screen.findByRole('button', { name: '작품 저장' })).toBeOnTheScreen();
});

test('anonymous, buffered, blurred, and expired-session playback never creates progress writes', async () => {
  const anonymous = renderEpisode(makeSession({ user: null }));
  await resolvePlayback(anonymous);
  const anonymousPlayer = mockVideoPlayers[0];
  emit(anonymousPlayer, 'statusChange', { status: 'readyToPlay' });
  emit(anonymousPlayer, 'timeUpdate', { currentTime: 1 });
  emit(anonymousPlayer, 'timeUpdate', { currentTime: 1.5 });
  expect(saveWatchProgress).not.toHaveBeenCalled();
  anonymous.unmount();

  const view = renderEpisode();
  await resolvePlayback(view);
  const player = mockVideoPlayers[mockVideoPlayers.length - 1];
  emit(player, 'statusChange', { status: 'readyToPlay' });
  emit(player, 'timeUpdate', { currentTime: 3 });
  emit(player, 'statusChange', { status: 'loading' });
  emit(player, 'statusChange', { status: 'readyToPlay' });
  emit(player, 'timeUpdate', { currentTime: 20 });
  emit(player, 'timeUpdate', { currentTime: 20.5 });
  await waitFor(() => expect(saveWatchProgress).toHaveBeenCalledTimes(1));
  expect(saveWatchProgress).toHaveBeenCalledWith('video-1', { event: 'STARTED', positionMs: 0 });

  testRouter.push('/away');
  await screen.findByText('away fixture');
  emit(player, 'timeUpdate', { currentTime: 21 });
  emit(player, 'timeUpdate', { currentTime: 21.5 });
  testRouter.back('/episode/episode-1?dramaId=drama-1');
  expect(view.getPathnameWithParams()).toBe('/episode/episode-1?dramaId=drama-1');
  setSession(makeSession({ user: null, sessionExpired: true, sessionVersion: 2,
    isCurrentSession: (version) => version === 2 }));
  await waitFor(() => expect(getEpisodePlayback).toHaveBeenCalledTimes(3));
  act(() => playbackRequests[2].resolve(playback));
  expect(await screen.findByRole('button', { name: '작품 저장' })).toBeOnTheScreen();
  emit(player, 'timeUpdate', { currentTime: 22 });
  emit(player, 'timeUpdate', { currentTime: 22.5 });
  await act(async () => Promise.resolve());
  expect(saveWatchProgress).toHaveBeenCalledTimes(1);
});
