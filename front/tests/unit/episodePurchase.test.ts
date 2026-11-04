let purchaseEpisode: typeof import('../../src/features/economy/episodePurchase').purchaseEpisode;
let ApiError: typeof import('../../src/common/http/api').ApiError;
let configureSessionClient: typeof import('../../src/features/user/sessionClient').configureSessionClient;

beforeEach(() => {
  jest.isolateModules(() => {
    ({ ApiError } = require('../../src/common/http/api'));
    ({ purchaseEpisode } = require('../../src/features/economy/episodePurchase'));
    ({ configureSessionClient } = require('../../src/features/user/sessionClient'));
  });
});

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

    expect(String(requested[0].input)).toBe(
      'http://localhost:3000/me/episodes/episode%20%2F%2B%3F/purchaseSingle',
    );
    expect(requested[0].init?.method).toBe('POST');
    expect(requested[0].init?.body).toBeUndefined();
    expect((requested[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer access-token');
    expect(result).toEqual(responseBody);
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
    const request = purchaseEpisode('episode-uuid');
    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({ status: 409, errorCode: 'POINT_INSUFFICIENT_BALANCE' });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});

test.each([
  ['404 response', 404, { errorCode: 'POINT_EPISODE_NOT_FOUND' }],
  ['non-JSON error response', 502, null],
] as const)('purchaseEpisode preserves HTTP status for %s', async (_name, status, body) => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';

  try {
    globalThis.fetch = (async () => ({
      ok: false,
      status,
      json: async () => { if (body === null) throw new SyntaxError('invalid JSON'); return body; },
    }) as unknown as Response) as typeof fetch;
    await configureApiClient();
    const request = purchaseEpisode('episode-uuid');
    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({
      status,
      errorCode: body?.errorCode ?? null,
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
    await expect(purchaseEpisode('episode-uuid')).rejects.toBe(networkError);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});
