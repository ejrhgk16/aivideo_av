import { FlatList, Text, View } from 'react-native';
import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { renderRouter, testRouter } from 'expo-router/testing-library';
import type { EpisodeUnlockDialog } from '@/components/EpisodeUnlockDialog';
import { getDramaContent } from '@/features/drama/dramaContent';
import type { DramaContent } from '@/features/drama/dramaResponses';
import { getHomeCollection } from '@/features/home/homeContent';
import type { HomeCollectionDrama } from '@/features/home/homeResponses';
import { getPreviewPlayback } from '@/features/playback/previewPlayback';
import { saveWatchProgress } from '@/features/playback/watchProgress';
import { useUser } from '@/features/user/UserProvider';
import { RecommendationScreen } from '@/screens/RecommendationScreen';
import { mockVideoPlayers } from '../support/video';

jest.mock('@/features/drama/dramaContent', () => ({ getDramaContent: jest.fn() }));
jest.mock('@/features/home/homeContent', () => ({ getHomeCollection: jest.fn() }));
jest.mock('@/features/playback/previewPlayback', () => ({ getPreviewPlayback: jest.fn() }));
jest.mock('@/features/playback/savedVideos', () => ({ removeSavedVideo: jest.fn(), saveVideo: jest.fn() }));
jest.mock('@/features/playback/watchProgress', () => ({
  ...jest.requireActual('@/features/playback/watchProgress'),
  saveWatchProgress: jest.fn(),
}));
jest.mock('@/features/user/UserProvider', () => ({ useUser: jest.fn() }));
// 결제 창 자체는 episodeUnlockDialog.test.tsx가 검사한다. 여기서는 구매 성공 뒤 빼꼼 화면의 잠금 상태만 본다.
jest.mock('@/components/EpisodeUnlockDialog', () => ({
  EpisodeUnlockDialog: ({ episode, onClose, onPurchased }: React.ComponentProps<typeof EpisodeUnlockDialog>) => {
    const { Pressable: MockPressable, Text: MockText } = jest.requireActual<typeof import('react-native')>('react-native');
    if (!episode) return null;
    return <MockPressable accessibilityRole="button" accessibilityLabel={`${episode.episodeNumber}화 구매`} onPress={() => { onClose(); onPurchased(episode); }}>
      <MockText>잠긴 회차</MockText>
    </MockPressable>;
  },
}));

const session: ReturnType<typeof useUser> = {
  user: { uuid: 'user-1', displayName: null, accountType: 'MEMBER' }, points: 120, accessToken: 'access-test', isRestoring: false,
  restoreError: null, sessionExpired: false, sessionVersion: 1,
  subtitlesEnabled: true, preferredSubtitleLanguage: 'ko', autoplayNext: false, setUser: jest.fn(), setPoints: jest.fn(),
  login: jest.fn(), logout: jest.fn(), dismissSessionExpired: jest.fn(),
  isCurrentSession: (version) => version === 1,
  setSubtitlesEnabled: jest.fn(), setPreferredSubtitleLanguage: jest.fn(), setAutoplayNext: jest.fn(),
};

const lockedDrama: HomeCollectionDrama = {
  uuid: 'drama-locked', displayOrder: 1, slug: 'locked', title: '잠긴 작품', shortDescription: '소개', productionCompany: null,
  genres: [], imageUrls: { poster: null, posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] },
  previewVideos: [{ uuid: 'preview-locked', storageKey: '', durationMs: 60_000, isSaved: false }],
  publishedEpisodeCount: 1, freeEpisodeCount: 0,
};
const content = (isUnlocked: boolean): DramaContent => ({
  uuid: lockedDrama.uuid, slug: 'locked', title: lockedDrama.title, shortDescription: '', synopsis: '', productionCompany: null,
  genres: [], imageUrls: lockedDrama.imageUrls, previewVideos: lockedDrama.previewVideos,
  episodes: [{ uuid: 'ep-1', episodeNumber: 1, title: null, synopsis: null, durationMs: 60_000, videoUuid: null, isSaved: false, pricePoints: 10, isUnlocked, image: null, watchProgress: null }],
});

function EpisodeTarget() {
  const { id, dramaId } = useLocalSearchParams<{ id: string; dramaId: string }>();
  return <Text>{`${dramaId}:${id}`}</Text>;
}

async function showControls() {
  await waitFor(() => expect(screen.UNSAFE_getAllByType(View).some((item) => typeof item.props.onLayout === 'function'
    && typeof item.props.onMoveShouldSetResponderCapture === 'function')).toBe(true));
  const feed = screen.UNSAFE_getAllByType(View).find((item) => typeof item.props.onLayout === 'function'
    && typeof item.props.onMoveShouldSetResponderCapture === 'function')!;
  fireEvent(feed, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 700 } } });
  await waitFor(() => screen.UNSAFE_getByType(FlatList));
  fireEvent(screen.UNSAFE_getByType(FlatList), 'contentSizeChange', 400, 700);
  await waitFor(() => expect(mockVideoPlayers.length).toBeGreaterThan(0));
  act(() => mockVideoPlayers[mockVideoPlayers.length - 1].emit('statusChange', { status: 'readyToPlay' }));
}

test('an episode bought from 빼꼼 plays without the lock dialog when the same drama is opened again', async () => {
  let purchased = false;
  jest.mocked(useUser).mockReturnValue(session);
  jest.mocked(getHomeCollection).mockResolvedValue({ code: 'RECOMMENDATION_DAILY', title: '추천', description: null, dramas: [lockedDrama] });
  jest.mocked(getDramaContent).mockImplementation(async () => content(purchased));
  jest.mocked(getPreviewPlayback).mockResolvedValue({ url: 'https://cdn.example.test/locked.mp4', videoUuid: 'preview-locked', isSaved: false, durationMs: 60_000 });
  jest.mocked(saveWatchProgress).mockResolvedValue(undefined);
  const view = renderRouter({
    _layout: () => <Stack screenOptions={{ headerShown: false, animation: 'none' }} />,
    index: () => <RecommendationScreen initialId={undefined} />,
    'episode/[id]': EpisodeTarget,
  }, { initialUrl: '/' });

  await showControls();
  await userEvent.setup().press(await screen.findByRole('button', { name: '1화 보기' }));
  expect(screen.getByText('잠긴 회차')).toBeOnTheScreen();
  purchased = true;
  fireEvent.press(screen.getByRole('button', { name: '1화 구매' }));
  expect(await screen.findByText('drama-locked:ep-1')).toBeOnTheScreen();

  testRouter.back('/');
  await showControls();
  await userEvent.setup().press(await screen.findByRole('button', { name: '1화 보기' }));
  expect(screen.queryByText('잠긴 회차')).toBeNull();
  expect(await screen.findByText('drama-locked:ep-1')).toBeOnTheScreen();
  expect(view.getPathnameWithParams()).toBe('/episode/ep-1?dramaId=drama-locked');
});
