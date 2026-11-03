/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../../src/common/http/api';
import { getWatchHistory, type WatchHistoryItem } from '../../src/features/playback/watchHistory';
import { configureSessionClient } from '../../src/features/user/sessionClient';

test('watch history uses required auth, page URLs, and preserves the history response shape', async () => {
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

    await assert.rejects(getWatchHistory(), (error) => error instanceof ApiError && error.status === 401);
    await client.login({ loginId: 'test', password: 'test' });
    const first = await getWatchHistory();
    const second = await getWatchHistory(2);

    assert.deepEqual(requests.map(({ url }) => url), [
      'http://localhost:3000/me/watch-history?page=1',
      'http://localhost:3000/me/watch-history?page=2',
    ]);
    assert.equal((requests[0].init?.headers as Record<string, string>).Authorization, 'Bearer access-token');
    assert.deepEqual(first, { items: [episode, preview], page: 1, hasNext: true });
    assert.deepEqual(second, { items: [episode, preview], page: 2, hasNext: false });
    assert.deepEqual(Object.keys(first.items[0]).sort(), [
      'contentType', 'dramaTitle', 'dramaUuid', 'durationMs', 'episodeNumber', 'episodeTitle',
      'episodeUuid', 'imageUrl', 'lastPlayedAt', 'videoUuid',
    ].sort());
    assert.equal(first.items[0].lastPlayedAt, '2026-11-03T00:00:00.000Z');
    assert.equal(first.items[1].episodeUuid, null);
    assert.equal(requests.some(({ init }) => ['PUT', 'POST', 'DELETE'].includes(init?.method ?? 'GET')), false,
      'reading history does not record progress or change saved videos');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});
