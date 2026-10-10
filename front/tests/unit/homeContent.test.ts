/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getHomeCollection } from '../../src/services/homeContent';

test('home collection requests use the configured API base URL', async () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  const responseBody = {
    code: 'HOME_FEATURED',
    title: '오늘의 추천',
    description: '지금 만나보세요',
    dramas: [],
  };

  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000/';
  globalThis.fetch = (async (input) => {
    requestedUrl = String(input);
    return {
      ok: true,
      json: async () => responseBody,
    } as Response;
  }) as typeof fetch;

  try {
    const result = await getHomeCollection('/HOME_FEATURED');

    assert.equal(requestedUrl, 'http://localhost:3000/collections/HOME_FEATURED');
    assert.deepEqual(result, responseBody);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});
