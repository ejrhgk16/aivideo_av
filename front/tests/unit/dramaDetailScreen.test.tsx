import React from 'react';
import { Pressable, Text } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter, testRouter } from 'expo-router/testing-library';
import { Stack } from 'expo-router';
import { ApiError } from '@/common/http/api';
import { getDramaContent, type DramaContent } from '@/features/drama/dramaContent';
import { useUser, type User } from '@/features/user/UserProvider';
import { DramaDetailScreen } from '@/screens/DramaDetailScreen';

jest.mock('@/features/drama/dramaContent', () => ({ getDramaContent: jest.fn() }));
jest.mock('@/features/user/UserProvider', () => ({ useUser: jest.fn() }));
beforeEach(() => {
  jest.mocked(getDramaContent).mockReset();
  jest.mocked(useUser).mockReset();
});
jest.mock('@/components/EpisodeUnlockDialog', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    EpisodeUnlockDialog: (props: {
      episode: DramaContent['episodes'][number] | null;
      onPurchased: (episode: DramaContent['episodes'][number]) => void;
      onCharge: () => void;
      onClose: () => void;
    }) => props.episode ? React.createElement(React.Fragment, null,
      React.createElement(Pressable, {
        accessibilityRole: 'button', accessibilityLabel: '구매 완료 테스트',
        onPress: () => props.onPurchased(props.episode!),
      }, React.createElement(Text, null, '구매 완료')),
      React.createElement(Pressable, {
        accessibilityRole: 'button', accessibilityLabel: '포인트 충전 이동 테스트', onPress: props.onCharge,
      }, React.createElement(Text, null, '충전')),
      React.createElement(Pressable, {
        accessibilityRole: 'button', accessibilityLabel: '팝업 닫기 테스트', onPress: props.onClose,
      }, React.createElement(Text, null, '닫기')),
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

const drama: DramaContent = {
  uuid: 'drama-1', slug: 'drama', title: '작품', shortDescription: '소개', synopsis: '작품 소개',
  productionCompany: null, genres: [],
  imageUrls: { poster: null, posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] },
  previewVideos: [],
  episodes: [
    { uuid: 'free', episodeNumber: 1, title: null, synopsis: null, durationMs: 100, videoUuid: 'v-free', isSaved: false, pricePoints: 0, isUnlocked: true, image: null, watchProgress: { positionMs: 0, isCompleted: false, lastPlayedAt: '2026-10-08T12:34:56.789Z' } },
    { uuid: 'owned', episodeNumber: 2, title: null, synopsis: null, durationMs: 100, videoUuid: 'v-owned', isSaved: false, pricePoints: 30, isUnlocked: true, image: null, watchProgress: null },
    { uuid: 'locked', episodeNumber: 3, title: null, synopsis: null, durationMs: 100, videoUuid: 'v-locked', isSaved: false, pricePoints: 50, isUnlocked: false, image: null, watchProgress: { positionMs: 10, isCompleted: true, lastPlayedAt: '2026-10-08T12:34:56.789Z' } },
    { uuid: 'locked-2', episodeNumber: 4, title: null, synopsis: null, durationMs: 100, videoUuid: 'v-locked-2', isSaved: false, pricePoints: 80, isUnlocked: false, image: null, watchProgress: null },
    { uuid: 'free-2', episodeNumber: 5, title: null, synopsis: null, durationMs: 100, videoUuid: 'v-free-2', isSaved: false, pricePoints: 0, isUnlocked: true, image: null, watchProgress: null },
  ],
};

const makeUser = (uuid: string): User => ({ uuid, displayName: null, accountType: 'MEMBER' });
const makeSession = (user: User | null, version: number, isRestoring = false): ReturnType<typeof useUser> => ({
  user, points: user ? 200 : null, accessToken: null, isRestoring, restoreError: null,
  sessionExpired: false, sessionVersion: version, subtitlesEnabled: true, autoplayNext: false,
  setUser: jest.fn(), setPoints: jest.fn(), login: jest.fn(), logout: jest.fn(),
  dismissSessionExpired: jest.fn(), isCurrentSession: (candidate: number) => candidate === version,
  setSubtitlesEnabled: jest.fn(), setAutoplayNext: jest.fn(),
});

function renderDetail(initialSession: ReturnType<typeof useUser> = makeSession(makeUser('user-1'), 1)) {
  const request = deferred<DramaContent>();
  jest.mocked(useUser).mockReturnValue(initialSession);
  jest.mocked(getDramaContent).mockReturnValue(request.promise);
  const view = renderRouter({
    _layout: () => <Stack screenOptions={{ animation: 'none' }} />,
    index: () => <DramaDetailScreen id="drama-1" />,
    'episode/[id]': () => <Text>회차 플레이어</Text>,
    login: () => <Text>로그인 화면</Text>,
    points: () => <Text>포인트 화면</Text>,
    'preview/[dramaId]/[videoId]': () => <Text>미리보기 화면</Text>,
  }, { initialUrl: '/' });
  return { ...view, request };
}

async function resolveDrama(request: Deferred<DramaContent>, value = drama) {
  await act(async () => { request.resolve(value); await request.promise; });
}

test('drama detail distinguishes free, purchased and locked episodes and routes playable records', async () => {
  const view = renderDetail();
  expect(getDramaContent).toHaveBeenCalledWith('drama-1');
  await resolveDrama(view.request);
  expect(screen.getByRole('tab', { name: /전체 회차/ })).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('tab', { name: /전체 회차/ }));

  const free = screen.getByRole('button', { name: '1화 무료' });
  expect(screen.getAllByText('무료')).toHaveLength(2);
  expect(screen.getByText('50P')).toBeOnTheScreen();
  expect(screen.queryByText('공개된 회차가 아직 없어요')).toBeNull();

  fireEvent.press(free);
  await screen.findByText('회차 플레이어');
  expect(view.getPathnameWithParams()).toBe('/episode/free?dramaId=drama-1');
  testRouter.back('/');
  await waitFor(() => expect(view.getPathnameWithParams()).toBe('/'));
  fireEvent.press(screen.getByRole('button', { name: '2화' }));
  await screen.findByText('회차 플레이어');
  expect(view.getPathnameWithParams()).toBe('/episode/owned?dramaId=drama-1');
  testRouter.back('/');
  await waitFor(() => expect(view.getPathnameWithParams()).toBe('/'));
  fireEvent.press(screen.getByRole('button', { name: '3화 50포인트' }));
  expect(screen.getByRole('button', { name: '구매 완료 테스트' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '4화 80포인트' })).toBeOnTheScreen();
  view.unmount();
});

test('drama detail reloads entitlements on account changes and ignores stale responses', async () => {
  const first = deferred<DramaContent>();
  const second = deferred<DramaContent>();
  jest.mocked(useUser).mockReturnValue(makeSession(makeUser('account-a'), 1));
  jest.mocked(getDramaContent).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  let update!: (session: ReturnType<typeof useUser>) => void;
  function AccountScreen() {
    const [session, setSession] = React.useState<ReturnType<typeof useUser>>(makeSession(makeUser('account-a'), 1));
    update = setSession;
    jest.mocked(useUser).mockReturnValue(session);
    return <DramaDetailScreen id="drama-1" />;
  }
  const view = renderRouter({ _layout: () => <Stack screenOptions={{ animation: 'none' }} />, index: AccountScreen, 'episode/[id]': () => <Text>회차 플레이어</Text> }, { initialUrl: '/?tab=episodes' });
  await act(async () => update(makeSession(makeUser('account-b'), 2)));
  expect(getDramaContent).toHaveBeenCalledTimes(2);
  expect(screen.getByText('작품 정보를 불러오는 중이에요')).toBeOnTheScreen();
  await act(async () => { first.resolve(drama); await first.promise; });
  expect(screen.getByText('작품 정보를 불러오는 중이에요')).toBeOnTheScreen();
  await act(async () => { second.resolve({ ...drama, episodes: drama.episodes.map((item) => item.uuid === 'locked' ? { ...item, isUnlocked: true } : item) }); await second.promise; });
  expect(screen.getByRole('button', { name: '3화' })).toBeOnTheScreen();
  view.unmount();
});

test('purchased callback unlocks only that episode locally before navigating', async () => {
  const initial = deferred<DramaContent>();
  jest.mocked(useUser).mockReturnValue(makeSession(makeUser('user-1'), 1));
  jest.mocked(getDramaContent).mockReturnValue(initial.promise);
  const view = renderRouter({
    _layout: () => <Stack screenOptions={{ animation: 'none' }} />,
    index: () => <DramaDetailScreen id="drama-1" />,
    'episode/[id]': () => <Text>회차 플레이어</Text>,
  }, { initialUrl: '/?tab=episodes' });
  await act(async () => { initial.resolve(drama); await initial.promise; });
  fireEvent.press(screen.getByRole('tab', { name: /전체 회차/ }));
  fireEvent.press(screen.getByRole('button', { name: '3화 50포인트' }));
  fireEvent.press(screen.getByRole('button', { name: '구매 완료 테스트' }));
  await screen.findByText('회차 플레이어');
  expect(view.getPathnameWithParams()).toBe('/episode/locked?dramaId=drama-1');
  testRouter.back('/?tab=episodes');
  await waitFor(() => expect(view.getPathnameWithParams()).toBe('/?tab=episodes'));
  await waitFor(() => expect(screen.getByRole('button', { name: '3화' })).toBeOnTheScreen());
  expect(getDramaContent).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: '4화 80포인트' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '5화 무료' })).toBeOnTheScreen();
  view.unmount();
});

test('detail waits for restoration, shows a 404 as missing, and retries other failures inline', async () => {
  const restoring = deferred<DramaContent>();
  jest.mocked(useUser).mockReturnValue(makeSession(null, 1, true));
  jest.mocked(getDramaContent).mockReturnValue(restoring.promise);
  const waiting = renderRouter({ _layout: () => <Stack screenOptions={{ animation: 'none' }} />, index: () => <DramaDetailScreen id="drama-1" /> }, { initialUrl: '/?tab=episodes' });
  expect(screen.getByText('작품 정보를 불러오는 중이에요')).toBeOnTheScreen();
  expect(getDramaContent).not.toHaveBeenCalled();
  waiting.unmount();

  const missingRequest = deferred<DramaContent>();
  jest.mocked(useUser).mockReturnValue(makeSession(null, 2));
  jest.mocked(getDramaContent).mockReturnValueOnce(missingRequest.promise);
  const missing = renderRouter({ _layout: () => <Stack screenOptions={{ animation: 'none' }} />, index: () => <DramaDetailScreen id="drama-1" /> }, { initialUrl: '/?tab=episodes' });
  await act(async () => { missingRequest.reject(new ApiError(404, null)); try { await missingRequest.promise; } catch {} });
  expect(await screen.findByText('작품을 찾을 수 없어요')).toBeOnTheScreen();
  missing.unmount();

  const failed = deferred<DramaContent>();
  const retry = deferred<DramaContent>();
  jest.mocked(getDramaContent).mockReturnValueOnce(failed.promise).mockReturnValueOnce(retry.promise);
  const error = renderRouter({ _layout: () => <Stack screenOptions={{ animation: 'none' }} />, index: () => <DramaDetailScreen id="drama-1" /> }, { initialUrl: '/?tab=episodes' });
  await act(async () => { failed.reject(new Error('offline')); try { await failed.promise; } catch {} });
  expect(await screen.findByText('작품 정보를 불러오지 못했어요')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));
  expect(getDramaContent).toHaveBeenCalledTimes(3);
  await resolveDrama(retry);
  expect(screen.getByRole('button', { name: '1화 무료' })).toBeOnTheScreen();
  error.unmount();
});
