/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../../src/common/http/api';
import { getEpisodePlayback } from '../../src/features/playback/episodePlayback';
import { configureSessionClient } from '../../src/features/user/sessionClient';

function configureApiClient() {
  configureSessionClient({
    baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
    storage: { read: async () => null, write: async () => {}, remove: async () => {} },
    fetcher: ((input, init) => globalThis.fetch(input, init)) as typeof fetch,
  });
}

test('episode playback encodes the id and resolves relative video URLs', async () => {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  const body = { url: '/media/video.mp4', title: '다시 만난 봄', episodeNumber: 1, durationMs: 420000 };
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000/api/';
  globalThis.fetch = (async (input) => {
    urls.push(String(input));
    return { ok: true, json: async () => body } as Response;
  }) as typeof fetch;

  try {
    configureApiClient();
    assert.deepEqual(await getEpisodePlayback('episode/1'), {
      ...body,
      url: 'http://localhost:3000/media/video.mp4',
    });
    assert.deepEqual(urls, ['http://localhost:3000/api/episodes/episode%2F1/playback']);
  } finally {
    globalThis.fetch = originalFetch;
    if (baseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = baseUrl;
  }
});

test('episode playback requests anonymously without adding an empty user query', async () => {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  const body = { url: '/media/video.mp4', title: null, episodeNumber: 1, durationMs: 420000 };
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000/api';
  globalThis.fetch = (async (input) => {
    urls.push(String(input));
    return { ok: true, json: async () => body } as Response;
  }) as typeof fetch;

  try {
    configureApiClient();
    await getEpisodePlayback('episode-1');
    assert.deepEqual(urls, ['http://localhost:3000/api/episodes/episode-1/playback']);
    assert.equal(urls[0].includes('undefined'), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (baseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = baseUrl;
  }
});

test('episode playback cannot select a caller-provided user UUID', async () => {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  const body = { url: '/media/video.mp4', title: null, episodeNumber: 1, durationMs: 420000 };
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000/api';
  globalThis.fetch = (async (input) => {
    urls.push(String(input));
    return { ok: true, json: async () => body } as Response;
  }) as typeof fetch;

  try {
    configureApiClient();
    await getEpisodePlayback('episode-1');
    assert.deepEqual(urls, [
      'http://localhost:3000/api/episodes/episode-1/playback',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    if (baseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = baseUrl;
  }
});

test('episode playback preserves absolute URLs', async () => {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  const body = { url: 'https://cdn.example.com/video.mp4', title: null, episodeNumber: 2, durationMs: 520000 };
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  globalThis.fetch = (async () => ({ ok: true, json: async () => body }) as Response) as typeof fetch;

  try {
    configureApiClient();
    assert.deepEqual(await getEpisodePlayback('episode-2'), body);
  } finally {
    globalThis.fetch = originalFetch;
    if (baseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = baseUrl;
  }
});

test('episode playback reports failed responses', async () => {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  globalThis.fetch = (async () => ({ ok: false, status: 404 }) as Response) as typeof fetch;

  try {
    configureApiClient();
    await assert.rejects(getEpisodePlayback('unknown'), (error) => error instanceof ApiError && error.status === 404);
  } finally {
    globalThis.fetch = originalFetch;
    if (baseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = baseUrl;
  }
});

