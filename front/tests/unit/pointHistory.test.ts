/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../../src/common/http/api';
import { getPointHistory, type PointHistoryItem } from '../../src/features/economy/pointHistory';
import { configureSessionClient } from '../../src/features/user/sessionClient';

test('point history requires auth and preserves every signed ledger field', async () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const items: PointHistoryItem[] = [
    { uuid: 'purchase', transactionType: 'PURCHASE', amount: 1000, balanceAfter: 1000, createdAt: '2026-11-03T18:04:00.000Z', episode: null },
    { uuid: 'ad', transactionType: 'AD_REWARD', amount: 10, balanceAfter: 1010, createdAt: '2026-11-03T18:05:00.000Z', episode: null },
    { uuid: 'unlock', transactionType: 'EPISODE_UNLOCK', amount: -30, balanceAfter: 980, createdAt: '2026-11-03T18:06:00.000Z', episode: { dramaTitle: '테스트 작품', episodeNumber: 2 } },
    { uuid: 'admin', transactionType: 'ADMIN_ADJUSTMENT', amount: -5, balanceAfter: 975, createdAt: '2026-11-03T18:07:00.000Z', episode: null },
    { uuid: 'refund', transactionType: 'REFUND', amount: 30, balanceAfter: 1005, createdAt: '2026-11-03T18:08:00.000Z', episode: null },
  ];

  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  globalThis.fetch = (async (input, init) => {
    requests.push({ url: String(input), init });
    return { ok: true, status: 200, json: async () => ({ items, page: requests.length, hasNext: requests.length === 1 }) } as Response;
  }) as typeof fetch;
  const client = configureSessionClient({
    baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    storage: { read: async () => null, write: async () => {}, remove: async () => {} },
    fetcher: ((input, init) => globalThis.fetch(input, init)) as typeof fetch,
    loginRequest: async () => ({
      uuid: 'user-1', displayName: null, accountType: 'MEMBER', availablePoints: 777,
      accessToken: 'access-token', refreshToken: 'refresh-token', expiresIn: 900,
    }),
  });

  try {
    await assert.rejects(getPointHistory(), (error) => error instanceof ApiError && error.status === 401);
    await client.login({ loginId: 'fixture', password: 'fixture' });

    const first = await getPointHistory();
    const second = await getPointHistory(2);
    assert.deepEqual(requests.map(({ url }) => url), [
      'http://localhost:3000/me/points/transactions?page=1',
      'http://localhost:3000/me/points/transactions?page=2',
    ]);
    assert.equal(requests.every(({ init }) => (init?.method ?? 'GET') === 'GET'), true);
    assert.equal((requests[0].init?.headers as Record<string, string>).Authorization, 'Bearer access-token');
    assert.deepEqual(first, { items, page: 1, hasNext: true });
    assert.deepEqual(second, { items, page: 2, hasNext: false });
    assert.deepEqual(first.items.map((item) => item.transactionType), [
      'PURCHASE', 'AD_REWARD', 'EPISODE_UNLOCK', 'ADMIN_ADJUSTMENT', 'REFUND',
    ]);
    assert.equal(first.items[2].amount, -30);
    assert.equal(first.items[2].balanceAfter, 980);
    assert.equal(first.items[2].createdAt, '2026-11-03T18:06:00.000Z');
    assert.deepEqual(first.items[2].episode, { dramaTitle: '테스트 작품', episodeNumber: 2 });
    assert.equal(first.items[0].episode, null);
    assert.equal(client.getUserSessionState().points, 777, 'history reads do not change the current balance');
  } finally {
    client.setUser(null);
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});

test('point history surfaces API errors using the shared ApiError parser', async () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  globalThis.fetch = (async () => ({
    ok: false, status: 503, json: async () => ({ statusCode: 503, errorCode: 'HTTP_SERVICE_UNAVAILABLE' }),
  }) as Response) as typeof fetch;
  const client = configureSessionClient({
    baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    storage: { read: async () => null, write: async () => {}, remove: async () => {} },
    fetcher: ((input, init) => globalThis.fetch(input, init)) as typeof fetch,
    loginRequest: async () => ({
      uuid: 'user-1', displayName: null, accountType: 'MEMBER', availablePoints: 0,
      accessToken: 'access-token', refreshToken: 'refresh-token', expiresIn: 900,
    }),
  });
  try {
    await client.login({ loginId: 'fixture', password: 'fixture' });
    await assert.rejects(getPointHistory(), (error) => error instanceof ApiError && error.status === 503
      && error.errorCode === 'HTTP_SERVICE_UNAVAILABLE');
  } finally {
    client.setUser(null);
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});
