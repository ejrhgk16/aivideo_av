/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../../src/common/http/api';
import { SessionChangedError } from '../../src/common/http/api';
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
  assert.equal(completed, false);
  pendingWrite.resolve(undefined);
  assert.equal(await operation, responseBody);
  assert.deepEqual(persisted, ['refresh-1']);
});

test('native login responses without a Refresh Token are rejected before storage', async () => {
  const missingRefresh = { ...responseBody, refreshToken: undefined } as LoginResponse;
  const { storage, calls } = fakeStorage(null);
  await assert.rejects(storeLoginResponse(missingRefresh, storage), /Refresh token is missing/);
  assert.deepEqual(calls, []);
});

test('restore without a stored token does not make a request', async () => {
  const { storage, calls } = fakeStorage(null);
  let requests = 0;
  assert.equal(await restoreSession(storage, (async () => { requests++; return response(responseBody); }) as typeof fetch), null);
  assert.equal(requests, 0);
  assert.deepEqual(calls, ['read']);
});

test('cookie restore calls refresh without reading or writing storage and treats 204 as anonymous', async () => {
  const { storage, calls } = fakeStorage(null);
  let requested: { url: string; init?: RequestInit } | undefined;
  const restored = await restoreSession(storage, (async (url, init) => {
    requested = { url: String(url), init };
    return response(null, 204);
  }) as typeof fetch, 'http://localhost:3000', 'cookie');
  assert.equal(restored, null);
  assert.equal(requested?.url, 'http://localhost:3000/auth/refresh');
  assert.equal(requested?.init?.method, 'POST');
  assert.equal(requested?.init?.credentials, 'include');
  assert.deepEqual(requested?.init?.headers, { 'Content-Type': 'application/json', 'X-Auth-Transport': 'cookie' });
  assert.equal(requested?.init?.body, '{}');
  assert.deepEqual(calls, []);
});

test('cookie restore parses web sessions without Refresh and preserves the cookie on server errors', async () => {
  const { storage, calls } = fakeStorage('unused-native-token');
  const webResponse = { ...responseBody } as Partial<LoginResponse>;
  delete webResponse.refreshToken;
  assert.deepEqual(await restoreSession(storage, (async () => response(webResponse)) as typeof fetch, 'http://localhost:3000', 'cookie'), webResponse);
  assert.deepEqual(calls, []);

  for (const [name, fetcher] of [
    ['401', async () => response({ errorCode: 'AUTH_INVALID_TOKEN' }, 401)],
    ['503', async () => response({}, 503)],
    ['network', async () => { throw new Error('offline'); }],
  ] as const) {
    await assert.rejects(restoreSession(storage, fetcher as typeof fetch, 'http://localhost:3000', 'cookie'));
    assert.deepEqual(calls, [], `${name} must not read or remove a JS Refresh token`);
  }
});

test('successful restore sends the old token and saves the rotated token', async () => {
  const { storage, calls, token } = fakeStorage();
  let request: { url: string; init?: RequestInit } | undefined;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000/';
  try {
    assert.deepEqual(await restoreSession(storage, (async (url, init) => {
      request = { url: String(url), init };
      return response(responseBody);
    }) as typeof fetch), responseBody);
    assert.equal(request?.url, 'http://localhost:3000/auth/refresh');
    assert.equal(request?.init?.method, 'POST');
    assert.equal(request?.init?.body, JSON.stringify({ refreshToken: 'refresh-old' }));
    assert.equal(token(), 'refresh-1');
    assert.deepEqual(calls, ['read', 'write:refresh-1']);
  } finally {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
  }
});

test('refresh 401 removes the stored token and does not retry it', async () => {
  const { storage, calls, token } = fakeStorage();
  let requests = 0;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  try {
    await assert.rejects(restoreSession(storage, (async () => { requests++; return response({}, 401); }) as typeof fetch), /401/);
    assert.equal(requests, 1);
    assert.equal(token(), null);
    assert.deepEqual(calls, ['read', 'remove']);
  } finally {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
  }
});

test('network and server errors preserve the stored token for the next explicit restore', async (t) => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  try {
    for (const [name, fetcher] of [
      ['network failure', async () => { throw new Error('offline'); }],
      ['server failure', async () => response({}, 503)],
    ] as const) {
      await t.test(name, async () => {
        const { storage, calls, token } = fakeStorage();
        await assert.rejects(restoreSession(storage, fetcher as typeof fetch));
        assert.equal(token(), 'refresh-old');
        assert.deepEqual(calls, ['read']);
      });
    }
  } finally {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
  }
});

test('storage write failure rejects login and restore rather than publishing success', async () => {
  const storage: RefreshTokenStorage = {
    async read() { return 'refresh-old'; },
    async write() { throw new Error('storage unavailable'); },
    async remove() {},
  };
  await assert.rejects(storeLoginResponse(responseBody, storage), /storage unavailable/);
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  try {
    await assert.rejects(restoreSession(storage, (async () => response(responseBody)) as typeof fetch), /storage unavailable/);
  } finally {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
  }
});

test('logout sends the stored token and removes it after success or server failure', async (t) => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  try {
    for (const [name, status] of [['success', 204], ['failure', 503]] as const) {
      await t.test(name, async () => {
        const { storage, calls, token } = fakeStorage();
        let requestBody: string | undefined;
        const fetcher = (async (_url, init) => {
          requestBody = String(init?.body);
          return response(null, status);
        }) as typeof fetch;
        if (status === 204) await logoutSession(storage, fetcher);
        else await assert.rejects(logoutSession(storage, fetcher), /503/);
        assert.equal(requestBody, JSON.stringify({ refreshToken: 'refresh-old' }));
        assert.equal(token(), null);
        assert.deepEqual(calls, ['read', 'remove']);
      });
    }
  } finally {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
  }
});

test('cookie logout always calls the server and never touches Refresh storage', async () => {
  const { storage, calls } = fakeStorage(null);
  let requested: { url: string; init?: RequestInit } | undefined;
  await logoutSession(storage, (async (url, init) => {
    requested = { url: String(url), init };
    return response(null, 204);
  }) as typeof fetch, 'http://localhost:3000', 'cookie');
  assert.equal(requested?.url, 'http://localhost:3000/auth/logout');
  assert.equal(requested?.init?.credentials, 'include');
  assert.equal(requested?.init?.body, '{}');
  assert.deepEqual(requested?.init?.headers, { 'Content-Type': 'application/json', 'X-Auth-Transport': 'cookie' });
  assert.deepEqual(calls, []);
});

test('storage deletion failure keeps refresh 401 classification and remains visible; logout still surfaces deletion errors', async () => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  const storage: RefreshTokenStorage = {
    async read() { return 'refresh-old'; },
    async write() {},
    async remove() { throw new Error('cannot delete'); },
  };
  try {
    await assert.rejects(restoreSession(storage, (async () => response({}, 401)) as typeof fetch), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 401);
      assert.equal(error.errorCode, null);
      assert.match(String((error as ApiError & { storageError?: unknown }).storageError), /cannot delete/);
      return true;
    });
    await assert.rejects(logoutSession(storage, (async () => response(null, 204)) as typeof fetch), /cannot delete/);
  } finally {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
  }
});

test('Strict Mode restoration shares one in-flight refresh, then queued logout wins over its late state update', async () => {
  const { storage, token } = fakeStorage();
  const queue = createSessionQueue();
  const pendingResponse = deferred<Response>();
  let refreshRequests = 0;
  let localUser: string | null = null;
  let localAccess: string | null = null;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
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
    assert.equal(firstMount, strictModeRemount);
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
    assert.equal(refreshRequests, 1);
    pendingResponse.resolve(response({ ...responseBody, refreshToken: 'refresh-2' }));
    await firstMount;
    await Promise.all([login, logout]);
    assert.equal(token(), null);
    assert.equal(localUser, null);
    assert.equal(localAccess, null);
    assert.equal(refreshRequests, 1);
  } finally {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
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
  assert.deepEqual(order, ['login-start']);
  pendingLogin.resolve(undefined);
  await Promise.all([login, logout]);
  assert.deepEqual(order, ['login-start', 'login-state', 'logout-state']);
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
  assert.deepEqual(results, [{ ok: true }, { ok: true }]);
  assert.equal(rotations, 1);
  assert.equal(token(), 'refresh-2');
  assert.equal(client.getSessionState().accessToken, 'access-2');
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
      assert.equal(transport, 'cookie');
      cookieSession = webSession as LoginResponse;
      return webSession as LoginResponse;
    },
  });
  await client1.initialize();
  assert.equal(client1.getUserSessionState().sessionExpired, false);
  assert.equal(client1.getUserSessionState().restoreError, null);
  await client1.login({ loginId: 'admin', password: 'admin' });
  assert.equal(client1.getUserSessionState().user?.uuid, 'user-uuid');

  const client2 = createSessionClient({ baseUrl: 'http://localhost:3000', storage, fetcher, refreshTransport: 'cookie' });
  await client2.initialize();
  assert.equal(client2.getUserSessionState().user?.uuid, 'user-uuid');
  assert.equal(client2.getUserSessionState().points, 12);
  assert.equal(client2.getSessionState().accessToken, 'access-1');
  await client2.logout();

  const client3 = createSessionClient({ baseUrl: 'http://localhost:3000', storage, fetcher, refreshTransport: 'cookie' });
  await client3.initialize();
  assert.equal(client3.getUserSessionState().user, null);
  assert.equal(client3.getUserSessionState().points, null);
  assert.equal(client3.getUserSessionState().sessionExpired, false);
  assert.equal(client3.getUserSessionState().restoreError, null);
  assert.ok(calls.filter(({ path }) => path.startsWith('/auth/')).every(({ init }) => init?.credentials === 'include'));
  assert.ok(calls.filter(({ path }) => path.startsWith('/auth/')).every(({ init }) => (init?.headers as Record<string, string>)['X-Auth-Transport'] === 'cookie'));
  assert.ok(calls.filter(({ path }) => path.startsWith('/auth/')).every(({ init }) => init?.body === '{}'));
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
  await assert.rejects(client.apiRequest('/private', { auth: 'required' }), (error) => error instanceof ApiError && error.status === 401);
  assert.equal(apiCalls, 2);
  assert.equal(logoutCalls, 1);
  assert.equal(client.getSessionState().accessToken, null);
  assert.equal(client.getUserSessionState().user, null);
  assert.equal(client.getUserSessionState().sessionExpired, true);
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
  assert.deepEqual(await Promise.all([
    client.apiRequest('/first', { auth: 'required' }),
    client.apiRequest('/second', { auth: 'required' }),
  ]), [{ path: '/first' }, { path: '/second' }]);
  assert.equal(refreshCalls, 1);
  assert.deepEqual([...counts.values()], [2, 2]);
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

  await assert.rejects(
    client.apiRequest('/me/episodes/episode-uuid/purchaseSingle', { auth: 'required', method: 'POST', json: {} }),
    SessionChangedError,
  );

  assert.equal(mutationCalls, 1);
  assert.equal(refreshCalls, 1);
  assert.equal(logoutCalls, 0);
  assert.deepEqual(calls, []);
  assert.equal(client.getSessionState().version, beforeVersion + 1);
  assert.equal(client.getSessionState().accessToken, null);
  assert.deepEqual(client.getUserSessionState(), {
    version: beforeVersion + 1,
    accessToken: null,
    user: null,
    points: null,
    isRestoring: false,
    restoreError: null,
    sessionExpired: true,
  });
  assert.equal(sharedCookieUser, 'account-b-uuid');
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
    client.apiRequest('/me/episodes/two/watch-progress', { auth: 'required', method: 'PUT', json: {} }),
  ]);

  assert.equal(refreshCalls, 1);
  assert.deepEqual(results.map((result) => result.status), ['rejected', 'rejected']);
  for (const result of results) {
    if (result.status === 'rejected') assert.ok(result.reason instanceof SessionChangedError);
  }
  assert.deepEqual([...mutationCalls.values()], [1, 1]);
  assert.equal(client.getUserSessionState().user, null);
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
  assert.equal(client.getUserSessionState().user?.uuid, 'user-uuid');
  await client.login({ loginId: 'account-a', password: 'password' });
  const beforeVersion = client.getSessionState().version;

  restoredUser = 'account-b-uuid';
  await client.initialize();

  assert.equal(client.getSessionState().version, beforeVersion + 1);
  assert.equal(client.getSessionState().accessToken, null);
  assert.equal(client.getUserSessionState().user, null);
  assert.equal(client.getUserSessionState().points, null);
  assert.equal(client.getUserSessionState().sessionExpired, true);
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

  assert.deepEqual(await client.apiRequest('/private', { auth: 'required' }), { ok: true });
  assert.equal(refreshCalls, 2);
  assert.equal(client.getSessionState().version, beforeVersion);
  assert.equal(client.getSessionState().accessToken, 'access-2');
  assert.equal(client.getUserSessionState().user?.uuid, 'user-uuid');
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
  await assert.rejects(request, SessionChangedError);
  await logout;
  assert.equal(logoutBody, '{}');
  assert.equal(client.getSessionState().accessToken, null);
  assert.equal(client.getUserSessionState().user, null);
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
  await assert.rejects(client.apiRequest('/private', { auth: 'required' }), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 401);
    assert.equal(error.errorCode, 'AUTH_INVALID_TOKEN');
    assert.match(String((error as ApiError & { storageError?: unknown }).storageError), /secure storage remove failed/);
    return true;
  });
  assert.equal(client.getSessionState().accessToken, null);
  assert.equal(client.getUserSessionState().user, null);
  assert.equal(client.getUserSessionState().sessionExpired, true);
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
  await assert.rejects(client.apiRequest('/first', { auth: 'required' }), /connection lost/);
  await assert.rejects(client.apiRequest('/second', { auth: 'required' }), /unavailable until a new login/);
  assert.equal(rotations, 1);
  assert.equal(token(), 'refresh-1');
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
  await assert.rejects(request, SessionChangedError);
  await logout;
  assert.equal(logoutBody, JSON.stringify({ refreshToken: 'refresh-2' }));
  assert.equal(token(), null);
  assert.equal(client.getSessionState().accessToken, null);
  assert.equal(client.getUserSessionState().user, null);
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
  await assert.rejects(client.apiRequest('/private', { auth: 'required' }), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 401);
    assert.equal(error.errorCode, 'AUTH_INVALID_TOKEN');
    assert.match(String((error as ApiError & { storageError?: unknown }).storageError), /secure store unavailable/);
    return true;
  });
  assert.equal(apiRequests, 2);
  assert.equal(client.getSessionState().accessToken, null);
  assert.equal(client.getUserSessionState().sessionExpired, true);
});
