/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../../src/common/http/api';
import { getSavedVideos, removeSavedVideo, saveVideo, savedVideoRoute, type SavedVideoItem } from '../../src/features/playback/savedVideos';
import { configureSessionClient } from '../../src/features/user/sessionClient';

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

    await assert.rejects(saveVideo('preview-video', 'PREVIEW'), (error) =>
      error instanceof ApiError && error.status === 401);
    await client.login({ loginId: 'test', password: 'test' });
    await saveVideo('episode/video', 'EPISODE');
    await saveVideo('preview-video', 'PREVIEW');
    await removeSavedVideo('episode/video');
    const page = await getSavedVideos(2);

    assert.deepEqual(requests.map(({ url }) => url), [
      'http://localhost:3000/me/saved-videos/episode%2Fvideo',
      'http://localhost:3000/me/saved-videos/preview-video',
      'http://localhost:3000/me/saved-videos/episode%2Fvideo',
      'http://localhost:3000/me/saved-videos?page=2',
    ]);
    assert.deepEqual(requests.slice(0, 2).map(({ init }) => ({
      method: init?.method,
      body: init?.body,
    })), [
      { method: 'PUT', body: JSON.stringify({ contentType: 'EPISODE' }) },
      { method: 'PUT', body: JSON.stringify({ contentType: 'PREVIEW' }) },
    ]);
    assert.equal(requests[2].init?.method, 'DELETE');
    assert.equal(requests[2].init?.body, undefined);
    assert.equal((requests[0].init?.headers as Record<string, string>).Authorization, 'Bearer access-token');
    assert.deepEqual(page, { items: [episode, preview], page: 2, hasNext: false });
    assert.deepEqual(savedVideoRoute(episode), {
      pathname: '/episode/[id]',
      params: { id: 'episode-1', dramaId: 'drama-1' },
    });
    assert.deepEqual(savedVideoRoute(preview), {
      pathname: '/preview/[dramaId]/[videoId]',
      params: { dramaId: 'drama-1', videoId: 'preview-video' },
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});
