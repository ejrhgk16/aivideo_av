import { ApiError } from '../../src/common/http/api';
import { login } from '../../src/features/user/login';

const responseBody = {
  uuid: 'user-uuid',
  displayName: 'admin',
  accountType: 'OPERATOR' as const,
  availablePoints: 0,
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresIn: 900,
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

    expect(String(requested[0].input)).toBe('http://localhost:3000/auth/login');
    expect(requested[0].init?.method).toBe('POST');
    expect(requested[0].init?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(requested[0].init?.body).toBe(JSON.stringify(input));
    expect(result).toEqual(responseBody);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});

test('cookie login includes credentials and transport mode without requiring a Refresh field', async () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  const requested: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const cookieResponse = { ...responseBody } as Partial<typeof responseBody>;
  delete cookieResponse.refreshToken;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  globalThis.fetch = (async (input, init) => {
    requested.push({ input, init });
    return { ok: true, status: 200, json: async () => cookieResponse } as Response;
  }) as typeof fetch;

  try {
    const result = await login({ loginId: 'admin', password: 'admin' }, undefined, 'cookie');
    expect(String(requested[0].input)).toBe('http://localhost:3000/auth/login');
    expect(requested[0].init?.method).toBe('POST');
    expect(requested[0].init?.credentials).toBe('include');
    expect(requested[0].init?.headers).toEqual({ 'Content-Type': 'application/json', 'X-Auth-Transport': 'cookie' });
    expect(requested[0].init?.body).toBe(JSON.stringify({ loginId: 'admin', password: 'admin' }));
    expect(result.refreshToken).toBeUndefined();
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
    await expect(login({ loginId: 'admin', password: 'admin' })).rejects.toThrow('EXPO_PUBLIC_API_BASE_URL');
    expect(requestCount).toBe(0);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});

test.each([400, 401, 404])('login propagates HTTP %s errors', async (status) => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';

  try {
    globalThis.fetch = (async () => ({ ok: false, status, json: async () => ({ errorCode: status === 401 ? 'AUTH_LOGIN_FAILED' : 'AUTH_INVALID_LOGIN_INPUT' }) }) as Response) as typeof fetch;
    const request = login({ loginId: 'admin', password: 'admin' });
    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({ status, errorCode: status === 401 ? 'AUTH_LOGIN_FAILED' : 'AUTH_INVALID_LOGIN_INPUT' });
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
    await expect(login({ loginId: 'admin', password: 'admin' })).rejects.toBe(networkError);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});
