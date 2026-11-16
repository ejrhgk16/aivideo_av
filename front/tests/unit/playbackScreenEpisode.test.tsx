import { useState } from 'react';
import Slider from '@react-native-community/slider';
import { act, fireEvent, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import { renderRouter, testRouter } from 'expo-router/testing-library';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Animated, Modal, Platform, Text } from 'react-native';
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
  preferredSubtitleLanguage: 'ko',
  autoplayNext: false,
  setUser: jest.fn(),
  setPoints: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  dismissSessionExpired: jest.fn(),
  isCurrentSession: (version) => version === 1,
  setSubtitlesEnabled: jest.fn(),
  setPreferredSubtitleLanguage: jest.fn(),
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
const englishSubtitle = { languageCode: 'en', format: 'SRT' as const, url: 'https://signed.example.test/en.srt' };
const koreanSubtitle = { languageCode: 'ko', format: 'VTT' as const, url: 'https://signed.example.test/ko.vtt' };

let currentSession: Session;
let originalRouterImportMode: string | undefined;
let refreshRoute: (() => void) | undefined;
let playbackRequests: Deferred<EpisodePlayback>[];
let nextPlaybackRequest: number;
let dramaReads: Deferred<DramaContent>[];
let savedWrites: Deferred<void>[];
let deferWrites: boolean;
let originalFetch: typeof fetch;
type AnimationCallback = (result: { finished: boolean }) => void;
const animations: AnimationCallback[] = [];

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
  return <Text>로그인 화면</Text>;
}

function DramaRoute() {
  return null;
}

function renderEpisode(session = makeSession()) {
  currentSession = session;
  const view = renderRouter({
    _layout: TestRootLayout,
    'episode/[id]': EpisodeRoute,
    'auth/login': LoginRoute,
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

function makeSessionWithPreference(overrides: Partial<Session> = {}): Session {
  let current = makeSession(overrides);
  const setPreferredSubtitleLanguage = jest.fn((languageCode: string) => {
    current = { ...current, preferredSubtitleLanguage: languageCode };
    setSession(current);
  });
  current = { ...current, setPreferredSubtitleLanguage };
  return current;
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
  animations.length = 0;
  originalFetch = globalThis.fetch;
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
  jest.spyOn(Animated, 'timing').mockImplementation((_value, _config) => ({
    start: (callback?: AnimationCallback) => { if (callback) animations.push(callback); },
    stop: jest.fn(),
  } as unknown as Animated.CompositeAnimation));
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalRouterImportMode === undefined) delete process.env.EXPO_ROUTER_IMPORT_MODE;
  else process.env.EXPO_ROUTER_IMPORT_MODE = originalRouterImportMode;
  currentSession = makeSession();
  refreshRoute = undefined;
});

function mockSubtitleFiles(files: Record<string, string>) {
  const request = jest.fn(async (input: RequestInfo | URL) => ({
    ok: true,
    text: async () => files[String(input)],
  } as Response)) as unknown as typeof fetch;
  globalThis.fetch = request;
  return request;
}

test('playback waits for restore and an anonymous paid episode offers an explicit login route', async () => {
  const view = renderEpisode(makeSession({ user: null, isRestoring: true }));
  expect(screen.getByText('영상을 불러오는 중이에요')).toBeOnTheScreen();
  expect(getEpisodePlayback).not.toHaveBeenCalled();

  setSession(makeSession({ user: null, isRestoring: false }));
  await waitFor(() => expect(getEpisodePlayback).toHaveBeenCalledTimes(1));
  act(() => playbackRequests[0].reject(new ApiError(401, 'AUTH_INVALID_TOKEN')));
  await userEvent.setup().press(await screen.findByRole('button', { name: '로그인' }));
  expect(await screen.findByText('로그인 화면')).toBeOnTheScreen();
  expect(view.getPathname()).toBe('/auth/login');
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
  expect(await screen.findByText('로그인 화면')).toBeOnTheScreen();
  expect(anonymous.getPathname()).toBe('/auth/login');
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

test('anonymous locked next episode opens the auth login route from its unlock dialog', async () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(Platform, 'OS');
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  try {
    jest.mocked(getDramaContent).mockResolvedValueOnce({
      ...drama,
      episodes: [
        { uuid: 'episode-1', episodeNumber: 1, title: null, synopsis: null, durationMs: 90_000, videoUuid: 'video-1', isSaved: false, pricePoints: 0, isUnlocked: true, image: null, watchProgress: null },
        { uuid: 'episode-2', episodeNumber: 2, title: null, synopsis: null, durationMs: 90_000, videoUuid: 'video-2', isSaved: false, pricePoints: 50, isUnlocked: false, image: null, watchProgress: null },
      ],
    });
    const view = await resolvePlayback(renderEpisode(makeSession({ user: null, points: null })));
    await waitFor(() => expect(screen.getByRole('button', { name: '다음 화' })).toBeEnabled());
    await userEvent.setup().press(screen.getByRole('button', { name: '다음 화' }));
    const nativeModal = screen.UNSAFE_getAllByType(Modal).find((modal) =>
      within(modal).queryByRole('button', { name: '로그인하기' }) !== null,
    );
    if (!nativeModal) throw new Error('Episode unlock modal was not rendered');
    await userEvent.setup().press(await screen.findByRole('button', { name: '로그인하기' }));
    const finishAnimation = animations.shift();
    if (!finishAnimation) throw new Error('Expected the unlock dialog close animation');
    act(() => finishAnimation({ finished: true }));
    fireEvent(nativeModal, 'dismiss');
    expect(await screen.findByText('로그인 화면')).toBeOnTheScreen();
    expect(view.getPathname()).toBe('/auth/login');
  } finally {
    if (originalPlatform) Object.defineProperty(Platform, 'OS', originalPlatform);
  }
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

test('remembers a language choice, updates captions on seek, and keeps the line while paused', async () => {
  const session = makeSessionWithPreference();
  const fetchMock = mockSubtitleFiles({
    [englishSubtitle.url]: '1\n00:00:00,000 --> 00:00:02,000\nHello\n\n2\n00:00:02,000 --> 00:00:04,000\nWorld',
    [koreanSubtitle.url]: 'WEBVTT\n\n00:00.000 --> 00:04.000\n안녕하세요',
  });
  const view = renderEpisode(session);
  await resolvePlayback(view, { ...playback, subtitles: [englishSubtitle, koreanSubtitle] });
  const player = mockVideoPlayers[mockVideoPlayers.length - 1];
  expect(player.timeUpdateEventInterval).toBe(0.1);
  emit(player, 'timeUpdate', { currentTime: 1.5 });
  expect(await screen.findByText('안녕하세요')).toBeOnTheScreen();
  expect(fetchMock).toHaveBeenCalledWith(koreanSubtitle.url, { signal: expect.any(AbortSignal) });

  await userEvent.setup().press(screen.getByRole('button', { name: '더보기 설정' }));
  expect(screen.getByRole('button', { name: '한국어', selected: true })).toBeOnTheScreen();
  expect(screen.getByRole('switch', { name: '자막 표시' })).toBeChecked();
  await userEvent.setup().press(screen.getByRole('button', { name: 'English' }));
  expect(session.setPreferredSubtitleLanguage).toHaveBeenCalledWith('en');
  expect(await screen.findByText('Hello')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'English', selected: true })).toBeOnTheScreen();

  await userEvent.setup().press(screen.getByRole('button', { name: '더보기 메뉴 닫기' }));
  await userEvent.setup().press(screen.getByRole('button', { name: '일시정지' }));
  expect(screen.getByText('Hello')).toBeOnTheScreen();
  const slider = screen.UNSAFE_getByType(Slider);
  fireEvent(slider, 'slidingStart');
  expect(screen.queryByText('Hello')).not.toBeOnTheScreen();
  fireEvent(slider, 'slidingComplete', 2.5);
  expect(screen.getByText('World')).toBeOnTheScreen();
  testRouter.push('/away');
  await screen.findByText('away fixture');
  expect(screen.queryByText('World')).not.toBeOnTheScreen();
});

test('uses the preferred language again when a later episode provides it', async () => {
  const setPreferredSubtitleLanguage = jest.fn();
  mockSubtitleFiles({
    [englishSubtitle.url]: '1\n00:00:00,000 --> 00:00:04,000\nHello again',
    [koreanSubtitle.url]: 'WEBVTT\n\n00:00.000 --> 00:04.000\n한국어 대사',
  });
  const view = renderEpisode(makeSession({ preferredSubtitleLanguage: 'en', setPreferredSubtitleLanguage }));
  await resolvePlayback(view, { ...playback, subtitles: [koreanSubtitle] });
  emit(mockVideoPlayers[mockVideoPlayers.length - 1], 'timeUpdate', { currentTime: 1 });
  expect(await screen.findByText('한국어 대사')).toBeOnTheScreen();
  await userEvent.setup().press(screen.getByRole('button', { name: '더보기 설정' }));
  expect(screen.getByRole('button', { name: '한국어', selected: true })).toBeOnTheScreen();
  expect(setPreferredSubtitleLanguage).not.toHaveBeenCalled();
  await userEvent.setup().press(screen.getByRole('button', { name: '더보기 메뉴 닫기' }));

  testRouter.push('/episode/episode-2?dramaId=drama-1');
  await waitFor(() => expect(getEpisodePlayback).toHaveBeenCalledTimes(2));
  await resolvePlayback(view, { ...playback, videoUuid: 'video-2', subtitles: [koreanSubtitle, englishSubtitle] });
  emit(mockVideoPlayers[mockVideoPlayers.length - 1], 'timeUpdate', { currentTime: 1 });
  expect(await screen.findByText('Hello again')).toBeOnTheScreen();
  await userEvent.setup().press(screen.getByRole('button', { name: '더보기 설정' }));
  expect(screen.getByRole('button', { name: 'English', selected: true })).toBeOnTheScreen();
  expect(setPreferredSubtitleLanguage).not.toHaveBeenCalled();
});

test('keeps subtitles off when a language is selected and falls back to English when Korean is absent', async () => {
  const session = makeSessionWithPreference({ subtitlesEnabled: false });
  mockSubtitleFiles({
    [englishSubtitle.url]: '1\n00:00:00,000 --> 00:00:04,000\nHello only',
    [koreanSubtitle.url]: 'WEBVTT\n\n00:00.000 --> 00:00:04.000\n한국어 자막',
  });
  const view = renderEpisode(session);
  await resolvePlayback(view, { ...playback, subtitles: [englishSubtitle, koreanSubtitle] });
  emit(mockVideoPlayers[mockVideoPlayers.length - 1], 'timeUpdate', { currentTime: 1 });
  expect(screen.queryByText('Hello only')).not.toBeOnTheScreen();
  expect(screen.queryByText('한국어 자막')).not.toBeOnTheScreen();
  await userEvent.setup().press(screen.getByRole('button', { name: '더보기 설정' }));
  expect(screen.getByRole('button', { name: '한국어', selected: true })).toBeOnTheScreen();
  const subtitleSwitch = screen.getByRole('switch', { name: '자막 표시' });
  expect(subtitleSwitch).toBeEnabled();
  expect(subtitleSwitch).not.toBeChecked();
  await userEvent.setup().press(screen.getByRole('button', { name: 'English' }));
  expect(session.setPreferredSubtitleLanguage).toHaveBeenCalledWith('en');
  expect(screen.getByRole('switch', { name: '자막 표시' })).not.toBeChecked();
  expect(screen.queryByText('Hello only')).not.toBeOnTheScreen();
});

test('falls back to English when it is the only language returned', async () => {
  mockSubtitleFiles({ [englishSubtitle.url]: '1\n00:00:00,000 --> 00:00:04,000\nHello only' });
  const view = renderEpisode(makeSession({ preferredSubtitleLanguage: 'ko' }));
  await resolvePlayback(view, { ...playback, subtitles: [englishSubtitle] });
  emit(mockVideoPlayers[mockVideoPlayers.length - 1], 'timeUpdate', { currentTime: 1 });
  expect(await screen.findByText('Hello only')).toBeOnTheScreen();
  await userEvent.setup().press(screen.getByRole('button', { name: '더보기 설정' }));
  expect(screen.getByRole('button', { name: 'English', selected: true })).toBeOnTheScreen();
});

test('chooses the first language by code order when preferred, Korean, and English are unavailable', async () => {
  const french = { languageCode: 'fr', format: 'VTT' as const, url: 'https://signed.example.test/fr.vtt' };
  const japanese = { languageCode: 'ja', format: 'VTT' as const, url: 'https://signed.example.test/ja.vtt' };
  mockSubtitleFiles({
    [french.url]: 'WEBVTT\n\n00:00.000 --> 00:00:04.000\nBonjour',
    [japanese.url]: 'WEBVTT\n\n00:00.000 --> 00:00:04.000\nこんにちは',
  });
  const view = renderEpisode(makeSession({ preferredSubtitleLanguage: 'en' }));
  await resolvePlayback(view, { ...playback, subtitles: [japanese, french] });
  emit(mockVideoPlayers[mockVideoPlayers.length - 1], 'timeUpdate', { currentTime: 1 });
  expect(await screen.findByText('Bonjour')).toBeOnTheScreen();
  await userEvent.setup().press(screen.getByRole('button', { name: '더보기 설정' }));
  expect(screen.getByRole('button', { name: 'fr', selected: true })).toBeOnTheScreen();
});

test('keeps the newly selected language after a delayed old response and allows retry after a load error', async () => {
  let resolveOldKorean!: (response: Response) => void;
  let koreanRequests = 0;
  const request = jest.fn((input: RequestInfo | URL) => {
    if (String(input) === koreanSubtitle.url && koreanRequests++ === 0) {
      return new Promise<Response>((resolve) => { resolveOldKorean = resolve; });
    }
    if (String(input) === koreanSubtitle.url) return Promise.resolve({ ok: false, text: async () => '' } as Response);
    return Promise.resolve({ ok: true, text: async () => '1\n00:00:00,000 --> 00:00:04,000\nCurrent English' } as Response);
  }) as jest.MockedFunction<typeof fetch>;
  globalThis.fetch = request;
  const session = makeSessionWithPreference();
  const view = renderEpisode(session);
  await resolvePlayback(view, { ...playback, subtitles: [englishSubtitle, koreanSubtitle] });
  emit(mockVideoPlayers[mockVideoPlayers.length - 1], 'timeUpdate', { currentTime: 1 });
  await userEvent.setup().press(screen.getByRole('button', { name: '더보기 설정' }));
  await userEvent.setup().press(screen.getByRole('button', { name: 'English' }));
  expect(await screen.findByText('Current English')).toBeOnTheScreen();
  await act(async () => {
    resolveOldKorean({ ok: true, text: async () => 'WEBVTT\n\n00:00.000 --> 00:04.000\n늦은 한국어' } as Response);
  });
  expect(screen.getByText('Current English')).toBeOnTheScreen();

  await userEvent.setup().press(screen.getByRole('button', { name: '한국어' }));
  expect(await screen.findByText('자막을 불러오지 못했어요')).toBeOnTheScreen();
  expect(screen.getByRole('switch', { name: '자막 표시' })).toHaveProp('disabled', true);
  await userEvent.setup().press(screen.getByRole('button', { name: 'English' }));
  expect(await screen.findByText('Current English')).toBeOnTheScreen();
  expect(screen.getByRole('switch', { name: '자막 표시' })).toBeEnabled();
});

test('hides the current caption on video error and replaces it after a session change', async () => {
  const nextSubtitle = { ...koreanSubtitle, url: 'https://signed.example.test/next-ko.vtt' };
  mockSubtitleFiles({
    [koreanSubtitle.url]: 'WEBVTT\n\n00:00.000 --> 00:04.000\n회차 자막',
    [nextSubtitle.url]: 'WEBVTT\n\n00:00.000 --> 00:04.000\n다음 회차 자막',
  });
  const view = renderEpisode();
  await resolvePlayback(view, { ...playback, subtitles: [koreanSubtitle] });
  const firstPlayer = mockVideoPlayers[mockVideoPlayers.length - 1];
  emit(firstPlayer, 'timeUpdate', { currentTime: 1 });
  expect(await screen.findByText('회차 자막')).toBeOnTheScreen();
  emit(firstPlayer, 'statusChange', { status: 'error' });
  expect(screen.queryByText('회차 자막')).not.toBeOnTheScreen();
  expect(screen.getByText('영상을 재생할 수 없어요')).toBeOnTheScreen();

  setSession(makeSession({ user: { uuid: 'user-2', displayName: null, accountType: 'MEMBER' }, sessionVersion: 2,
    isCurrentSession: (version) => version === 2 }));
  await waitFor(() => expect(getEpisodePlayback).toHaveBeenCalledTimes(2));
  await resolvePlayback(view, { ...playback, videoUuid: 'video-2', subtitles: [nextSubtitle] });
  expect(screen.queryByText('회차 자막')).not.toBeOnTheScreen();
  emit(mockVideoPlayers[mockVideoPlayers.length - 1], 'timeUpdate', { currentTime: 1 });
  expect(await screen.findByText('다음 회차 자막')).toBeOnTheScreen();
});
