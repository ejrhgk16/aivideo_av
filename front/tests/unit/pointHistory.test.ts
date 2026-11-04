import type { PointHistoryItem } from '../../src/features/economy/pointHistory';

let ApiError: typeof import('../../src/common/http/api').ApiError;
let pointHistoryApi: typeof import('../../src/features/economy/pointHistory');
let configureSessionClient: typeof import('../../src/features/user/sessionClient').configureSessionClient;

beforeEach(() => {
  jest.isolateModules(() => {
    ({ ApiError } = require('../../src/common/http/api'));
    pointHistoryApi = require('../../src/features/economy/pointHistory');
    ({ configureSessionClient } = require('../../src/features/user/sessionClient'));
  });
});

test('point history requires auth, preserves every signed ledger field, and does not change balance', async () => {
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
    const anonymousHistory = pointHistoryApi.getPointHistory();
    await expect(anonymousHistory).rejects.toBeInstanceOf(ApiError);
    await expect(anonymousHistory).rejects.toMatchObject({ status: 401 });
    await client.login({ loginId: 'fixture', password: 'fixture' });

    const first = await pointHistoryApi.getPointHistory();
    const second = await pointHistoryApi.getPointHistory(2);
    expect(requests.map(({ url }) => url)).toEqual([
      'http://localhost:3000/me/points/transactions?page=1',
      'http://localhost:3000/me/points/transactions?page=2',
    ]);
    expect(requests.every(({ init }) => (init?.method ?? 'GET') === 'GET')).toBe(true);
    expect((requests[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer access-token');
    expect(first).toEqual({ items, page: 1, hasNext: true });
    expect(second).toEqual({ items, page: 2, hasNext: false });
    expect(first.items.map((item) => item.transactionType)).toEqual([
      'PURCHASE', 'AD_REWARD', 'EPISODE_UNLOCK', 'ADMIN_ADJUSTMENT', 'REFUND',
    ]);
    expect(first.items[2].amount).toBe(-30);
    expect(first.items[2].balanceAfter).toBe(980);
    expect(first.items[2].createdAt).toBe('2026-11-03T18:06:00.000Z');
    expect(first.items[2].episode).toEqual({ dramaTitle: '테스트 작품', episodeNumber: 2 });
    expect(first.items[0].episode).toBeNull();
    expect(client.getUserSessionState().points).toBe(777);
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
    const historyRequest = pointHistoryApi.getPointHistory();
    await expect(historyRequest).rejects.toBeInstanceOf(ApiError);
    await expect(historyRequest).rejects.toMatchObject({ status: 503, errorCode: 'HTTP_SERVICE_UNAVAILABLE' });
  } finally {
    client.setUser(null);
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});
