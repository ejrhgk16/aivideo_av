/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../../src/common/http/api';
import { getPreviewPlayback } from '../../src/features/playback/previewPlayback';
import { configureSessionClient } from '../../src/features/user/sessionClient';

function configureApiClient() {
  return configureSessionClient({
    baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
    storage: { read: async () => null, write: async () => {}, remove: async () => {} },
    fetcher: ((input, init) => globalThis.fetch(input, init)) as typeof fetch,
    loginRequest: async () => ({ uuid: 'user-1', displayName: null, accountType: 'MEMBER', availablePoints: 80, accessToken: 'access-token', refreshToken: 'refresh-token', expiresIn: 900 }),
  });
}

test('preview playback encodes both ids and returns the signed URL unchanged', async () => {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  const body = { url: 'https://signed.example.com/video.mp4?token=a%2Fb', videoUuid: 'video-2', isSaved: true, durationMs: 30000 };
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000/api/';
  globalThis.fetch = (async (input) => {
    urls.push(String(input));
    return { ok: true, json: async () => body } as Response;
  }) as typeof fetch;

  try {
    configureApiClient();
    assert.deepEqual(await getPreviewPlayback('drama/1', 'video/2'), body);
    assert.deepEqual(urls, [
      'http://localhost:3000/api/dramas/drama%2F1/previews/video%2F2/playback',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    if (baseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = baseUrl;
  }
});

test('preview playback sends an optional Access token when signed in', async () => {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; headers: HeadersInit | undefined }> = [];
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  globalThis.fetch = (async (input, init) => {
    requests.push({ url: String(input), headers: init?.headers });
    return { ok: true, json: async () => ({ url: 'https://signed.example.com/video.mp4', videoUuid: 'video-2', isSaved: true, durationMs: 30000 }) } as Response;
  }) as typeof fetch;

  try {
    const client = configureApiClient();
    await client.login({ loginId: 'test', password: 'test' });
    await getPreviewPlayback('drama-1', 'video-2');
    assert.equal(requests[0].url, 'http://localhost:3000/api/dramas/drama-1/previews/video-2/playback');
    assert.equal((requests[0].headers as Record<string, string>).Authorization, 'Bearer access-token');
  } finally {
    globalThis.fetch = originalFetch;
    if (baseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = baseUrl;
  }
});

test('preview playback reports failed responses', async () => {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  globalThis.fetch = (async () => ({ ok: false, status: 404 }) as Response) as typeof fetch;

  try {
    configureApiClient();
    await assert.rejects(
      getPreviewPlayback('unknown-drama', 'unknown-video'),
      (error) => error instanceof ApiError && error.status === 404,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (baseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = baseUrl;
  }
});

