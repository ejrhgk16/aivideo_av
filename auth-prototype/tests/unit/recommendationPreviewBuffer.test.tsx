/** @jest-environment jsdom */

import { setImmediate } from 'node:timers';
import { FlatList, Platform, ScrollView, Share, StyleSheet, Text, View, type NativeScrollEvent } from 'react-native';
import Slider from '@react-native-community/slider';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter, testRouter } from 'expo-router/testing-library';
import { VideoView } from 'expo-video';
import { RecommendationScreen } from '@/screens/RecommendationScreen';
import { getDramaContent } from '@/features/drama/dramaContent';
import type { DramaContent } from '@/features/drama/dramaResponses';
import { getHomeCollection } from '@/features/home/homeContent';
import type { HomeCollection, HomeCollectionDrama } from '@/features/home/homeResponses';
import { getPreviewPlayback } from '@/features/playback/previewPlayback';
import { removeSavedVideo, saveVideo } from '@/features/playback/savedVideos';
import { createRecommendationPreviewBuffer } from '@/features/playback/recommendationPreviewBuffer';
import { saveWatchProgress } from '@/features/playback/watchProgress';
import { useUser } from '@/features/user/UserProvider';
import { createMockVideoPlayer, mockVideoPlayers, type MockVideoPlayer } from '../support/video';

jest.mock('@/features/drama/dramaContent', () => ({ getDramaContent: jest.fn() }));
jest.mock('@/features/home/homeContent', () => ({ getHomeCollection: jest.fn() }));
jest.mock('@/features/playback/previewPlayback', () => ({ getPreviewPlayback: jest.fn() }));
jest.mock('@/features/playback/savedVideos', () => ({ removeSavedVideo: jest.fn(), saveVideo: jest.fn() }));
jest.mock('@/features/playback/watchProgress', () => ({
  ...jest.requireActual('@/features/playback/watchProgress'),
  saveWatchProgress: jest.fn(),
}));
jest.mock('@react-native-community/slider', () => {
  const React = require('react');
  const { View } = require('react-native');
  return (props: Record<string, unknown>) => React.createElement(View, props);
});
jest.mock('@/features/user/UserProvider', () => ({ useUser: jest.fn() }));
// The Jest preset's View mock is a class wrapper; forward only the feed ref to its host node for real DOM listeners.
jest.mock('react-native', () => {
  const React = require('react');
  const actual = jest.requireActual('react-native');
  const NativeViewBoundary = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
    if (props.onMoveShouldSetResponderCapture && props.onLayout) {
      return React.createElement('View', { ...props, ref } as never);
    }
    return React.createElement(actual.View, { ...props, ref });
  });
  const moduleMock = Object.defineProperties({}, Object.getOwnPropertyDescriptors(actual));
  const viewDescriptor = Object.getOwnPropertyDescriptor(actual, 'View');
  if (!viewDescriptor?.configurable) throw new Error('React Native View export must be configurable for the feed ref boundary');
  Object.defineProperty(moduleMock, 'View', {
    configurable: viewDescriptor.configurable,
    enumerable: viewDescriptor.enumerable,
    writable: true,
    value: NativeViewBoundary,
  });
  return moduleMock;
});

type Target = { dramaId: string; videoId: string };
type Deferred<T> = { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void };

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const flush = async () => {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
};

const target = (index: number): Target => ({ dramaId: `drama-${index}`, videoId: `preview-${index}` });
const mockHomeRequests: Array<Deferred<HomeCollection>> = [];
const mockPreviewRequests: Array<{ target: Target; task: Deferred<{ url: string }> }> = [];
const mockSaveTasks: Array<Deferred<void>> = [];
let deferSavedWrites = false;
let panTime = 1;
let originalPlatformOS: PropertyDescriptor | undefined;
let platformOSWasOverridden = false;
let originalApiBaseUrl: string | undefined;
let apiBaseUrlWasOverridden = false;

const session: ReturnType<typeof useUser> = {
  user: { uuid: 'user-1', displayName: '테스트 사용자', accountType: 'MEMBER' },
  points: 20,
  accessToken: 'test-token',
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
};

function homeDrama(uuid: string, displayOrder: number, options: { saved?: boolean; durationMs?: number } = {}): HomeCollectionDrama {
  return {
    uuid,
    slug: uuid,
    displayOrder,
    title: uuid,
    shortDescription: '',
    productionCompany: null,
    genres: [],
    imageUrls: { poster: `poster-${uuid}`, posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] },
    previewVideos: [{ uuid: `preview-${uuid}`, storageKey: '', durationMs: options.durationMs ?? 1000, isSaved: options.saved ?? false }],
    publishedEpisodeCount: 1,
    freeEpisodeCount: 1,
  };
}

function homeCollection(dramas: HomeCollectionDrama[]): HomeCollection {
  return { code: 'RECOMMENDATION_DAILY', title: '추천', description: null, dramas };
}

const dramaContent = (uuid: string): DramaContent => ({
  uuid,
  slug: uuid,
  title: uuid,
  shortDescription: '',
  synopsis: '',
  productionCompany: null,
  genres: [],
  imageUrls: { poster: null, posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] },
  previewVideos: [],
  episodes: [],
});

const OtherRoute = () => <Text>다른 화면</Text>;

function renderRecommendation(platform: 'ios' | 'web' = 'ios') {
  if (Platform.OS !== platform) {
    if (!platformOSWasOverridden) {
      originalPlatformOS = Object.getOwnPropertyDescriptor(Platform, 'OS');
      platformOSWasOverridden = true;
    }
    Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
  }
  if (!apiBaseUrlWasOverridden) {
    originalApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    apiBaseUrlWasOverridden = true;
  }
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  const feed = document.createElement('div');
  const addFeedListener = jest.spyOn(feed, 'addEventListener');
  const removeFeedListener = jest.spyOn(feed, 'removeEventListener');
  const view = renderRouter({
    _layout: () => <Stack screenOptions={{ animation: 'none' }} />,
    index: () => <RecommendationScreen initialId={undefined} />,
    other: OtherRoute,
  }, {
    initialUrl: '/',
    createNodeMock(element) {
      const props = element.props as Record<string, unknown>;
      if (props.onMoveShouldSetResponderCapture && props.onLayout) return feed;
      return null;
    },
  });
  return { ...view, feed, addFeedListener, removeFeedListener };
}

function feedInstance() {
  const feed = screen.UNSAFE_getAllByType(View)
    .find((instance) => typeof instance.props.onMoveShouldSetResponderCapture === 'function');
  if (!feed) throw new Error('Recommendation feed View was not rendered');
  return feed;
}

async function feedLayout(height: number) {
  fireEvent(feedInstance(), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 1100, height } } });
  await act(async () => { await flush(); });
}

function listInstance() {
  return screen.UNSAFE_getByType(FlatList);
}

function panEvent(y: number, previousY: number, time: number, previousTime: number) {
  return {
    nativeEvent: { touches: [] },
    touchHistory: {
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: time,
      numberActiveTouches: 1,
      touchBank: [{
        touchActive: true,
        currentPageX: 0,
        currentPageY: y,
        currentTimeStamp: time,
        previousPageX: 0,
        previousPageY: previousY,
        previousTimeStamp: previousTime,
      }],
    },
  };
}

function canStartGesture(dx: number, dy: number) {
  const feed = feedInstance();
  const time = panTime += 16;
  const event = {
    ...panEvent(dy, 0, time, time - 16),
    touchHistory: {
      ...panEvent(dy, 0, time, time - 16).touchHistory,
      touchBank: [{
        ...panEvent(dy, 0, time, time - 16).touchHistory.touchBank[0],
        currentPageX: dx,
      }],
    },
  };
  const result = fireEvent(feed, 'moveShouldSetResponderCapture', event);
  fireEvent(feed, 'responderTerminate', event);
  return result;
}

async function loadScreen(options: { count?: number; platform?: 'ios' | 'web'; saved?: boolean; durationMs?: number; resolvePlayers?: boolean; autoReady?: boolean } = {}) {
  const count = options.count ?? 4;
  const rendered = renderRecommendation(options.platform);
  await waitFor(() => expect(mockHomeRequests).toHaveLength(1));
  await act(async () => mockHomeRequests[0].resolve(homeCollection(
    Array.from({ length: count }, (_, index) => homeDrama(`drama-${index + 1}`, index + 1, options)),
  )));
  await waitFor(() => expect(feedInstance()).toBeTruthy());
  await feedLayout(500);
  await waitFor(() => expect(listInstance()).toBeTruthy());
  const nativeScrollInstance = screen.UNSAFE_getByType(ScrollView).instance as ScrollView;
  if (!jest.isMockFunction(nativeScrollInstance.scrollTo)) throw new Error('FlatList ScrollView mock scrollTo was not available');
  const nativeScroll = jest.mocked(nativeScrollInstance);
  fireEvent(listInstance(), 'contentSizeChange', 1100, count * 500);
  await waitFor(() => expect(mockPreviewRequests.length).toBeGreaterThan(0));
  await act(async () => { await flush(); });
  if (options.resolvePlayers !== false) {
    await act(async () => {
      for (const request of mockPreviewRequests) request.task.resolve({ url: `url-${request.target.videoId}` });
      await flush();
    });
    await waitFor(() => expect(mockVideoPlayers.length).toBeGreaterThan(0));
    if (options.autoReady !== false) {
      for (const videoPlayer of [...mockVideoPlayers]) await ready(videoPlayer);
    }
  }
  return { ...rendered, nativeScroll };
}

function requestFor(videoId: string) {
  const request = [...mockPreviewRequests].reverse().find((item) => item.target.videoId === videoId);
  if (!request) throw new Error(`No preview request for ${videoId}`);
  return request;
}

async function resolvePreview(videoId: string) {
  await waitFor(() => expect(mockPreviewRequests.some((request) => request.target.videoId === videoId)).toBe(true));
  const request = requestFor(videoId);
  await act(async () => {
    request.task.resolve({ url: `url-${request.target.videoId}` });
    await flush();
  });
  await waitFor(() => expect(playerFor(videoId)).toBeTruthy());
  await ready(playerFor(videoId));
  await act(async () => { await flush(); });
}

function expectActiveDramaTitle(title: string) {
  // The active preview renders its title in both the heading and the title button.
  expect(screen.getAllByText(title, { exact: true })).toHaveLength(2);
}

async function navigateToOther() {
  testRouter.push('/other');
  expect(await screen.findByText('다른 화면', { exact: true })).toBeVisible();
}

function playerFor(videoId: string): MockVideoPlayer {
  const player = [...mockVideoPlayers].reverse().find((item) =>
    item.source === `url-${videoId}` && item.release.mock.calls.length === 0,
  );
  if (!player) throw new Error(`No player for ${videoId}`);
  expect(player.release).not.toHaveBeenCalled();
  return player;
}

async function ready(player: MockVideoPlayer) {
  await act(async () => player.emit('statusChange', { status: 'readyToPlay' }));
}

async function nativeScrollArrival(y: number, layoutHeight = 500) {
  const contentHeight = (listInstance().props.data as HomeCollectionDrama[]).length * layoutHeight;
  const nativeEvent: NativeScrollEvent = {
    contentInset: { top: 0, left: 0, bottom: 0, right: 0 },
    contentOffset: { x: 0, y },
    contentSize: { width: 1100, height: contentHeight },
    layoutMeasurement: { width: 1100, height: layoutHeight },
    velocity: { x: 0, y: 0 },
    zoomScale: 1,
    targetContentOffset: { x: 0, y },
  };
  await act(async () => {
    fireEvent.scroll(listInstance(), { nativeEvent });
    await flush();
  });
}

async function advanceFrame() {
  await act(async () => { await jest.advanceTimersByTimeAsync(16); });
}

async function advanceFrames(count: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(count * 16);
    await flush();
  });
}

function startDrag() {
  const feed = feedInstance();
  const time = panTime += 16;
  expect(fireEvent(feed, 'moveShouldSetResponderCapture', panEvent(-20, 0, time, time - 16))).toBe(true);
  fireEvent(feed, 'responderGrant', panEvent(0, 0, time, time - 16));
  let lastY = 0;
  let lastTime = time;
  const move = (dy: number, vy = 0) => {
    const delta = dy - lastY;
    const elapsed = vy === 0 ? Math.max(1000, Math.abs(delta)) : Math.abs(delta / vy);
    const currentTime = lastTime + elapsed;
    fireEvent(feed, 'responderMove', panEvent(dy, lastY, currentTime, lastTime));
    lastY = dy;
    lastTime = currentTime;
  };
  return {
    move,
    release(dy: number, vy = 0) {
      if (dy !== lastY || vy !== 0) move(dy, vy);
      fireEvent(feed, 'responderRelease', panEvent(lastY, lastY, lastTime + 1, lastTime));
    },
    cancel() { fireEvent(feed, 'responderTerminate', panEvent(lastY, lastY, lastTime + 1, lastTime)); },
  };
}

async function finishAnimation(targetOffset: number) {
  await advanceFrames(20);
  await nativeScrollArrival(targetOffset);
}

async function resolveNewPreviewRequests(fromIndex: number) {
  let nextIndex = fromIndex;
  while (nextIndex < mockPreviewRequests.length) {
    const batch = mockPreviewRequests.slice(nextIndex);
    nextIndex = mockPreviewRequests.length;
    await act(async () => {
      for (const request of batch) request.task.resolve({ url: `url-${request.target.videoId}` });
      await flush();
    });
    const readyPlayers = new Set<MockVideoPlayer>();
    for (const request of batch) {
      const player = [...mockVideoPlayers].reverse().find((item) =>
        item.source === `url-${request.target.videoId}` && item.release.mock.calls.length === 0,
      );
      if (player) readyPlayers.add(player);
    }
    for (const player of readyPlayers) await ready(player);
    await act(async () => { await flush(); });
  }
}

async function focusRefresh(dramas: HomeCollectionDrama[], beforeResponse?: () => void) {
  const firstNewPreviewRequest = mockPreviewRequests.length;
  await navigateToOther();
  testRouter.back('/');
  await waitFor(() => expect(mockHomeRequests.length).toBeGreaterThan(1));
  beforeResponse?.();
  await act(async () => {
    mockHomeRequests[mockHomeRequests.length - 1].resolve(homeCollection(dramas));
    await flush();
  });
  if (dramas.length > 0) {
    await waitFor(() => expect(mockPreviewRequests.length).toBeGreaterThan(firstNewPreviewRequest));
    await resolveNewPreviewRequests(firstNewPreviewRequest);
  }
}

beforeEach(() => {
  mockHomeRequests.length = 0;
  mockPreviewRequests.length = 0;
  mockSaveTasks.length = 0;
  panTime = 1;
  deferSavedWrites = false;
  jest.mocked(useUser).mockReturnValue(session);
  jest.mocked(getHomeCollection).mockImplementation(() => {
    const task = deferred<HomeCollection>();
    mockHomeRequests.push(task);
    return task.promise;
  });
  jest.mocked(getPreviewPlayback).mockImplementation((dramaId, videoId) => {
    const task = deferred<{ url: string }>();
    mockPreviewRequests.push({ target: { dramaId, videoId }, task });
    return task.promise.then(({ url }) => ({ url, videoUuid: videoId, isSaved: false, durationMs: 1000 }));
  });
  jest.mocked(getDramaContent).mockImplementation(async (id) => dramaContent(id));
  jest.mocked(saveVideo).mockImplementation(() => {
    if (!deferSavedWrites) return Promise.resolve();
    const task = deferred<void>(); mockSaveTasks.push(task); return task.promise;
  });
  jest.mocked(removeSavedVideo).mockImplementation(() => {
    if (!deferSavedWrites) return Promise.resolve();
    const task = deferred<void>(); mockSaveTasks.push(task); return task.promise;
  });
  jest.mocked(saveWatchProgress).mockResolvedValue(undefined);
});

afterEach(() => {
  if (platformOSWasOverridden) {
    if (originalPlatformOS) Object.defineProperty(Platform, 'OS', originalPlatformOS);
    else Reflect.deleteProperty(Platform, 'OS');
  }
  originalPlatformOS = undefined;
  platformOSWasOverridden = false;
  if (apiBaseUrlWasOverridden) {
    if (originalApiBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalApiBaseUrl;
  }
  originalApiBaseUrl = undefined;
  apiBaseUrlWasOverridden = false;
});

test('recommendation buffer retains and reuses only the previous, current, and next players', async () => {
  const load = jest.fn(async (_dramaId: string, videoId: string) => ({ url: `url-${videoId}` }));
  const create = jest.fn((url: string) => createMockVideoPlayer(url));
  const buffer = createRecommendationPreviewBuffer(load, create, jest.fn());
  buffer.retain([target(1), target(2)]);
  await flush();
  const first = buffer.get(target(1))?.player;
  const second = buffer.get(target(2))?.player;
  expect(load.mock.calls.map((call) => call[1])).toEqual(['preview-1', 'preview-2']);
  buffer.retain([target(1), target(2), target(3)]);
  expect(buffer.get(target(1))?.player).toBe(first);
  expect(buffer.get(target(2))?.player).toBe(second);
  await flush();
  buffer.retain([target(2), target(3), target(4)]);
  expect(buffer.snapshot()).toHaveLength(3);
  expect(buffer.get(target(1))).toBeUndefined();
  expect(first?.release).not.toHaveBeenCalled();
  buffer.releasePending();
  expect(first?.release).toHaveBeenCalledTimes(1);
  expect(buffer.get(target(2))?.player).toBe(second);
  buffer.dispose();
  expect(second?.release).toHaveBeenCalledTimes(1);
});

test('pending URLs are shared across out-and-back navigation and removed-entry responses are ignored', async () => {
  const request = deferred<{ url: string }>();
  const load = jest.fn((_dramaId: string, _videoId: string) => request.promise);
  const create = jest.fn((url: string) => createMockVideoPlayer(url));
  const buffer = createRecommendationPreviewBuffer(load, create, jest.fn());
  buffer.retain([target(1), target(2)]); await flush();
  const removed = buffer.get(target(1));
  buffer.retain([target(2), target(3)]); await flush();
  buffer.retain([target(1), target(2)]); await flush();
  expect(load.mock.calls.filter((call) => call[0] === 'drama-1')).toHaveLength(1);
  request.resolve({ url: 'shared-url' }); await flush();
  expect(buffer.get(target(1))).not.toBe(removed);
  expect(create).toHaveBeenCalledTimes(2);
  buffer.dispose();
});

test('responses for entries outside the latest window cannot create players', async () => {
  const requests = [deferred<{ url: string }>(), deferred<{ url: string }>(), deferred<{ url: string }>()];
  const load = jest.fn((_dramaId: string, videoId: string) => requests[Number(videoId.slice(-1)) - 1].promise);
  const create = jest.fn((url: string) => createMockVideoPlayer(url));
  const buffer = createRecommendationPreviewBuffer(load, create, jest.fn());
  buffer.retain([target(1), target(2)]); await flush();
  buffer.retain([target(2), target(3)]); await flush();
  requests[0].resolve({ url: 'stale' }); requests[1].resolve({ url: 'current' }); await flush();
  expect(buffer.get(target(1))).toBeUndefined();
  expect(create).toHaveBeenCalledTimes(1);
  expect(buffer.get(target(2))?.player).toBe(create.mock.results[0].value);
  buffer.dispose();
});

test('tracked player listeners are removed before an evicted player is released', async () => {
  const buffer = createRecommendationPreviewBuffer(async (_dramaId, videoId) => ({ url: videoId }), (url) => createMockVideoPlayer(url), jest.fn());
  buffer.retain([target(1)]); await flush();
  const player = buffer.get(target(1)!)!.player!;
  const subscription = player.addListener('statusChange', jest.fn());
  const remove = jest.spyOn(subscription, 'remove');
  const tracked = buffer.trackSubscription(target(1), player, subscription);
  buffer.retain([target(2)]);
  expect(remove).toHaveBeenCalledTimes(1);
  expect(player.listenerCount('statusChange')).toBe(0);
  expect(player.release).not.toHaveBeenCalled();
  buffer.releasePending();
  tracked.remove();
  expect(player.release).toHaveBeenCalledTimes(1);
  buffer.dispose();
});

test('blur disposal ignores late requests and failure does not retry until the entry leaves', async () => {
  const requests: Array<Deferred<{ url: string }>> = [];
  const buffer = createRecommendationPreviewBuffer((_dramaId, _videoId) => {
    const task = deferred<{ url: string }>(); requests.push(task); return task.promise;
  }, (url) => createMockVideoPlayer(url), jest.fn());
  buffer.retain([target(1)]); await flush();
  requests[0].reject(new Error('offline')); await flush();
  expect(buffer.get(target(1))?.kind).toBe('unavailable');
  buffer.retain([target(1)]);
  expect(requests).toHaveLength(1);
  buffer.retain([target(2)]); buffer.retain([target(1)]); await flush();
  expect(requests).toHaveLength(3);
  buffer.dispose();
  requests[1].resolve({ url: 'late' }); requests[2].resolve({ url: 'late-again' }); await flush();
  expect(buffer.snapshot()).toHaveLength(0);
});

test('a page change records a zero seek while a player is still loading and applies it on ready', async () => {
  const request = deferred<{ url: string }>();
  let player: MockVideoPlayer | undefined;
  const buffer = createRecommendationPreviewBuffer(() => request.promise, (url) => {
    player = createMockVideoPlayer(url); player.status = 'loading'; return player;
  }, jest.fn());
  buffer.retain([target(1)]); await flush();
  buffer.resetToBeginning(target(1));
  request.resolve({ url: 'url-1' }); await flush();
  expect(player?.currentTime).toBe(0);
  player!.currentTime = 28;
  player!.emit('statusChange', { status: 'readyToPlay' });
  expect(player?.currentTime).toBe(0);
  expect(player?.listenerCount('statusChange')).toBe(0);
  buffer.dispose();
});

test('recommendation mounts idle web players so canplay can make current and neighbor videos visible', async () => {
  await loadScreen({ count: 2, platform: 'web', autoReady: false });
  const current = playerFor('preview-drama-1');
  const neighbor = playerFor('preview-drama-2');
  expect(screen.queryByLabelText('drama-1 표지')).toBeNull();
  const idleVideoViews = screen.UNSAFE_getAllByType(VideoView)
    .filter((instance) => StyleSheet.flatten(instance.props.style)?.opacity === 0);
  expect(idleVideoViews.length).toBeGreaterThanOrEqual(2);
  expect(current.play).not.toHaveBeenCalled();
  await ready(current);
  expect(current.play).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: '작품 저장' })).toBeTruthy();
  await ready(neighbor);
  expect(neighbor.play).not.toHaveBeenCalled();
  act(() => current.pause());
  await ready(current);
  expect(current.play).toHaveBeenCalledTimes(1);
  await navigateToOther();
  await ready(current);
  expect(current.play).toHaveBeenCalledTimes(1);
});

test('a refreshed collection reorders the visible card to the committed drama without a content-size event', async () => {
  const { nativeScroll } = await loadScreen({ count: 3 });
  jest.useFakeTimers();
  const drag = startDrag(); drag.move(-300); drag.release(-300);
  await finishAnimation(500);
  expectActiveDramaTitle('drama-2');
  await focusRefresh([homeDrama('drama-2', 1), homeDrama('drama-1', 2), homeDrama('drama-3', 3)]);
  expectActiveDramaTitle('drama-2');
  expect(nativeScroll.scrollTo).toHaveBeenLastCalledWith({ y: 0, animated: false });
  expect(mockHomeRequests).toHaveLength(2);
});

test('a removed active drama aligns its selected fallback and an empty refresh sends no card scroll', async () => {
  const { nativeScroll } = await loadScreen({ count: 3 });
  jest.useFakeTimers();
  for (let index = 1; index <= 2; index += 1) {
    const drag = startDrag(); drag.move(-300); drag.release(-300); await finishAnimation(index * 500);
  }
  await focusRefresh([homeDrama('drama-2', 1), homeDrama('drama-1', 2)]);
  fireEvent(listInstance(), 'contentSizeChange', 1100, 1000);
  await nativeScrollArrival(0);
  expectActiveDramaTitle('drama-2');
  let beforeEmpty = 0;
  await focusRefresh([], () => { beforeEmpty = nativeScroll.scrollTo.mock.calls.length; });
  expect(screen.getByText('오늘의 추천 작품이 없어요')).toBeTruthy();
  expect(nativeScroll.scrollTo.mock.calls.length).toBe(beforeEmpty);
});

test('a same-order metadata refresh does not request an unnecessary scroll', async () => {
  const { nativeScroll } = await loadScreen({ count: 3 });
  jest.useFakeTimers();
  const drag = startDrag(); drag.move(-300); drag.release(-300); await finishAnimation(500);
  let beforeRefresh = 0;
  await focusRefresh(
    [homeDrama('drama-1', 1), homeDrama('drama-2', 2), homeDrama('drama-3', 3)],
    () => { beforeRefresh = nativeScroll.scrollTo.mock.calls.length; },
  );
  expect(nativeScroll.scrollTo.mock.calls.length).toBe(beforeRefresh);
});

test('a reordered collection cancels an in-flight motion and ignores a stale scroll until it reaches alignment', async () => {
  await loadScreen({ count: 4 });
  jest.useFakeTimers();
  for (let index = 1; index <= 2; index += 1) {
    const first = startDrag(); first.move(-300); first.release(-300); await finishAnimation(index * 500);
    if (index === 1) await resolvePreview('preview-drama-3');
  }
  expectActiveDramaTitle('drama-3');
  const second = startDrag(); second.move(-300); second.release(-300);
  await advanceFrame();
  await focusRefresh([homeDrama('drama-1', 1), homeDrama('drama-3', 2), homeDrama('drama-2', 3), homeDrama('drama-4', 4)]);
  expectActiveDramaTitle('drama-3');
  await nativeScrollArrival(1000);
  expectActiveDramaTitle('drama-3');
  expect(canStartGesture(0, -40)).toBe(false);
  await nativeScrollArrival(500);
  expect(canStartGesture(0, -40)).toBe(true);
});

test('a collection response arriving after blur is ignored and a later focus uses the latest response', async () => {
  await loadScreen({ count: 3 });
  await navigateToOther();
  testRouter.back('/');
  await waitFor(() => expect(mockHomeRequests).toHaveLength(2));
  await navigateToOther();
  await act(async () => {
    mockHomeRequests[1].resolve(homeCollection([homeDrama('drama-3', 1), homeDrama('drama-1', 2)]));
    await flush();
  });
  expect(screen.getByText('다른 화면')).toBeVisible();
  const priorPreviewCount = mockPreviewRequests.length;
  testRouter.back('/');
  await waitFor(() => expect(mockHomeRequests).toHaveLength(3));
  await waitFor(() => expect(mockPreviewRequests.length).toBeGreaterThan(priorPreviewCount));
  await resolvePreview('preview-drama-1');
  expectActiveDramaTitle('drama-1');
  await act(async () => {
    mockHomeRequests[2].resolve(homeCollection([homeDrama('drama-3', 1)]));
    await flush();
  });
  await resolvePreview('preview-drama-3');
  expectActiveDramaTitle('drama-3');
});

test('drag follows the pointer and switches playback only after actual target arrival', async () => {
  await loadScreen();
  const current = playerFor('preview-drama-1');
  const next = playerFor('preview-drama-2');
  await ready(current); await ready(next);
  current.currentTime = 17;
  jest.useFakeTimers();
  const drag = startDrag(); drag.move(-300);
  expect(current.playing).toBe(true);
  drag.release(-250);
  await advanceFrames(20);
  expectActiveDramaTitle('drama-1');
  expect(next.playing).toBe(false);
  await nativeScrollArrival(500);
  await waitFor(() => expectActiveDramaTitle('drama-2'));
  expect(next.playing).toBe(true);
  expect(current.playing).toBe(false);
  expect(current.currentTime).toBe(0);
});

test('recommendation bookmark saves the first preview and the collection retains it after control remount', async () => {
  await loadScreen({ count: 1 });
  await ready(playerFor('preview-drama-1'));
  await act(async () => fireEvent.press(screen.getByRole('button', { name: '작품 저장' })));
  expect(saveVideo).toHaveBeenCalledWith('preview-drama-1', 'PREVIEW');
  await waitFor(() => expect(screen.getByRole('button', { name: '저장 해제' })).toBeTruthy());
});

test('recommendation records only the selected advancing preview with its server duration', async () => {
  await loadScreen({ count: 2, durationMs: 60000 });
  const selected = playerFor('preview-drama-1');
  const neighbor = playerFor('preview-drama-2');
  await act(async () => neighbor.emit('timeUpdate', { currentTime: 1 }));
  expect(saveWatchProgress).not.toHaveBeenCalled();
  jest.useFakeTimers();
  const moving = startDrag();
  await act(async () => {
    selected.emit('timeUpdate', { currentTime: 0 });
    selected.emit('timeUpdate', { currentTime: 1 });
    await flush();
  });
  expect(saveWatchProgress).not.toHaveBeenCalled();
  moving.cancel();
  await finishAnimation(0);
  const slider = screen.UNSAFE_getByType(Slider);
  fireEvent(slider, 'slidingStart');
  await act(async () => {
    selected.emit('timeUpdate', { currentTime: 2 });
    await flush();
  });
  expect(saveWatchProgress).not.toHaveBeenCalled();
  fireEvent(slider, 'slidingComplete', 2);
  await act(async () => {
    selected.duration = 90;
    selected.emit('sourceLoad', { duration: 90 });
    selected.emit('timeUpdate', { currentTime: 0 });
    selected.emit('timeUpdate', { currentTime: 1 });
    await flush();
  });
  expect(saveWatchProgress).toHaveBeenCalledWith('preview-drama-1', { event: 'STARTED', positionMs: 0 });
  await act(async () => {
    for (let second = 2; second <= 40; second += 1) selected.emit('timeUpdate', { currentTime: second });
    await flush();
  });
  expect(saveWatchProgress).toHaveBeenCalledWith('preview-drama-1', { event: 'COMPLETED', positionMs: 40000 });
  await navigateToOther();
  await act(async () => selected.emit('timeUpdate', { currentTime: 42 }));
  expect(saveWatchProgress).toHaveBeenCalledTimes(2);
});

test('saving and removing the paused recommendation preview never resumes it', async () => {
  await loadScreen({ count: 1 });
  const player = playerFor('preview-drama-1'); await ready(player);
  player.currentTime = 17;
  act(() => fireEvent.press(screen.getByRole('button', { name: '일시정지' })));
  const plays = player.play.mock.calls.length;
  deferSavedWrites = true;
  fireEvent.press(screen.getByRole('button', { name: '작품 저장' }));
  expect(screen.getByRole('button', { name: '작품 저장' }).props.accessibilityState.busy).toBe(true);
  await act(async () => mockSaveTasks[0].reject(new Error('offline')));
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(player.play.mock.calls.length).toBe(plays);
  fireEvent.press(screen.getByRole('button', { name: '작품 저장' }));
  await act(async () => mockSaveTasks[1].resolve());
  expect(player.play.mock.calls.length).toBe(plays);
  fireEvent.press(screen.getByRole('button', { name: '저장 해제' }));
  await act(async () => mockSaveTasks[2].resolve());
  expect(player.play.mock.calls.length).toBe(plays);
  expect(player.currentTime).toBe(17);
});

test('recommendation serializes A to B to A saves and ignores a focus read that overlaps the pending write', async () => {
  await loadScreen({ count: 2 });
  await ready(playerFor('preview-drama-1')); await ready(playerFor('preview-drama-2'));
  deferSavedWrites = true;
  fireEvent.press(screen.getByRole('button', { name: '작품 저장' }));
  fireEvent.press(screen.getByRole('button', { name: '작품 저장' }));
  expect(saveVideo).toHaveBeenCalledTimes(1);
  jest.useFakeTimers();
  const drag = startDrag(); drag.move(-300); drag.release(-300); await finishAnimation(500);
  expect(screen.getByRole('button', { name: '작품 저장' }).props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByRole('button', { name: '작품 저장' }));
  expect(saveVideo).toHaveBeenCalledTimes(1);
  const back = startDrag(); back.move(300); back.release(300); await finishAnimation(0);
  expectActiveDramaTitle('drama-1');
  const firstNewPreviewRequest = mockPreviewRequests.length;
  await navigateToOther();
  testRouter.back('/');
  await waitFor(() => expect(mockHomeRequests).toHaveLength(2));
  await waitFor(() => expect(mockPreviewRequests.length).toBeGreaterThan(firstNewPreviewRequest));
  const staleResponse = mockHomeRequests[1];
  await act(async () => mockSaveTasks[0].resolve());
  await act(async () => staleResponse.resolve(homeCollection([homeDrama('drama-new', 1)])));
  await resolvePreview('preview-drama-1');
  await waitFor(() => expect(screen.getByRole('button', { name: '저장 해제' })).toBeTruthy());
  expectActiveDramaTitle('drama-1');
});

test('a failed recommendation save releases the screen lock after its card unmounts', async () => {
  await loadScreen({ count: 2 });
  deferSavedWrites = true;
  fireEvent.press(screen.getByRole('button', { name: '작품 저장' }));
  jest.useFakeTimers();
  const drag = startDrag(); drag.move(-300); drag.release(-300); await finishAnimation(500);
  await act(async () => mockSaveTasks[0].reject(new Error('offline')));
  await waitFor(() => expect(screen.getByRole('button', { name: '작품 저장' }).props.accessibilityState.disabled).toBe(false));
  fireEvent.press(screen.getByRole('button', { name: '작품 저장' }));
  expect(saveVideo).toHaveBeenCalledTimes(2);
  await act(async () => mockSaveTasks[1].resolve());
});

test('fast swipes use recent velocity, distance, freshness, and final direction only on release', async () => {
  await loadScreen({ count: 4 });
  jest.useFakeTimers();
  const fast = startDrag(); fast.move(-80, -0.5); fast.release(-80);
  await finishAnimation(500);
  expectActiveDramaTitle('drama-2');

  const slow = startDrag(); slow.move(-80, -0.49); slow.release(-80);
  await finishAnimation(500);
  expectActiveDramaTitle('drama-2');
  const tooShort = startDrag(); tooShort.move(-49, -2); tooShort.release(-49);
  await finishAnimation(500);
  expectActiveDramaTitle('drama-2');

  const boundary = startDrag(); boundary.move(-50, -0.5);
  await act(async () => jest.advanceTimersByTimeAsync(100));
  boundary.release(-50);
  await finishAnimation(1000);
  await resolvePreview('preview-drama-3');
  expectActiveDramaTitle('drama-3');

  const stale = startDrag(); stale.move(-80, -1);
  await act(async () => jest.advanceTimersByTimeAsync(101));
  stale.release(-80);
  await finishAnimation(1000);
  expectActiveDramaTitle('drama-3');
  const reversed = startDrag(); reversed.move(-100, -1); reversed.move(-80, 1); reversed.release(-80);
  await finishAnimation(1000);
  expectActiveDramaTitle('drama-3');

  const heldThenFlicked = startDrag();
  await act(async () => jest.advanceTimersByTimeAsync(1000));
  heldThenFlicked.move(-80, -1); heldThenFlicked.release(-80);
  await finishAnimation(1500);
  await resolvePreview('preview-drama-4');
  expectActiveDramaTitle('drama-4');

  const backward = startDrag(); backward.move(80, 0.5); backward.release(80);
  await finishAnimation(1000);
  expectActiveDramaTitle('drama-3');
  const invalid = startDrag(); invalid.move(-80, Number.NaN); invalid.release(-80);
  await finishAnimation(1000);
  expectActiveDramaTitle('drama-3');
  const infinite = startDrag(); infinite.move(-80, Number.POSITIVE_INFINITY); infinite.release(-80);
  await finishAnimation(1000);
  expectActiveDramaTitle('drama-3');
});

test('PanResponder preserves controls, cancel, half-page and edge behavior', async () => {
  await loadScreen({ count: 2 });
  expect(canStartGesture(18, 10)).toBe(false);
  expect(canStartGesture(0, 9)).toBe(false);
  const save = screen.getByRole('button', { name: '작품 저장' });
  expect(save.props.onTouchStart).toBeUndefined();
  const slider = screen.UNSAFE_getByType(Slider);
  fireEvent(slider, 'touchStart');
  expect(canStartGesture(0, -100)).toBe(false);
  fireEvent(slider, 'slidingStart');
  fireEvent(slider, 'touchCancel');
  expect(canStartGesture(0, -100)).toBe(true);
  fireEvent(slider, 'touchStart');
  fireEvent(slider, 'slidingStart');
  fireEvent(slider, 'touchEnd');
  expect(canStartGesture(0, -100)).toBe(false);
  fireEvent(slider, 'valueChange', 18);
  fireEvent(slider, 'slidingComplete', 18);
  expect(playerFor('preview-drama-1').currentTime).toBe(18);

  jest.useFakeTimers();
  const cancel = startDrag(); cancel.move(-300); cancel.cancel(); await finishAnimation(0);
  const half = startDrag(); half.move(-240); half.release(-240); await finishAnimation(0);
  expectActiveDramaTitle('drama-1');
  const exactHalf = startDrag(); exactHalf.move(-250); exactHalf.release(-250); await finishAnimation(500);
  expectActiveDramaTitle('drama-2');
  const edge = startDrag(); edge.move(-800); edge.release(-800); await finishAnimation(500);
  expectActiveDramaTitle('drama-2');
  const back = startDrag(); back.move(500); back.release(500); await finishAnimation(0);
  const beyond = startDrag(); beyond.move(800); beyond.release(800); await finishAnimation(0);
  expectActiveDramaTitle('drama-1');
});

test('a tap on the background does not mount hidden buttons under its touch', async () => {
  await loadScreen({ count: 1, resolvePlayers: false });
  expect(screen.queryByRole('button', { name: '작품 공유' })).toBeNull();
  expect(screen.queryByRole('button', { name: '작품 저장' })).toBeNull();
  fireEvent.press(feedInstance());
  expect(screen.queryByRole('button', { name: '작품 저장' })).toBeNull();
});

test('the first drag keeps its original visible background target and controls mounted until release', async () => {
  await loadScreen({ count: 3 });
  jest.useFakeTimers();
  const drag = startDrag(); drag.move(-120);
  const saveButton = screen.getByRole('button', { name: '작품 저장' });
  expect(screen.UNSAFE_getByType(Slider)).toBeTruthy();
  drag.release(-120);
  await advanceFrames(20);
  expect(screen.getByRole('button', { name: '작품 저장' }).props.accessibilityLabel).toBe(saveButton.props.accessibilityLabel);
  expectActiveDramaTitle('drama-1');
  await nativeScrollArrival(0);
  expect(screen.getByRole('button', { name: '작품 저장' })).toBeTruthy();
});

test('a vertical drag starting on a Pressable cancels its web click, while the next tap runs once', async () => {
  const { feed } = await loadScreen({ count: 1, platform: 'web' });
  const share = screen.getByRole('button', { name: '작품 공유' });
  const shareAction = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'dismissedAction' });
  const drag = startDrag(); drag.move(-40); drag.release(-40);
  const click = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
  act(() => feed.dispatchEvent(click));
  expect(click.defaultPrevented).toBe(true);
  expect(shareAction).not.toHaveBeenCalled();
  act(() => feed.dispatchEvent(new Event('pointerdown', { bubbles: true })));
  fireEvent.press(share);
  expect(shareAction).toHaveBeenCalledTimes(1);
  const keyboardClick = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 });
  act(() => feed.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true })));
  act(() => feed.dispatchEvent(keyboardClick));
  expect(keyboardClick.defaultPrevented).toBe(false);
  const touchDrag = startDrag(); touchDrag.move(-40); touchDrag.release(-40);
  act(() => feed.dispatchEvent(new Event('touchstart', { bubbles: true })));
  fireEvent.press(share);
  expect(shareAction).toHaveBeenCalledTimes(2);
});

test('web wheel normalizes deltas and waits for actual arrival and 150ms quiet', async () => {
  const { feed, addFeedListener, removeFeedListener } = await loadScreen({ count: 4, platform: 'web' });
  jest.useFakeTimers();
  expect(addFeedListener).toHaveBeenCalledWith('wheel', expect.any(Function), { passive: false });
  const partial = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 3, deltaMode: 1 });
  act(() => feed.dispatchEvent(partial));
  expect(partial.defaultPrevented).toBe(true);
  expectActiveDramaTitle('drama-1');
  const forward = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 40 });
  const reverse = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -20 });
  const partialAgain = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 25 });
  act(() => feed.dispatchEvent(forward));
  act(() => feed.dispatchEvent(reverse));
  act(() => feed.dispatchEvent(partialAgain));
  expectActiveDramaTitle('drama-1');
  const move = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120, deltaMode: 0 });
  act(() => feed.dispatchEvent(move));
  await advanceFrames(7);
  act(() => feed.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 12 })));
  await advanceFrames(7);
  expectActiveDramaTitle('drama-1');
  await nativeScrollArrival(500);
  expectActiveDramaTitle('drama-2');
  expect(canStartGesture(0, -40)).toBe(false);
  act(() => feed.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 110 })));
  expectActiveDramaTitle('drama-2');
  await act(async () => jest.advanceTimersByTimeAsync(150));
  expect(canStartGesture(0, -40)).toBe(true);
  act(() => feed.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 0.2, deltaMode: 2 })));
  // The RAF phase can leave the 220ms motion just short after 14 frames; one bounded frame covers that offset.
  await advanceFrames(15);
  expectActiveDramaTitle('drama-2');
  await nativeScrollArrival(1000);
  await resolvePreview('preview-drama-3');
  expectActiveDramaTitle('drama-3');
  const latestWheelRegistration = [...addFeedListener.mock.calls].reverse().find(([type]) => type === 'wheel');
  expect(latestWheelRegistration).toBeDefined();
  const currentWheelListener = latestWheelRegistration![1];
  expect(removeFeedListener.mock.calls.some(([type, listener]) => type === 'wheel' && listener === currentWheelListener)).toBe(false);
  const activeWheelListeners = addFeedListener.mock.calls.filter(([type]) => type === 'wheel').length
    - removeFeedListener.mock.calls.filter(([type]) => type === 'wheel').length;
  expect(activeWheelListeners).toBe(1);
  await navigateToOther();
  expect(removeFeedListener).toHaveBeenCalledWith('wheel', currentWheelListener);
  const remainingWheelListeners = addFeedListener.mock.calls.filter(([type]) => type === 'wheel').length
    - removeFeedListener.mock.calls.filter(([type]) => type === 'wheel').length;
  expect(remainingWheelListeners).toBe(0);
});

test('wheel inertia during motion is consumed; resize and blur cancel stale animation frames', async () => {
  const { feed, nativeScroll, removeFeedListener } = await loadScreen({ count: 3, platform: 'web' });
  jest.useFakeTimers();
  const firstPage = startDrag(); firstPage.move(-300); firstPage.release(-300);
  await finishAnimation(500);
  const first = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 110 });
  act(() => feed.dispatchEvent(first));
  await advanceFrames(7);
  const tail = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 12 });
  act(() => feed.dispatchEvent(tail));
  expect(tail.defaultPrevented).toBe(true);
  await advanceFrames(7);
  await nativeScrollArrival(1000);
  await resolvePreview('preview-drama-3');
  expectActiveDramaTitle('drama-3');
  expect(canStartGesture(0, -40)).toBe(false);
  const frameCount = nativeScroll.scrollTo.mock.calls.length;
  act(() => feed.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 110 })));
  expect(nativeScroll.scrollTo.mock.calls.length).toBe(frameCount);
  await feedLayout(600);
  fireEvent(listInstance(), 'contentSizeChange', 1100, 1800);
  expect(nativeScroll.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ y: expect.any(Number) }));
  await nativeScrollArrival(1200, 600);
  await navigateToOther();
  expect(removeFeedListener).toHaveBeenCalledWith('wheel', expect.any(Function));
  const settledScrollCalls = nativeScroll.scrollTo.mock.calls.length;
  await act(async () => jest.advanceTimersByTimeAsync(300));
  expect(nativeScroll.scrollTo).toHaveBeenCalledTimes(settledScrollCalls);
});

test('resize waits for the latest content size and aligns the actual offset on the last card', async () => {
  const { nativeScroll } = await loadScreen({ count: 4 });
  jest.useFakeTimers();
  for (let index = 1; index < 4; index += 1) {
    const drag = startDrag(); drag.move(-300); drag.release(-300); await finishAnimation(index * 500);
    if (index < 3) await resolvePreview(`preview-drama-${index + 2}`);
  }
  expectActiveDramaTitle('drama-4');
  const before = nativeScroll.scrollTo.mock.calls.length;
  await feedLayout(800);
  fireEvent(listInstance(), 'contentSizeChange', 1100, 2000);
  expect(nativeScroll.scrollTo.mock.calls.length).toBe(before);
  fireEvent(listInstance(), 'contentSizeChange', 1100, 3200);
  expect(nativeScroll.scrollTo).toHaveBeenLastCalledWith({ y: 2400, animated: false });
  await nativeScrollArrival(2400, 800);
  expectActiveDramaTitle('drama-4');
  const afterGrow = nativeScroll.scrollTo.mock.calls.length;
  await feedLayout(700);
  fireEvent(listInstance(), 'contentSizeChange', 1100, 3200);
  expect(nativeScroll.scrollTo.mock.calls.length).toBe(afterGrow);
  fireEvent(listInstance(), 'contentSizeChange', 1100, 2800);
  expect(nativeScroll.scrollTo).toHaveBeenLastCalledWith({ y: 2100, animated: false });
  await nativeScrollArrival(2100, 700);
  expectActiveDramaTitle('drama-4');
});

test('a resize at the first card releases the alignment lock without waiting for an unnecessary scroll event', async () => {
  const { nativeScroll, feed } = await loadScreen({ count: 3, platform: 'web' });
  await feedLayout(800);
  expect(canStartGesture(0, -40)).toBe(false);
  const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 });
  act(() => feed.dispatchEvent(wheel));
  expect(wheel.defaultPrevented).toBe(true);
  expect(nativeScroll.scrollTo).not.toHaveBeenCalled();
  fireEvent(listInstance(), 'contentSizeChange', 1100, 2400);
  expect(nativeScroll.scrollTo).not.toHaveBeenCalled();
  expect(canStartGesture(0, -40)).toBe(true);
});

test('a resize with the actual committed offset refreshes the requested drag origin', async () => {
  const { nativeScroll } = await loadScreen({ count: 3 });
  jest.useFakeTimers();
  const next = startDrag(); next.move(-300); next.release(-300); await finishAnimation(500);
  await nativeScrollArrival(500);
  expectActiveDramaTitle('drama-2');
  await feedLayout(600);
  fireEvent(listInstance(), 'contentSizeChange', 1100, 1800);
  expect(nativeScroll.scrollTo).toHaveBeenLastCalledWith({ y: 600, animated: false });
  await nativeScrollArrival(600, 600);
  const afterResize = startDrag(); afterResize.move(-20);
  expect(nativeScroll.scrollTo).toHaveBeenLastCalledWith({ y: 620, animated: false });
});

test('web wheel leaves horizontal and interactive targets alone', async () => {
  const { feed } = await loadScreen({ count: 2, platform: 'web' });
  const horizontal = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 40, deltaY: 10 });
  const interactiveTarget = document.createElement('button');
  feed.append(interactiveTarget);
  const interactive = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 200 });
  act(() => feed.dispatchEvent(horizontal));
  act(() => interactiveTarget.dispatchEvent(interactive));
  expect(horizontal.defaultPrevented).toBe(false);
  expect(interactive.defaultPrevented).toBe(false);
});

test('an animation can finish before the wheel quiet timer without admitting its inertia tail', async () => {
  const { feed } = await loadScreen({ count: 3, platform: 'web' });
  jest.useFakeTimers();
  act(() => feed.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 110 })));
  await advanceFrames(7);
  act(() => feed.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 12 })));
  await advanceFrames(7);
  expectActiveDramaTitle('drama-1');
  await nativeScrollArrival(500);
  expectActiveDramaTitle('drama-2');
  expect(canStartGesture(0, -40)).toBe(false);
  act(() => feed.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 })));
  expectActiveDramaTitle('drama-2');
  await act(async () => jest.advanceTimersByTimeAsync(150));
  expect(canStartGesture(0, -40)).toBe(true);
  act(() => feed.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 110 })));
  // The RAF phase can leave the 220ms motion just short after 14 frames; one bounded frame covers that offset.
  await advanceFrames(15);
  expectActiveDramaTitle('drama-2');
  await nativeScrollArrival(1000);
  await resolvePreview('preview-drama-3');
  expectActiveDramaTitle('drama-3');
});

test('an unready or failed preview does not block the following gesture', async () => {
  await loadScreen({ count: 3, resolvePlayers: false });
  jest.useFakeTimers();
  const first = startDrag(); first.move(-300); first.release(-250); await finishAnimation(500);
  expect(requestFor('preview-drama-2').target).toEqual({ dramaId: 'drama-2', videoId: 'preview-drama-2' });
  await act(async () => requestFor('preview-drama-2').task.reject(new Error('preview unavailable')));
  const next = startDrag(); next.move(-500); next.release(-500); await finishAnimation(1000);
  await waitFor(() => expect(getDramaContent).toHaveBeenLastCalledWith('drama-3'));
  await resolvePreview('preview-drama-3');
  expectActiveDramaTitle('drama-3');
});
