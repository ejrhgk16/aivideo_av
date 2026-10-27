/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EpisodePurchaseError, purchaseEpisode } from '../../src/features/economy/episodePurchase';

const responseBody = {
  episodeUuid: 'episode-uuid',
  entitlementUuid: null,
  chargedPoints: 0,
  availablePoints: 0,
};

test('purchaseEpisode sends an encoded bodyless POST and returns the purchase response', async () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  const requested: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000///';
  globalThis.fetch = (async (input, init) => {
    requested.push({ input, init });
    return { ok: true, json: async () => responseBody } as Response;
  }) as typeof fetch;

  try {
    const result = await purchaseEpisode('user /+?', 'episode /+?');

    assert.equal(
      String(requested[0].input),
      'http://localhost:3000/users/user%20%2F%2B%3F/episodes/episode%20%2F%2B%3F/purchaseSingle',
    );
    assert.equal(requested[0].init?.method, 'POST');
    assert.equal(requested[0].init?.body, undefined);
    assert.deepEqual(result, responseBody);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});

test('purchaseEpisode rejects a missing API base URL without making a request', async () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  delete process.env.EXPO_PUBLIC_API_BASE_URL;
  globalThis.fetch = (async () => {
    requestCount += 1;
    return { ok: true, json: async () => responseBody } as Response;
  }) as typeof fetch;

  try {
    await assert.rejects(purchaseEpisode('user-uuid', 'episode-uuid'), /EXPO_PUBLIC_API_BASE_URL/);
    assert.equal(requestCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});

test('purchaseEpisode preserves the insufficient-balance error code', async () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  globalThis.fetch = (async () => ({
    ok: false,
    status: 409,
    json: async () => ({ errorCode: 'POINT_INSUFFICIENT_BALANCE' }),
  }) as Response) as typeof fetch;

  try {
    await assert.rejects(
      purchaseEpisode('user-uuid', 'episode-uuid'),
      (error) => error instanceof EpisodePurchaseError
        && error.status === 409
        && error.errorCode === 'POINT_INSUFFICIENT_BALANCE',
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});

test('purchaseEpisode preserves HTTP status for other and non-JSON errors', async (t) => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';

  try {
    await t.test('404 response', async () => {
      globalThis.fetch = (async () => ({
        ok: false,
        status: 404,
        json: async () => ({ errorCode: 'POINT_EPISODE_NOT_FOUND' }),
      }) as unknown as Response) as typeof fetch;
      await assert.rejects(
        purchaseEpisode('user-uuid', 'episode-uuid'),
        (error) => error instanceof EpisodePurchaseError
          && error.status === 404
          && error.errorCode === 'POINT_EPISODE_NOT_FOUND',
      );
    });

    await t.test('non-JSON error response', async () => {
      globalThis.fetch = (async () => ({
        ok: false,
        status: 502,
        json: async () => { throw new SyntaxError('invalid JSON'); },
      }) as unknown as Response) as typeof fetch;
      await assert.rejects(
        purchaseEpisode('user-uuid', 'episode-uuid'),
        (error) => error instanceof EpisodePurchaseError
          && error.status === 502
          && error.errorCode === undefined,
      );
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});

test('purchaseEpisode propagates network errors', async () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  const networkError = new Error('network unavailable');
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  globalThis.fetch = (async () => {
    throw networkError;
  }) as typeof fetch;

  try {
    await assert.rejects(
      purchaseEpisode('user-uuid', 'episode-uuid'),
      (error) => error === networkError,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});
