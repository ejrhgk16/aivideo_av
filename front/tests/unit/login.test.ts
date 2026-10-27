/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { login } from '../../src/features/user/login';

const responseBody = {
  uuid: 'user-uuid',
  displayName: 'admin',
  accountType: 'OPERATOR' as const,
  availablePoints: 0,
};

test('login sends the supplied credentials to the configured endpoint and returns the response', async () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  const requested: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000///';
  globalThis.fetch = (async (input, init) => {
    requested.push({ input, init });
    return { ok: true, json: async () => responseBody } as Response;
  }) as typeof fetch;

  try {
    const input = { loginId: 'admin', password: ' pass ' };
    const result = await login(input);

    assert.equal(String(requested[0].input), 'http://localhost:3000/auth/login');
    assert.equal(requested[0].init?.method, 'POST');
    assert.deepEqual(requested[0].init?.headers, { 'Content-Type': 'application/json' });
    assert.equal(requested[0].init?.body, JSON.stringify(input));
    assert.deepEqual(result, responseBody);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});

test('login rejects a missing API base URL without making a request', async () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  delete process.env.EXPO_PUBLIC_API_BASE_URL;
  globalThis.fetch = (async () => {
    requestCount += 1;
    return { ok: true, json: async () => responseBody } as Response;
  }) as typeof fetch;

  try {
    await assert.rejects(login({ loginId: 'admin', password: 'admin' }), /EXPO_PUBLIC_API_BASE_URL/);
    assert.equal(requestCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});

test('login propagates HTTP errors', async (t) => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';

  try {
    for (const status of [400, 401, 404]) {
      await t.test(String(status), async () => {
        globalThis.fetch = (async () => ({ ok: false, status }) as Response) as typeof fetch;
        await assert.rejects(
          login({ loginId: 'admin', password: 'admin' }),
          new RegExp(`Failed to log in: ${status}`),
        );
      });
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});

test('login propagates network errors', async () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  const networkError = new Error('network unavailable');
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  globalThis.fetch = (async () => {
    throw networkError;
  }) as typeof fetch;

  try {
    await assert.rejects(login({ loginId: 'admin', password: 'admin' }), (error) => error === networkError);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});
