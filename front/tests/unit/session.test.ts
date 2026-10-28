/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';
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

test('restore without a stored token does not make a request', async () => {
  const { storage, calls } = fakeStorage(null);
  let requests = 0;
  assert.equal(await restoreSession(storage, (async () => { requests++; return response(responseBody); }) as typeof fetch), null);
  assert.equal(requests, 0);
  assert.deepEqual(calls, ['read']);
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

test('storage deletion errors are surfaced after 401 and logout', async () => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  const storage: RefreshTokenStorage = {
    async read() { return 'refresh-old'; },
    async write() {},
    async remove() { throw new Error('cannot delete'); },
  };
  try {
    await assert.rejects(restoreSession(storage, (async () => response({}, 401)) as typeof fetch), /cannot delete/);
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
