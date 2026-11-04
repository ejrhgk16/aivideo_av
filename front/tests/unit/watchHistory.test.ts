import type { WatchHistoryItem } from '../../src/features/playback/playbackResponses';

let ApiError: typeof import('../../src/common/http/api').ApiError;
let watchHistoryApi: typeof import('../../src/features/playback/watchHistory');
let configureSessionClient: typeof import('../../src/features/user/sessionClient').configureSessionClient;

beforeEach(() => {
  jest.isolateModules(() => {
    ({ ApiError } = require('../../src/common/http/api'));
    watchHistoryApi = require('../../src/features/playback/watchHistory');
    ({ configureSessionClient } = require('../../src/features/user/sessionClient'));
  });
});

test('watch history uses required auth, preserves pages and response fields, and makes no mutations', async () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const episode: WatchHistoryItem = {
    videoUuid: 'episode-video',
    contentType: 'EPISODE',
    lastPlayedAt: '2026-11-03T00:00:00.000Z',
    dramaUuid: 'drama-1',
    dramaTitle: '작품',
    imageUrl: null,
    durationMs: 420000,
    episodeUuid: 'episode-1',
    episodeNumber: 1,
    episodeTitle: '첫 화',
  };
  const preview: WatchHistoryItem = {
    videoUuid: 'preview-video',
    contentType: 'PREVIEW',
    lastPlayedAt: '2026-11-02T00:00:00.000Z',
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
    return { ok: true, status: 200, json: async () => ({ items: [episode, preview], page: requests.length, hasNext: requests.length === 1 }) } as Response;
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

    const anonymousHistory = watchHistoryApi.getWatchHistory();
    await expect(anonymousHistory).rejects.toBeInstanceOf(ApiError);
    await expect(anonymousHistory).rejects.toMatchObject({ status: 401 });
    await client.login({ loginId: 'test', password: 'test' });
    const first = await watchHistoryApi.getWatchHistory();
    const second = await watchHistoryApi.getWatchHistory(2);

    expect(requests.map(({ url }) => url)).toEqual([
      'http://localhost:3000/me/watch-history?page=1',
      'http://localhost:3000/me/watch-history?page=2',
    ]);
    expect((requests[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer access-token');
    expect(first).toEqual({ items: [episode, preview], page: 1, hasNext: true });
    expect(second).toEqual({ items: [episode, preview], page: 2, hasNext: false });
    expect(Object.keys(first.items[0]).sort()).toEqual([
      'contentType', 'dramaTitle', 'dramaUuid', 'durationMs', 'episodeNumber', 'episodeTitle',
      'episodeUuid', 'imageUrl', 'lastPlayedAt', 'videoUuid',
    ].sort());
    expect(first.items[0].lastPlayedAt).toBe('2026-11-03T00:00:00.000Z');
    expect(first.items[1].episodeUuid).toBeNull();
    expect(requests.some(({ init }) => ['PUT', 'POST', 'DELETE'].includes(init?.method ?? 'GET'))).toBe(false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});
