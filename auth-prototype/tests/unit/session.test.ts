import { ApiError, SessionChangedError } from '../../src/common/http/api';
import { createSessionClient } from '../../src/features/user/sessionClient';
import type { LoginResponse } from '../../src/features/user/login';
import {
  createRestoreOnce,
  createSessionQueue,
  logoutSession,
  restoreSession,
  storeLoginResponse,
  type RefreshTokenStorage,
} from '../../src/features/user/session';

const responseBody: LoginResponse = {
  uuid: 'user-uuid',
  displayName: 'admin',
  accountType: 'OPERATOR',
  availablePoints: 12,
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  expiresIn: 900,
};

function setApiBaseUrl(value: string) {
  const original = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = value;
  return () => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = original;
  };
}

function fakeStorage(initial: string | null = 'refresh-old') {
  let token = initial;
  const calls: string[] = [];
  const storage: RefreshTokenStorage = {
    async read() { calls.push('read'); return token; },
    async write(value) { calls.push(`write:${value}`); token = value; },
    async remove() { calls.push('remove'); token = null; },
  };
  return { storage, calls, token: () => token };
}

function response(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

test('login response is not returned until its Refresh Token has been stored', async () => {
  const pendingWrite = deferred<void>();
  const persisted: string[] = [];
  const operation = storeLoginResponse(responseBody, {
    async read() { return null; },
    async write(token) { await pendingWrite.promise; persisted.push(token); },
    async remove() {},
  });
  let completed = false;
  void operation.then(() => { completed = true; });
  await Promise.resolve();
  expect(completed).toBe(false);
  pendingWrite.resolve(undefined);
  await expect(operation).resolves.toBe(responseBody);
  expect(persisted).toEqual(['refresh-1']);
});

test('native login responses without a Refresh Token are rejected before storage', async () => {
  const missingRefresh = { ...responseBody, refreshToken: undefined } as LoginResponse;
  const { storage, calls } = fakeStorage(null);
  await expect(storeLoginResponse(missingRefresh, storage)).rejects.toThrow('Refresh token is missing');
  expect(calls).toEqual([]);
});

test('restore without a stored token does not make a request', async () => {
  const { storage, calls } = fakeStorage(null);
  let requests = 0;
  await expect(restoreSession(storage, (async () => { requests++; return response(responseBody); }) as typeof fetch)).resolves.toBeNull();
  expect(requests).toBe(0);
  expect(calls).toEqual(['read']);
});

test('cookie restore calls refresh without reading or writing storage and treats 204 as anonymous', async () => {
  const { storage, calls } = fakeStorage(null);
  let requested: { url: string; init?: RequestInit } | undefined;
  const restored = await restoreSession(storage, (async (url, init) => {
    requested = { url: String(url), init };
    return response(null, 204);
  }) as typeof fetch, 'http://localhost:3000', 'cookie');
  expect(restored).toBeNull();
  expect(requested?.url).toBe('http://localhost:3000/auth/refresh');
  expect(requested?.init?.method).toBe('POST');
  expect(requested?.init?.credentials).toBe('include');
  expect(requested?.init?.headers).toEqual({ 'Content-Type': 'application/json', 'X-Auth-Transport': 'cookie' });
  expect(requested?.init?.body).toBe('{}');
  expect(calls).toEqual([]);
});

test('cookie restore parses web sessions without Refresh and preserves the cookie on server errors', async () => {
  const { storage, calls } = fakeStorage('unused-native-token');
  const webResponse = { ...responseBody } as Partial<LoginResponse>;
  delete webResponse.refreshToken;
  await expect(restoreSession(storage, (async () => response(webResponse)) as typeof fetch, 'http://localhost:3000', 'cookie')).resolves.toEqual(webResponse);
  expect(calls).toEqual([]);

  for (const [name, fetcher] of [
    ['401', async () => response({ errorCode: 'AUTH_INVALID_TOKEN' }, 401)],
    ['503', async () => response({}, 503)],
    ['network', async () => { throw new Error('offline'); }],
  ] as const) {
    await expect(restoreSession(storage, fetcher as typeof fetch, 'http://localhost:3000', 'cookie')).rejects.toBeDefined();
    expect(calls).toEqual([]);
  }
});

test('successful restore sends the old token and saves the rotated token', async () => {
  const { storage, calls, token } = fakeStorage();
  let request: { url: string; init?: RequestInit } | undefined;
  const restoreBaseUrl = setApiBaseUrl('http://localhost:3000/');
  try {
    await expect(restoreSession(storage, (async (url, init) => {
      request = { url: String(url), init };
      return response(responseBody);
    }) as typeof fetch)).resolves.toEqual(responseBody);
    expect(request?.url).toBe('http://localhost:3000/auth/refresh');
    expect(request?.init?.method).toBe('POST');
    expect(request?.init?.body).toBe(JSON.stringify({ refreshToken: 'refresh-old' }));
    expect(token()).toBe('refresh-1');
    expect(calls).toEqual(['read', 'write:refresh-1']);
  } finally {
    restoreBaseUrl();
  }
});

test('refresh 401 removes the stored token and does not retry it', async () => {
  const { storage, calls, token } = fakeStorage();
  let requests = 0;
  const restoreBaseUrl = setApiBaseUrl('http://localhost:3000');
  try {
    await expect(restoreSession(storage, (async () => { requests++; return response({}, 401); }) as typeof fetch)).rejects.toThrow('401');
    expect(requests).toBe(1);
    expect(token()).toBeNull();
    expect(calls).toEqual(['read', 'remove']);
  } finally {
    restoreBaseUrl();
  }
});

test.each([
  ['forbidden', 403, 'HTTP_FORBIDDEN', 401],
  ['server failure', 503, 'HTTP_SERVICE_UNAVAILABLE', 500],
] as const)('refresh errors preserve status for %s', async (_name, status, errorCode, bodyStatus) => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  try {
    const { storage, calls, token } = fakeStorage();
    const request = restoreSession(storage, (async () => response({ errorCode, statusCode: bodyStatus }, status)) as typeof fetch);
    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({ status, errorCode });
    expect(token()).toBe('refresh-old');
    expect(calls).toEqual(['read']);
  } finally {
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});

test('refresh error parsing tolerates malformed JSON and preserves the HTTP status', async () => {
  const { storage, calls, token } = fakeStorage();
  const restoreBaseUrl = setApiBaseUrl('http://localhost:3000');
  try {
    const request = restoreSession(storage, (async () => ({
      ok: false, status: 503, json: async () => { throw new SyntaxError('invalid JSON'); },
    }) as unknown as Response) as typeof fetch);
    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({ status: 503, errorCode: null });
    expect(token()).toBe('refresh-old');
    expect(calls).toEqual(['read']);
  } finally {
    restoreBaseUrl();
  }
});

test.each([
  ['network failure', async () => { throw new Error('offline'); }],
  ['server failure', async () => response({}, 503)],
] as const)('%s preserves the stored token for the next explicit restore', async (_name, fetcher) => {
  const restoreBaseUrl = setApiBaseUrl('http://localhost:3000');
  try {
    const { storage, calls, token } = fakeStorage();
    await expect(restoreSession(storage, fetcher as typeof fetch)).rejects.toBeDefined();
    expect(token()).toBe('refresh-old');
    expect(calls).toEqual(['read']);
  } finally {
    restoreBaseUrl();
  }
});

test('storage write failure rejects login and restore rather than publishing success', async () => {
  const storage: RefreshTokenStorage = {
    async read() { return 'refresh-old'; },
    async write() { throw new Error('storage unavailable'); },
    async remove() {},
  };
  await expect(storeLoginResponse(responseBody, storage)).rejects.toThrow('storage unavailable');
  const restoreBaseUrl = setApiBaseUrl('http://localhost:3000');
  try {
    await expect(restoreSession(storage, (async () => response(responseBody)) as typeof fetch)).rejects.toThrow('storage unavailable');
  } finally {
    restoreBaseUrl();
  }
});

test.each([['success', 204], ['failure', 503]] as const)('logout %s sends the stored token and removes it', async (_name, status) => {
  const restoreBaseUrl = setApiBaseUrl('http://localhost:3000');
  try {
    const { storage, calls, token } = fakeStorage();
    let requestBody: string | undefined;
    const fetcher = (async (_url, init) => {
      requestBody = String(init?.body);
      return response(null, status);
    }) as typeof fetch;
    if (status === 204) await logoutSession(storage, fetcher);
    else await expect(logoutSession(storage, fetcher)).rejects.toThrow('503');
    expect(requestBody).toBe(JSON.stringify({ refreshToken: 'refresh-old' }));
    expect(token()).toBeNull();
    expect(calls).toEqual(['read', 'remove']);
  } finally {
    restoreBaseUrl();
  }
});

test('cookie logout always calls the server and never touches Refresh storage', async () => {
  const { storage, calls } = fakeStorage(null);
  let requested: { url: string; init?: RequestInit } | undefined;
  await logoutSession(storage, (async (url, init) => {
    requested = { url: String(url), init };
    return response(null, 204);
  }) as typeof fetch, 'http://localhost:3000', 'cookie');
  expect(requested?.url).toBe('http://localhost:3000/auth/logout');
  expect(requested?.init?.credentials).toBe('include');
  expect(requested?.init?.body).toBe('{}');
  expect(requested?.init?.headers).toEqual({ 'Content-Type': 'application/json', 'X-Auth-Transport': 'cookie' });
  expect(calls).toEqual([]);
});

test('storage deletion failure keeps refresh 401 classification and remains visible; logout still surfaces deletion errors', async () => {
  const restoreBaseUrl = setApiBaseUrl('http://localhost:3000');
  const storage: RefreshTokenStorage = {
    async read() { return 'refresh-old'; },
    async write() {},
    async remove() { throw new Error('cannot delete'); },
  };
  try {
    const restoreError = await restoreSession(storage, (async () => response({}, 401)) as typeof fetch).catch((error) => error);
    expect(restoreError).toBeInstanceOf(ApiError);
    expect(restoreError).toMatchObject({ status: 401, errorCode: null });
    expect(String((restoreError as ApiError & { storageError?: unknown }).storageError)).toMatch(/cannot delete/);
    await expect(logoutSession(storage, (async () => response(null, 204)) as typeof fetch)).rejects.toThrow('cannot delete');
  } finally {
    restoreBaseUrl();
  }
});

test('Strict Mode restoration shares one in-flight refresh, then queued logout wins over its late state update', async () => {
  const { storage, token } = fakeStorage();
  const queue = createSessionQueue();
  const pendingResponse = deferred<Response>();
  let refreshRequests = 0;
  let localUser: string | null = null;
  let localAccess: string | null = null;
  const restoreBaseUrl = setApiBaseUrl('http://localhost:3000');
  try {
    const restore = createRestoreOnce(() => queue.enqueue(async () => {
      const result = await restoreSession(storage, (async () => {
        refreshRequests++;
        return pendingResponse.promise;
      }) as typeof fetch);
      localUser = result?.uuid ?? null;
      localAccess = result?.accessToken ?? null;
      return result;
    }));
    const firstMount = restore();
    const strictModeRemount = restore();
    expect(firstMount).toBe(strictModeRemount);
    const login = queue.enqueue(async () => {
      const result = await storeLoginResponse(responseBody, storage);
      localUser = result.uuid;
      localAccess = result.accessToken;
    });
    const logout = queue.enqueue(async () => {
      try {
        await logoutSession(storage, (async () => response(null, 204)) as typeof fetch);
      } finally {
        localUser = null;
        localAccess = null;
      }
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(refreshRequests).toBe(1);
    pendingResponse.resolve(response({ ...responseBody, refreshToken: 'refresh-2' }));
    await firstMount;
    await Promise.all([login, logout]);
    expect(token()).toBeNull();
    expect(localUser).toBeNull();
    expect(localAccess).toBeNull();
    expect(refreshRequests).toBe(1);
  } finally {
    restoreBaseUrl();
  }
});

test('session queue serializes login and logout state application despite a late login response', async () => {
  const queue = createSessionQueue();
  const pendingLogin = deferred<void>();
  const order: string[] = [];
  const login = queue.enqueue(async () => {
    order.push('login-start');
    await pendingLogin.promise;
    order.push('login-state');
  });
  const logout = queue.enqueue(async () => { order.push('logout-state'); });
  await Promise.resolve();
  expect(order).toEqual(['login-start']);
  pendingLogin.resolve(undefined);
  await Promise.all([login, logout]);
  expect(order).toEqual(['login-start', 'login-state', 'logout-state']);
});

test('the session client shares concurrent refreshes and publishes the rotated token', async () => {
  let rotations = 0;
  const fetcher = (async (_url, init) => {
    if (init?.method === 'POST') {
      rotations += 1;
      return response({ ...responseBody, accessToken: 'access-2', refreshToken: 'refresh-2' });
    }
    if ((init?.headers as Record<string, string>).Authorization === 'Bearer access-1') return response({ errorCode: 'AUTH_INVALID_TOKEN' }, 401);
    return response({ ok: true });
  }) as typeof fetch;
  const { storage, token } = fakeStorage(null);
  const client = createSessionClient({ baseUrl: 'http://localhost:3000', storage, fetcher, loginRequest: async () => responseBody });
  await client.initialize();
  await client.login({ loginId: 'admin', password: 'admin' });
  const results = await Promise.all([
    client.apiRequest('/one', { auth: 'required' }),
    client.apiRequest('/two', { auth: 'required' }),
  ]);
  expect(results).toEqual([{ ok: true }, { ok: true }]);
  expect(rotations).toBe(1);
  expect(token()).toBe('refresh-2');
  expect(client.getSessionState().accessToken).toBe('access-2');
});

test('cookie clients restore across fresh instances and logout leaves later instances anonymous', async () => {
  let cookieSession: LoginResponse | null = null;
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const fetcher = (async (url, init) => {
    const path = new URL(String(url)).pathname;
    calls.push({ path, init });
    if (path === '/auth/refresh') return cookieSession === null ? response(null, 204) : response(cookieSession);
    if (path === '/auth/logout') { cookieSession = null; return response(null, 204); }
    return response({}, 200);
  }) as typeof fetch;
  const webSession = { ...responseBody } as Partial<LoginResponse>;
  delete webSession.refreshToken;
  const storage: RefreshTokenStorage = {
    async read() { throw new Error('web path must not read Refresh storage'); },
    async write() { throw new Error('web path must not write Refresh storage'); },
    async remove() { throw new Error('web path must not remove Refresh storage'); },
  };
  const client1 = createSessionClient({
    baseUrl: 'http://localhost:3000', storage, fetcher, refreshTransport: 'cookie',
    loginRequest: async (_input, _fetcher, transport) => {
      expect(transport).toBe('cookie');
      cookieSession = webSession as LoginResponse;
      return webSession as LoginResponse;
    },
  });
  await client1.initialize();
  expect(client1.getUserSessionState().sessionExpired).toBe(false);
  expect(client1.getUserSessionState().restoreError).toBeNull();
  await client1.login({ loginId: 'admin', password: 'admin' });
  expect(client1.getUserSessionState().user?.uuid).toBe('user-uuid');

  const client2 = createSessionClient({ baseUrl: 'http://localhost:3000', storage, fetcher, refreshTransport: 'cookie' });
  await client2.initialize();
  expect(client2.getUserSessionState().user?.uuid).toBe('user-uuid');
  expect(client2.getUserSessionState().points).toBe(12);
  expect(client2.getSessionState().accessToken).toBe('access-1');
  await client2.logout();

  const client3 = createSessionClient({ baseUrl: 'http://localhost:3000', storage, fetcher, refreshTransport: 'cookie' });
  await client3.initialize();
  expect(client3.getUserSessionState().user).toBeNull();
  expect(client3.getUserSessionState().points).toBeNull();
  expect(client3.getUserSessionState().sessionExpired).toBe(false);
  expect(client3.getUserSessionState().restoreError).toBeNull();
  expect(calls.filter(({ path }) => path.startsWith('/auth/')).every(({ init }) => init?.credentials === 'include')).toBe(true);
  expect(calls.filter(({ path }) => path.startsWith('/auth/')).every(({ init }) => (init?.headers as Record<string, string>)['X-Auth-Transport'] === 'cookie')).toBe(true);
  expect(calls.filter(({ path }) => path.startsWith('/auth/')).every(({ init }) => init?.body === '{}')).toBe(true);
});

test('cookie session expiry calls server logout after clearing memory', async () => {
  let logoutCalls = 0;
  let apiCalls = 0;
  const fetcher = (async (url) => {
    const path = new URL(String(url)).pathname;
    if (path === '/auth/refresh') return response({ ...responseBody, refreshToken: undefined });
    if (path === '/auth/logout') { logoutCalls++; return response(null, 204); }
    apiCalls++;
    return response({ errorCode: 'AUTH_INVALID_TOKEN' }, 401);
  }) as typeof fetch;
  const storage: RefreshTokenStorage = {
    async read() { throw new Error('web path must not read storage'); },
    async write() { throw new Error('web path must not write storage'); },
    async remove() { throw new Error('web path must not remove storage'); },
  };
  const client = createSessionClient({
    baseUrl: 'http://localhost:3000', storage, fetcher, refreshTransport: 'cookie',
    loginRequest: async () => ({ ...responseBody, refreshToken: undefined }),
  });
  await client.initialize();
  await client.login({ loginId: 'admin', password: 'admin' });
  await expect(client.apiRequest('/private', { auth: 'required' })).rejects.toMatchObject({ status: 401 });
  expect(apiCalls).toBe(2);
  expect(logoutCalls).toBe(1);
  expect(client.getSessionState().accessToken).toBeNull();
  expect(client.getUserSessionState().user).toBeNull();
  expect(client.getUserSessionState().sessionExpired).toBe(true);
});

test('concurrent cookie-mode 401s share one refresh and retry each product request once', async () => {
  let refreshCalls = 0;
  let loggedIn = false;
  const counts = new Map<string, number>();
  const fetcher = (async (url, init) => {
    const path = new URL(String(url)).pathname;
    if (path === '/auth/refresh') {
      if (!loggedIn) return response(null, 204);
      refreshCalls++;
      return response({ ...responseBody, accessToken: 'access-2', refreshToken: undefined });
    }
    const count = (counts.get(path) ?? 0) + 1;
    counts.set(path, count);
    if ((init?.headers as Record<string, string>).Authorization === 'Bearer access-1') {
      return response({ errorCode: 'AUTH_INVALID_TOKEN' }, 401);
    }
    return response({ path });
  }) as typeof fetch;
  const storage: RefreshTokenStorage = {
    async read() { throw new Error('web path must not read storage'); },
    async write() { throw new Error('web path must not write storage'); },
    async remove() { throw new Error('web path must not remove storage'); },
  };
  const client = createSessionClient({
    baseUrl: 'http://localhost:3000', storage, fetcher, refreshTransport: 'cookie',
    loginRequest: async () => { loggedIn = true; return { ...responseBody, refreshToken: undefined }; },
  });
  await client.initialize();
  await client.login({ loginId: 'admin', password: 'admin' });
  await expect(Promise.all([
    client.apiRequest('/first', { auth: 'required' }),
    client.apiRequest('/second', { auth: 'required' }),
  ])).resolves.toEqual([{ path: '/first' }, { path: '/second' }]);
  expect(refreshCalls).toBe(1);
  expect([...counts.values()]).toEqual([2, 2]);
});

test('cookie refresh rejects an account change and never retries the original mutation as the other user', async () => {
  let refreshCalls = 0;
  let logoutCalls = 0;
  let mutationCalls = 0;
  let sharedCookieUser = 'user-uuid';
  const calls: string[] = [];
  const webStorage: RefreshTokenStorage = {
    async read() { calls.push('read'); return null; },
    async write() { calls.push('write'); },
    async remove() { calls.push('remove'); },
  };
  const fetcher = (async (url, init) => {
    const path = new URL(String(url)).pathname;
    if (path === '/auth/refresh') {
      refreshCalls++;
      return response({ ...responseBody, uuid: sharedCookieUser, accessToken: 'access-b', availablePoints: 99, refreshToken: undefined });
    }
    if (path === '/auth/logout') { logoutCalls++; return response(null, 204); }
    mutationCalls++;
    if ((init?.headers as Record<string, string>).Authorization === 'Bearer access-1') {
      return response({ errorCode: 'AUTH_INVALID_TOKEN' }, 401);
    }
    return response({ purchased: true });
  }) as typeof fetch;
  const client = createSessionClient({
    baseUrl: 'http://localhost:3000', storage: webStorage, fetcher, refreshTransport: 'cookie',
    loginRequest: async () => ({ ...responseBody, refreshToken: undefined }),
  });
  await client.initialize();
  await client.login({ loginId: 'account-a', password: 'password' });
  const beforeVersion = client.getSessionState().version;
  refreshCalls = 0;
  sharedCookieUser = 'account-b-uuid';

  await expect(
    client.apiRequest('/me/episodes/episode-uuid/purchaseSingle', { auth: 'required', method: 'POST', json: {} }),
  ).rejects.toBeInstanceOf(SessionChangedError);

  expect(mutationCalls).toBe(1);
  expect(refreshCalls).toBe(1);
  expect(logoutCalls).toBe(0);
  expect(calls).toEqual([]);
  expect(client.getSessionState().version).toBe(beforeVersion + 1);
  expect(client.getSessionState().accessToken).toBeNull();
  expect(client.getUserSessionState()).toEqual({
    version: beforeVersion + 1,
    accessToken: null,
    user: null,
    points: null,
    isRestoring: false,
    restoreError: null,
    sessionExpired: true,
  });
  expect(sharedCookieUser).toBe('account-b-uuid');
});

test('cookie-mode concurrent requests share an account-switch refresh and both stop', async () => {
  let refreshCalls = 0;
  const mutationCalls = new Map<string, number>();
  const fetcher = (async (url, init) => {
    const path = new URL(String(url)).pathname;
    if (path === '/auth/refresh') {
      refreshCalls++;
      return response({ ...responseBody, uuid: 'account-b-uuid', accessToken: 'access-b', refreshToken: undefined });
    }
    const count = (mutationCalls.get(path) ?? 0) + 1;
    mutationCalls.set(path, count);
    if ((init?.headers as Record<string, string>).Authorization === 'Bearer access-1') {
      return response({ errorCode: 'AUTH_INVALID_TOKEN' }, 401);
    }
    return response({ ok: true });
  }) as typeof fetch;
  const storage: RefreshTokenStorage = {
    async read() { throw new Error('web path must not read storage'); },
    async write() { throw new Error('web path must not write storage'); },
    async remove() { throw new Error('web path must not remove storage'); },
  };
  const client = createSessionClient({
    baseUrl: 'http://localhost:3000', storage, fetcher, refreshTransport: 'cookie',
    loginRequest: async () => ({ ...responseBody, refreshToken: undefined }),
  });
  await client.initialize();
  await client.login({ loginId: 'account-a', password: 'password' });
  refreshCalls = 0;

  const results = await Promise.allSettled([
    client.apiRequest('/me/episodes/one/purchaseSingle', { auth: 'required', method: 'POST', json: {} }),
    client.apiRequest('/me/videos/video-two/watch-progress', { auth: 'required', method: 'PUT', json: {} }),
  ]);

  expect(refreshCalls).toBe(1);
  expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected']);
  for (const result of results) {
    if (result.status === 'rejected') expect(result.reason).toBeInstanceOf(SessionChangedError);
  }
  expect([...mutationCalls.values()]).toEqual([1, 1]);
  expect(client.getUserSessionState().user).toBeNull();
});

test('explicit cookie session restore clears the previous account when the shared cookie belongs to another user', async () => {
  let restoredUser = 'user-uuid';
  let refreshCalls = 0;
  const fetcher = (async (url) => {
    if (new URL(String(url)).pathname === '/auth/refresh') {
      refreshCalls++;
      return response({ ...responseBody, uuid: restoredUser, accessToken: `access-${refreshCalls}`, refreshToken: undefined });
    }
    return response({});
  }) as typeof fetch;
  const storage: RefreshTokenStorage = {
    async read() { throw new Error('web path must not read storage'); },
    async write() { throw new Error('web path must not write storage'); },
    async remove() { throw new Error('web path must not remove storage'); },
  };
  const client = createSessionClient({
    baseUrl: 'http://localhost:3000', storage, fetcher, refreshTransport: 'cookie',
    loginRequest: async () => ({ ...responseBody, refreshToken: undefined }),
  });
  await client.initialize();
  expect(client.getUserSessionState().user?.uuid).toBe('user-uuid');
  await client.login({ loginId: 'account-a', password: 'password' });
  const beforeVersion = client.getSessionState().version;

  restoredUser = 'account-b-uuid';
  await client.initialize();

  expect(client.getSessionState().version).toBe(beforeVersion + 1);
  expect(client.getSessionState().accessToken).toBeNull();
  expect(client.getUserSessionState().user).toBeNull();
  expect(client.getUserSessionState().points).toBeNull();
  expect(client.getUserSessionState().sessionExpired).toBe(true);
});

test('anonymous cookie initialization accepts the available account and same-user refresh keeps its session', async () => {
  let refreshCalls = 0;
  const fetcher = (async (url, init) => {
    const path = new URL(String(url)).pathname;
    if (path === '/auth/refresh') {
      refreshCalls++;
      return response({ ...responseBody, accessToken: 'access-2', refreshToken: undefined });
    }
    if ((init?.headers as Record<string, string>).Authorization === 'Bearer access-1') {
      return response({ errorCode: 'AUTH_INVALID_TOKEN' }, 401);
    }
    return response({ ok: true });
  }) as typeof fetch;
  const storage: RefreshTokenStorage = {
    async read() { throw new Error('web path must not read storage'); },
    async write() { throw new Error('web path must not write storage'); },
    async remove() { throw new Error('web path must not remove storage'); },
  };
  const client = createSessionClient({
    baseUrl: 'http://localhost:3000', storage, fetcher, refreshTransport: 'cookie',
    loginRequest: async () => ({ ...responseBody, refreshToken: undefined }),
  });
  await client.initialize();
  await client.login({ loginId: 'account-a', password: 'password' });
  const beforeVersion = client.getSessionState().version;

  await expect(client.apiRequest('/private', { auth: 'required' })).resolves.toEqual({ ok: true });
  expect(refreshCalls).toBe(2);
  expect(client.getSessionState().version).toBe(beforeVersion);
  expect(client.getSessionState().accessToken).toBe('access-2');
  expect(client.getUserSessionState().user?.uuid).toBe('user-uuid');
});

test('cookie logout queued behind refresh wins over the late refreshed session', async () => {
  let finishRefresh!: (value: Response) => void;
  let refreshStarted!: () => void;
  const started = new Promise<void>((resolve) => { refreshStarted = resolve; });
  let loggedIn = false;
  let logoutBody: string | undefined;
  const fetcher = (async (url, init) => {
    const path = new URL(String(url)).pathname;
    if (path === '/auth/refresh') {
      if (!loggedIn) return response(null, 204);
      refreshStarted();
      return new Promise<Response>((resolve) => { finishRefresh = resolve; });
    }
    if (path === '/auth/logout') { logoutBody = String(init?.body); return response(null, 204); }
    return response({ errorCode: 'AUTH_INVALID_TOKEN' }, 401);
  }) as typeof fetch;
  const storage: RefreshTokenStorage = {
    async read() { throw new Error('web path must not read storage'); },
    async write() { throw new Error('web path must not write storage'); },
    async remove() { throw new Error('web path must not remove storage'); },
  };
  const client = createSessionClient({
    baseUrl: 'http://localhost:3000', storage, fetcher, refreshTransport: 'cookie',
    loginRequest: async () => { loggedIn = true; return { ...responseBody, refreshToken: undefined }; },
  });
  await client.initialize();
  await client.login({ loginId: 'admin', password: 'admin' });
  const request = client.apiRequest('/private', { auth: 'required' });
  await started;
  const logout = client.logout();
  finishRefresh(response({ ...responseBody, accessToken: 'access-2', refreshToken: undefined }));
  await expect(request).rejects.toBeInstanceOf(SessionChangedError);
  await logout;
  expect(logoutBody).toBe('{}');
  expect(client.getSessionState().accessToken).toBeNull();
  expect(client.getUserSessionState().user).toBeNull();
});

test('Refresh 401 still clears memory and preserves its error when secure storage removal fails', async () => {
  const fetcher = (async (_url, init) => init?.method === 'POST'
    ? response({ errorCode: 'AUTH_INVALID_TOKEN' }, 401)
    : response({ errorCode: 'AUTH_INVALID_TOKEN' }, 401)) as typeof fetch;
  const storage: RefreshTokenStorage = {
    async read() { return 'refresh-old'; },
    async write() {},
    async remove() { throw new Error('secure storage remove failed'); },
  };
  const client = createSessionClient({ baseUrl: 'http://localhost:3000', storage, fetcher, loginRequest: async () => responseBody });
  await client.initialize();
  await client.login({ loginId: 'admin', password: 'admin' });
  const error = await client.apiRequest('/private', { auth: 'required' }).catch((reason) => reason);
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ status: 401, errorCode: 'AUTH_INVALID_TOKEN' });
  expect(String((error as ApiError & { storageError?: unknown }).storageError)).toMatch(/secure storage remove failed/);
  expect(client.getSessionState().accessToken).toBeNull();
  expect(client.getUserSessionState().user).toBeNull();
  expect(client.getUserSessionState().sessionExpired).toBe(true);
});

test('ambiguous refresh failure blocks automatic reuse and preserves the stored token', async () => {
  let rotations = 0;
  const fetcher = (async (_url, init) => {
    if (init?.method === 'POST') {
      rotations += 1;
      throw new Error('connection lost after request');
    }
    return response({ errorCode: 'AUTH_INVALID_TOKEN' }, 401);
  }) as typeof fetch;
  const { storage, token } = fakeStorage(null);
  const client = createSessionClient({ baseUrl: 'http://localhost:3000', storage, fetcher, loginRequest: async () => responseBody });
  await client.initialize();
  await client.login({ loginId: 'admin', password: 'admin' });
  await expect(client.apiRequest('/first', { auth: 'required' })).rejects.toThrow('connection lost');
  await expect(client.apiRequest('/second', { auth: 'required' })).rejects.toThrow('unavailable until a new login');
  expect(rotations).toBe(1);
  expect(token()).toBe('refresh-1');
});

test('logout during token rotation revokes the rotated token without restoring user state', async () => {
  let finishRefresh!: (value: Response) => void;
  let refreshStarted!: () => void;
  const started = new Promise<void>((resolve) => { refreshStarted = resolve; });
  let logoutBody: string | undefined;
  const fetcher = (async (url, init) => {
    if (String(url).endsWith('/auth/refresh')) {
      refreshStarted();
      return new Promise<Response>((resolve) => { finishRefresh = resolve; });
    }
    if (String(url).endsWith('/auth/logout')) {
      logoutBody = String(init?.body);
      return response(null, 204);
    }
    return response({ errorCode: 'AUTH_INVALID_TOKEN' }, 401);
  }) as typeof fetch;
  const { storage, token } = fakeStorage(null);
  const client = createSessionClient({ baseUrl: 'http://localhost:3000', storage, fetcher, loginRequest: async () => responseBody });
  await client.initialize();
  await client.login({ loginId: 'admin', password: 'admin' });
  const request = client.apiRequest('/private', { auth: 'required' });
  await started;
  const logout = client.logout();
  finishRefresh(response({ ...responseBody, accessToken: 'access-2', refreshToken: 'refresh-2' }));
  await expect(request).rejects.toBeInstanceOf(SessionChangedError);
  await logout;
  expect(logoutBody).toBe(JSON.stringify({ refreshToken: 'refresh-2' }));
  expect(token()).toBeNull();
  expect(client.getSessionState().accessToken).toBeNull();
  expect(client.getUserSessionState().user).toBeNull();
});

test('a failed retried request preserves its 401 when secure storage cleanup also fails', async () => {
  let apiRequests = 0;
  const fetcher = (async (url) => {
    if (String(url).endsWith('/auth/refresh')) {
      return response({ ...responseBody, accessToken: 'access-2', refreshToken: 'refresh-2' });
    }
    apiRequests += 1;
    return response({ errorCode: 'AUTH_INVALID_TOKEN' }, 401);
  }) as typeof fetch;
  const storage: RefreshTokenStorage = {
    async read() { return 'refresh-old'; },
    async write() {},
    async remove() { throw new Error('secure store unavailable'); },
  };
  const client = createSessionClient({ baseUrl: 'http://localhost:3000', storage, fetcher, loginRequest: async () => responseBody });
  await client.initialize();
  await client.login({ loginId: 'admin', password: 'admin' });
  const error = await client.apiRequest('/private', { auth: 'required' }).catch((reason) => reason);
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ status: 401, errorCode: 'AUTH_INVALID_TOKEN' });
  expect(String((error as ApiError & { storageError?: unknown }).storageError)).toMatch(/secure store unavailable/);
  expect(apiRequests).toBe(2);
  expect(client.getSessionState().accessToken).toBeNull();
  expect(client.getUserSessionState().sessionExpired).toBe(true);
});
