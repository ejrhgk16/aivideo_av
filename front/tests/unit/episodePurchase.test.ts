/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../../src/common/http/api';
import { purchaseEpisode } from '../../src/features/economy/episodePurchase';
import { configureSessionClient } from '../../src/features/user/sessionClient';

const responseBody = {
  episodeUuid: 'episode-uuid',
  entitlementUuid: null,
  chargedPoints: 0,
  availablePoints: 0,
};

async function configureApiClient() {
  const client = configureSessionClient({
    baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
    storage: { read: async () => null, write: async () => {}, remove: async () => {} },
    fetcher: ((input, init) => globalThis.fetch(input, init)) as typeof fetch,
    loginRequest: async () => ({ uuid: 'user-1', displayName: null, accountType: 'MEMBER', availablePoints: 100, accessToken: 'access-token', refreshToken: 'refresh-token', expiresIn: 900 }),
  });
  await client.login({ loginId: 'test', password: 'test' });
}

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
    await configureApiClient();
    const result = await purchaseEpisode('episode /+?');

    assert.equal(
      String(requested[0].input),
      'http://localhost:3000/me/episodes/episode%20%2F%2B%3F/purchaseSingle',
    );
    assert.equal(requested[0].init?.method, 'POST');
    assert.equal(requested[0].init?.body, undefined);
    assert.equal((requested[0].init?.headers as Record<string, string>).Authorization, 'Bearer access-token');
    assert.deepEqual(result, responseBody);
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
    await configureApiClient();
    await assert.rejects(
      purchaseEpisode('episode-uuid'),
      (error) => error instanceof ApiError
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
      await configureApiClient();
      await assert.rejects(
        purchaseEpisode('episode-uuid'),
        (error) => error instanceof ApiError
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
      await configureApiClient();
      await assert.rejects(
        purchaseEpisode('episode-uuid'),
        (error) => error instanceof ApiError
          && error.status === 502
          && error.errorCode === null,
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
    await configureApiClient();
    await assert.rejects(
      purchaseEpisode('episode-uuid'),
      (error) => error === networkError,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});
