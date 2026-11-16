import type { WatchHistoryItem } from '../../src/features/playback/playbackResponses';
import type { SavedVideoItem } from '../../src/features/playback/savedVideos';

let ApiError: typeof import('../../src/common/http/api').ApiError;
let savedVideosApi: typeof import('../../src/features/playback/savedVideos');
let configureSessionClient: typeof import('../../src/features/user/sessionClient').configureSessionClient;

beforeEach(() => {
  jest.isolateModules(() => {
    ({ ApiError } = require('../../src/common/http/api'));
    savedVideosApi = require('../../src/features/playback/savedVideos');
    ({ configureSessionClient } = require('../../src/features/user/sessionClient'));
  });
});

test('saved-video requests use required auth, the existing endpoints, and type-specific routes', async () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const episode: SavedVideoItem = {
    videoUuid: 'episode-video',
    contentType: 'EPISODE',
    savedAt: '2026-11-01T00:00:00.000Z',
    dramaUuid: 'drama-1',
    dramaTitle: '작품',
    imageUrl: null,
    durationMs: 420000,
    episodeUuid: 'episode-1',
    episodeNumber: 1,
    episodeTitle: '첫 화',
  };
  const preview: SavedVideoItem = {
    videoUuid: 'preview-video',
    contentType: 'PREVIEW',
    savedAt: '2026-11-01T00:00:00.000Z',
    dramaUuid: 'drama-1',
    dramaTitle: '작품',
    imageUrl: null,
    durationMs: 30000,
    episodeUuid: null,
    episodeNumber: null,
    episodeTitle: null,
  };

  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  globalThis.fetch = (async (input, init) => {
    requests.push({ url: String(input), init });
    if (String(input).includes('?page=')) {
      return { ok: true, status: 200, json: async () => ({ items: [episode, preview], page: 2, hasNext: false }) } as Response;
    }
    return { ok: true, status: 204 } as Response;
  }) as typeof fetch;

  try {
    const client = configureSessionClient({
      baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
      storage: { read: async () => null, write: async () => {}, remove: async () => {} },
      fetcher: ((input, init) => globalThis.fetch(input, init)) as typeof fetch,
      loginRequest: async () => ({
        uuid: 'user-1', displayName: null, accountType: 'MEMBER', availablePoints: 80,
        accessToken: 'access-token', refreshToken: 'refresh-token', expiresIn: 900,
      }),
    });

    const anonymousSave = savedVideosApi.saveVideo('preview-video', 'PREVIEW');
    await expect(anonymousSave).rejects.toBeInstanceOf(ApiError);
    await expect(anonymousSave).rejects.toMatchObject({ status: 401 });
    await client.login({ loginId: 'test', password: 'test' });
    await savedVideosApi.saveVideo('episode/video', 'EPISODE');
    await savedVideosApi.saveVideo('preview-video', 'PREVIEW');
    await savedVideosApi.removeSavedVideo('episode/video');
    const page = await savedVideosApi.getSavedVideos(2);

    expect(requests.map(({ url }) => url)).toEqual([
      'http://localhost:3000/me/saved-videos/episode%2Fvideo',
      'http://localhost:3000/me/saved-videos/preview-video',
      'http://localhost:3000/me/saved-videos/episode%2Fvideo',
      'http://localhost:3000/me/saved-videos?page=2',
    ]);
    expect(requests.slice(0, 2).map(({ init }) => ({
      method: init?.method,
      body: init?.body,
    }))).toEqual([
      { method: 'PUT', body: JSON.stringify({ contentType: 'EPISODE' }) },
      { method: 'PUT', body: JSON.stringify({ contentType: 'PREVIEW' }) },
    ]);
    expect(requests[2].init?.method).toBe('DELETE');
    expect(requests[2].init?.body).toBeUndefined();
    expect((requests[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer access-token');
    expect(page).toEqual({ items: [episode, preview], page: 2, hasNext: false });
    expect(savedVideosApi.savedVideoRoute(episode)).toEqual({
      pathname: '/episode/[id]',
      params: { id: 'episode-1', dramaId: 'drama-1' },
    });
    expect(savedVideosApi.savedVideoRoute(preview)).toEqual({
      pathname: '/preview/[dramaId]/[videoId]',
      params: { dramaId: 'drama-1', videoId: 'preview-video' },
    });
    const historyEpisode: WatchHistoryItem = {
      videoUuid: episode.videoUuid,
      contentType: episode.contentType,
      lastPlayedAt: '2026-11-03T00:00:00.000Z',
      dramaUuid: episode.dramaUuid,
      dramaTitle: episode.dramaTitle,
      imageUrl: episode.imageUrl,
      durationMs: episode.durationMs,
      episodeUuid: episode.episodeUuid,
      episodeNumber: episode.episodeNumber,
      episodeTitle: episode.episodeTitle,
    };
    const historyPreview: WatchHistoryItem = {
      videoUuid: preview.videoUuid,
      contentType: preview.contentType,
      lastPlayedAt: '2026-11-02T00:00:00.000Z',
      dramaUuid: preview.dramaUuid,
      dramaTitle: preview.dramaTitle,
      imageUrl: preview.imageUrl,
      durationMs: preview.durationMs,
      episodeUuid: preview.episodeUuid,
      episodeNumber: preview.episodeNumber,
      episodeTitle: preview.episodeTitle,
    };
    expect(savedVideosApi.savedVideoRoute(historyEpisode)).toEqual(savedVideosApi.savedVideoRoute(episode));
    expect(savedVideosApi.savedVideoRoute(historyPreview)).toEqual(savedVideosApi.savedVideoRoute(preview));
    expect(requests).toHaveLength(4);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});
