/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError, createApiClient, SessionChangedError, type SessionState } from '../../src/common/http/api';

function response(status: number, body?: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function fakeSession(initial: SessionState = { version: 1, accessToken: 'access-old' }) {
  let current = { ...initial };
  let refreshes = 0;
  let expirations = 0;
  let sharedRefresh: Promise<void> | null = null;
  const session = {
    async ready() {},
    getSessionState: () => ({ ...current }),
    refreshOnce: async (version: number) => {
      if (sharedRefresh !== null) return sharedRefresh;
      refreshes += 1;
      sharedRefresh = Promise.resolve().then(() => {
        if (current.version === version) current = { ...current, accessToken: 'access-new' };
      });
      return sharedRefresh;
    },
    async expire(version: number) {
      expirations += 1;
      if (current.version === version) current = { version: version + 1, accessToken: null };
    },
  };
  return { session, refreshCount: () => refreshes, expirationCount: () => expirations, set: (next: SessionState) => { current = next; } };
}

test('public requests never attach credentials; optional and required requests do', async () => {
  const { session } = fakeSession();
  const requests: RequestInit[] = [];
  const client = createApiClient({ baseUrl: 'http://localhost:3000/', session, fetcher: (async (_url, init) => {
    requests.push(init ?? {});
    return response(200, { ok: true });
  }) as typeof fetch });

  await client.request('/public', { auth: 'public' });
  await client.request('/optional', { auth: 'optional' });
  await client.request('/required', { auth: 'required' });

  assert.equal(requests[0].headers && 'Authorization' in requests[0].headers, false);
  assert.deepEqual(requests[1].headers, { Authorization: 'Bearer access-old' });
  assert.deepEqual(requests[2].headers, { Authorization: 'Bearer access-old' });
});

test('required requests without a token fail locally without fetching', async () => {
  const { session } = fakeSession({ version: 1, accessToken: null });
  let requests = 0;
  const client = createApiClient({ baseUrl: 'http://localhost:3000', session, fetcher: (async () => { requests++; return response(200); }) as typeof fetch });
  await assert.rejects(client.request('/private', { auth: 'required' }), (error) => error instanceof ApiError && error.status === 401);
  assert.equal(requests, 0);
});

test('JSON requests set content type, handle 204, and preserve HTTP errors without JSON bodies', async () => {
  const { session } = fakeSession();
  const requests: RequestInit[] = [];
  let emptyJsonCalls = 0;
  const client = createApiClient({ baseUrl: 'http://localhost:3000', session, fetcher: (async (_url, init) => {
    requests.push(init ?? {});
    return requests.length === 1
      ? { ok: true, status: 204, json: async () => { emptyJsonCalls += 1; return null; } } as unknown as Response
      : { ok: false, status: 503, json: async () => { throw new Error('not json'); } } as unknown as Response;
  }) as typeof fetch });
  assert.equal(await client.request('/write', { auth: 'public', method: 'POST', json: { value: 1 } }), undefined);
  assert.deepEqual(requests[0].headers, { 'Content-Type': 'application/json' });
  assert.equal(requests[0].body, JSON.stringify({ value: 1 }));
  assert.equal(emptyJsonCalls, 0);
  await assert.rejects(client.request('/fail', { auth: 'public' }), (error) => error instanceof ApiError && error.status === 503 && error.errorCode === null);
});

test('successful API responses are returned as the original JSON, including business data fields', async () => {
  const { session } = fakeSession();
  const original = { data: { label: 'a business field' }, value: null, items: [1, { name: 'one' }] };
  const client = createApiClient({ baseUrl: 'http://localhost:3000', session, fetcher: (async () => response(200, original)) as typeof fetch });
  const result = await client.request<typeof original>('/raw-response', { auth: 'public' });
  assert.deepEqual(result, original);
  assert.strictEqual(result, original);
});

test('shared API error parsing keeps the HTTP status and tolerates malformed or non-JSON bodies', async (t) => {
  for (const [name, status, body] of [
    ['standard error with mismatched body status', 409, { errorCode: 'HTTP_CONFLICT', statusCode: 503 }],
    ['unknown error code', 404, { errorCode: 'HTTP_FUTURE_STATUS' }],
    ['body without error code', 403, { statusCode: 401 }],
  ] as const) {
    await t.test(name, async () => {
      const { session } = fakeSession();
      const client = createApiClient({ baseUrl: 'http://localhost:3000', session, fetcher: (async () => response(status, body)) as typeof fetch });
      await assert.rejects(client.request('/failure', { auth: 'public' }), (error) =>
        error instanceof ApiError && error.status === status && error.errorCode === ('errorCode' in body ? body.errorCode : null));
    });
  }

  for (const [name, status] of [['malformed JSON', 400], ['non-JSON response', 502]] as const) {
    await t.test(name, async () => {
      const { session } = fakeSession();
      const client = createApiClient({ baseUrl: 'http://localhost:3000', session, fetcher: (async () => ({
        ok: false, status, json: async () => { throw new SyntaxError('invalid JSON'); },
      }) as unknown as Response) as typeof fetch });
      await assert.rejects(client.request('/failure', { auth: 'public' }), (error) =>
        error instanceof ApiError && error.status === status && error.errorCode === null);
    });
  }
});

test('explicit cookie request options are forwarded without enabling cookies for product requests', async () => {
  const { session } = fakeSession();
  const requests: RequestInit[] = [];
  const client = createApiClient({ baseUrl: 'http://localhost:3000', session, fetcher: (async (_url, init) => {
    requests.push(init ?? {});
    return response(200, {});
  }) as typeof fetch });

  await client.request('/auth/login', {
    auth: 'public', method: 'POST', json: {}, credentials: 'include',
    headers: { 'X-Auth-Transport': 'cookie' },
  });
  await client.request('/catalog', { auth: 'public' });
  await client.request('/me', { auth: 'required' });

  assert.equal(requests[0].credentials, 'include');
  assert.deepEqual(requests[0].headers, { 'Content-Type': 'application/json', 'X-Auth-Transport': 'cookie' });
  assert.equal(requests[1].credentials, undefined);
  assert.deepEqual(requests[1].headers, {});
  assert.equal(requests[2].credentials, undefined);
  assert.deepEqual(requests[2].headers, { Authorization: 'Bearer access-old' });
});

test('parallel authenticated 401s share one refresh and retry each original request once', async () => {
  const { session, refreshCount } = fakeSession();
  const counts = new Map<string, number>();
  const client = createApiClient({ baseUrl: 'http://localhost:3000', session, fetcher: (async (url, init) => {
    const path = new URL(String(url)).pathname;
    counts.set(path, (counts.get(path) ?? 0) + 1);
    if (init?.headers && (init.headers as Record<string, string>).Authorization === 'Bearer access-old') return response(401, { errorCode: 'AUTH_INVALID_TOKEN' });
    return response(200, { path });
  }) as typeof fetch });

  const result = await Promise.all([
    client.request('/first', { auth: 'required' }),
    client.request('/second', { auth: 'required' }),
  ]);
  assert.deepEqual(result, [{ path: '/first' }, { path: '/second' }]);
  assert.equal(refreshCount(), 1);
  assert.deepEqual([...counts.values()], [2, 2]);
});

test('a late 401 from the old access token uses the rotated token without another refresh', async () => {
  const { session, refreshCount } = fakeSession();
  let releaseOldRequest!: (value: Response) => void;
  let firstRequest = true;
  const client = createApiClient({ baseUrl: 'http://localhost:3000', session, fetcher: (async (url, init) => {
    if (String(url).endsWith('/slow') && firstRequest) {
      firstRequest = false;
      return new Promise<Response>((resolve) => { releaseOldRequest = resolve; });
    }
    if ((init?.headers as Record<string, string>).Authorization === 'Bearer access-old') return response(401, { errorCode: 'AUTH_INVALID_TOKEN' });
    return response(200, { ok: true });
  }) as typeof fetch });
  const slow = client.request('/slow', { auth: 'required' });
  await Promise.resolve();
  assert.deepEqual(await client.request('/fast', { auth: 'required' }), { ok: true });
  releaseOldRequest(response(401, { errorCode: 'AUTH_INVALID_TOKEN' }));
  assert.deepEqual(await slow, { ok: true });
  assert.equal(refreshCount(), 1);
});

test('403, 5xx, and public auth requests never trigger refresh', async (t) => {
  for (const [path, auth, status, code] of [
    ['/forbidden', 'required', 403, 'EPISODE_ACCESS_DENIED'],
    ['/global-forbidden', 'required', 403, 'HTTP_FORBIDDEN'],
    ['/server-error', 'required', 503, 'HTTP_SERVICE_UNAVAILABLE'],
    ['/generic-unauthorized', 'required', 401, 'HTTP_UNAUTHORIZED'],
    ['/login-failed', 'required', 401, 'AUTH_LOGIN_FAILED'],
    ['/auth/login', 'public', 401, 'AUTH_INVALID_TOKEN'],
  ] as const) {
    await t.test(path, async () => {
      const { session, refreshCount } = fakeSession();
      const client = createApiClient({ baseUrl: 'http://localhost:3000', session, fetcher: (async () => response(status, { errorCode: code })) as typeof fetch });
      await assert.rejects(client.request(path, { auth }), (error) => error instanceof ApiError && error.status === status && error.errorCode === code);
      assert.equal(refreshCount(), 0);
    });
  }
});

test('one failed retry expires the current session and does not retry again', async () => {
  const { session, expirationCount } = fakeSession();
  let requests = 0;
  const client = createApiClient({ baseUrl: 'http://localhost:3000', session, fetcher: (async () => {
    requests += 1;
    return response(401, { errorCode: 'AUTH_INVALID_TOKEN' });
  }) as typeof fetch });
  await assert.rejects(client.request('/private', { auth: 'required' }), (error) => error instanceof ApiError);
  assert.equal(requests, 2);
  assert.equal(expirationCount(), 1);
});

test('session changes discard responses that began in the previous session', async () => {
  const { session, set } = fakeSession();
  let finish!: (value: Response) => void;
  const client = createApiClient({ baseUrl: 'http://localhost:3000', session, fetcher: (async () => new Promise<Response>((resolve) => { finish = resolve; })) as typeof fetch });
  const pending = client.request('/private', { auth: 'optional' });
  await new Promise<void>((resolve) => setImmediate(resolve));
  set({ version: 2, accessToken: 'new-account-token' });
  finish(response(200, {}));
  await assert.rejects(pending, SessionChangedError);
});

test('a session change while refresh is pending prevents retry under the new account', async () => {
  let current: SessionState = { version: 1, accessToken: 'old-account-token' };
  let finishRefresh!: () => void;
  let requests = 0;
  const session = {
    async ready() {},
    getSessionState: () => ({ ...current }),
    refreshOnce: async () => new Promise<void>((resolve) => { finishRefresh = resolve; }),
    async expire() {},
  };
  const client = createApiClient({ baseUrl: 'http://localhost:3000', session, fetcher: (async () => {
    requests += 1;
    return response(401, { errorCode: 'AUTH_INVALID_TOKEN' });
  }) as typeof fetch });
  const pending = client.request('/private', { auth: 'required' });
  await new Promise<void>((resolve) => setImmediate(resolve));
  current = { version: 2, accessToken: 'new-account-token' };
  finishRefresh();
  await assert.rejects(pending, SessionChangedError);
  assert.equal(requests, 1);
});
