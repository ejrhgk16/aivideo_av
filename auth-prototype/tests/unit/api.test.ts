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

  expect(requests[0].headers && 'Authorization' in requests[0].headers).toBe(false);
  expect(requests[1].headers).toEqual({ Authorization: 'Bearer access-old' });
  expect(requests[2].headers).toEqual({ Authorization: 'Bearer access-old' });
});

test('required requests without a token fail locally without fetching', async () => {
  const { session } = fakeSession({ version: 1, accessToken: null });
  let requests = 0;
  const client = createApiClient({ baseUrl: 'http://localhost:3000', session, fetcher: (async () => { requests++; return response(200); }) as typeof fetch });
  const request = client.request('/private', { auth: 'required' });
  await expect(request).rejects.toBeInstanceOf(ApiError);
  await expect(request).rejects.toMatchObject({ status: 401 });
  expect(requests).toBe(0);
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
  await expect(client.request('/write', { auth: 'public', method: 'POST', json: { value: 1 } })).resolves.toBeUndefined();
  expect(requests[0].headers).toEqual({ 'Content-Type': 'application/json' });
  expect(requests[0].body).toBe(JSON.stringify({ value: 1 }));
  expect(emptyJsonCalls).toBe(0);
  const failure = client.request('/fail', { auth: 'public' });
  await expect(failure).rejects.toBeInstanceOf(ApiError);
  await expect(failure).rejects.toMatchObject({ status: 503, errorCode: null });
});

test('successful API responses are returned as the original JSON, including business data fields', async () => {
  const { session } = fakeSession();
  const original = { data: { label: 'a business field' }, value: null, items: [1, { name: 'one' }] };
  const client = createApiClient({ baseUrl: 'http://localhost:3000', session, fetcher: (async () => response(200, original)) as typeof fetch });
  const result = await client.request<typeof original>('/raw-response', { auth: 'public' });
  expect(result).toEqual(original);
  expect(result).toBe(original);
});

test.each([
    ['standard error with mismatched body status', 409, { errorCode: 'HTTP_CONFLICT', statusCode: 503 }],
    ['unknown error code', 404, { errorCode: 'HTTP_FUTURE_STATUS' }],
    ['body without error code', 403, { statusCode: 401 }],
  ] as const
)("shared API error parsing preserves status for %s", async (_name, status, body) => {
  const { session } = fakeSession();
  const client = createApiClient({ baseUrl: 'http://localhost:3000', session, fetcher: (async () => response(status, body)) as typeof fetch });
  const failure = client.request('/failure', { auth: 'public' });
  await expect(failure).rejects.toBeInstanceOf(ApiError);
  await expect(failure).rejects.toMatchObject({
    status,
    errorCode: 'errorCode' in body ? body.errorCode : null,
  });
});

test.each([['malformed JSON', 400], ['non-JSON response', 502]] as const)(
  'shared API error parsing tolerates %s bodies', async (_name, status) => {
    const { session } = fakeSession();
    const client = createApiClient({ baseUrl: 'http://localhost:3000', session, fetcher: (async () => ({
      ok: false, status, json: async () => { throw new SyntaxError('invalid JSON'); },
    }) as unknown as Response) as typeof fetch });
    const failure = client.request('/failure', { auth: 'public' });
    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toMatchObject({ status, errorCode: null });
  },
);
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

  expect(requests[0].credentials).toBe('include');
  expect(requests[0].headers).toEqual({ 'Content-Type': 'application/json', 'X-Auth-Transport': 'cookie' });
  expect(requests[1].credentials).toBeUndefined();
  expect(requests[1].headers).toEqual({});
  expect(requests[2].credentials).toBeUndefined();
  expect(requests[2].headers).toEqual({ Authorization: 'Bearer access-old' });
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
  expect(result).toEqual([{ path: '/first' }, { path: '/second' }]);
  expect(refreshCount()).toBe(1);
  expect([...counts.values()]).toEqual([2, 2]);
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
  await expect(client.request('/fast', { auth: 'required' })).resolves.toEqual({ ok: true });
  releaseOldRequest(response(401, { errorCode: 'AUTH_INVALID_TOKEN' }));
  await expect(slow).resolves.toEqual({ ok: true });
  expect(refreshCount()).toBe(1);
});

test.each([
  ['/forbidden', 'required', 403, 'EPISODE_ACCESS_DENIED'],
    ['/global-forbidden', 'required', 403, 'HTTP_FORBIDDEN'],
    ['/server-error', 'required', 503, 'HTTP_SERVICE_UNAVAILABLE'],
    ['/generic-unauthorized', 'required', 401, 'HTTP_UNAUTHORIZED'],
    ['/login-failed', 'required', 401, 'AUTH_LOGIN_FAILED'],
    ['/auth/login', 'public', 401, 'AUTH_INVALID_TOKEN'],
 ] as const)('%s with %s auth and %s %s does not refresh', async (path, auth, status, code) => {
  const { session, refreshCount } = fakeSession();
  const client = createApiClient({ baseUrl: 'http://localhost:3000', session, fetcher: (async () => response(status, { errorCode: code })) as typeof fetch });
  const request = client.request(path, { auth });
  await expect(request).rejects.toBeInstanceOf(ApiError);
  await expect(request).rejects.toMatchObject({ status, errorCode: code });
  expect(refreshCount()).toBe(0);
});

test('one failed retry expires the current session and does not retry again', async () => {
  const { session, expirationCount } = fakeSession();
  let requests = 0;
  const client = createApiClient({ baseUrl: 'http://localhost:3000', session, fetcher: (async () => {
    requests += 1;
    return response(401, { errorCode: 'AUTH_INVALID_TOKEN' });
  }) as typeof fetch });
  const request = client.request('/private', { auth: 'required' });
  await expect(request).rejects.toBeInstanceOf(ApiError);
  expect(requests).toBe(2);
  expect(expirationCount()).toBe(1);
});

test('session changes discard responses that began in the previous session', async () => {
  const { session, set } = fakeSession();
  let finish!: (value: Response) => void;
  const client = createApiClient({ baseUrl: 'http://localhost:3000', session, fetcher: (async () => new Promise<Response>((resolve) => { finish = resolve; })) as typeof fetch });
  const pending = client.request('/private', { auth: 'optional' });
  await new Promise<void>((resolve) => setImmediate(resolve));
  set({ version: 2, accessToken: 'new-account-token' });
  finish(response(200, {}));
  await expect(pending).rejects.toBeInstanceOf(SessionChangedError);
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
  await expect(pending).rejects.toBeInstanceOf(SessionChangedError);
  expect(requests).toBe(1);
});
