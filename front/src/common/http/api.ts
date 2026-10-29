export type AuthMode = 'public' | 'optional' | 'required';

export type ApiRequestOptions = {
  auth: AuthMode;
  method?: string;
  json?: unknown;
  credentials?: RequestCredentials;
  headers?: Record<string, string>;
};

export type SessionState = { version: number; accessToken: string | null };

export type ApiSession = {
  ready: () => Promise<void>;
  getSessionState: () => SessionState;
  refreshOnce: (version: number, accessToken: string) => Promise<void>;
  expire: (version: number, cause?: unknown) => Promise<void>;
};

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly errorCode: string | null) {
    super(errorCode ?? `HTTP_${status}`);
    this.name = 'ApiError';
  }
}

export class SessionChangedError extends Error {
  constructor() {
    super('The session changed while the request was in progress.');
    this.name = 'SessionChangedError';
  }
}

type ApiClientOptions = {
  baseUrl: string;
  fetcher?: typeof fetch;
  session: ApiSession;
};

export function createApiClient({ baseUrl, fetcher = fetch, session }: ApiClientOptions) {
  const root = baseUrl.replace(/\/+$/, '');

  async function send<T>(path: string, options: ApiRequestOptions, accessToken: string | null): Promise<T> {
    if (!root) throw new Error('EXPO_PUBLIC_API_BASE_URL must be set to call the API.');
    if (!path.startsWith('/') || path.startsWith('//')) throw new Error('API paths must be relative to the configured API origin.');
    const headers: Record<string, string> = {};
    if (options.json !== undefined) headers['Content-Type'] = 'application/json';
    Object.assign(headers, options.headers);
    if (accessToken !== null) headers.Authorization = `Bearer ${accessToken}`;
    const response = await fetcher(`${root}${path}`, {
      method: options.method ?? 'GET',
      headers,
      ...(options.json === undefined ? {} : { body: JSON.stringify(options.json) }),
      ...(options.credentials === undefined ? {} : { credentials: options.credentials }),
    });

    if (!response.ok) {
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      const errorCode = body !== null && typeof body === 'object' && 'errorCode' in body && typeof body.errorCode === 'string'
        ? body.errorCode
        : null;
      throw new ApiError(response.status, errorCode);
    }
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  }

  async function request<T>(path: string, options: ApiRequestOptions): Promise<T> {
    if (options.auth === 'public') return send<T>(path, options, null);

    await session.ready();
    const started = session.getSessionState();
    if (options.auth === 'required' && started.accessToken === null) throw new ApiError(401, 'AUTH_INVALID_TOKEN');
    const assertCurrent = () => {
      if (session.getSessionState().version !== started.version) throw new SessionChangedError();
    };

    try {
      const result = await send<T>(path, options, started.accessToken);
      assertCurrent();
      return result;
    } catch (error) {
      assertCurrent();
      if (!(error instanceof ApiError) || error.status !== 401 || error.errorCode !== 'AUTH_INVALID_TOKEN' || started.accessToken === null) {
        throw error;
      }

      if (session.getSessionState().accessToken === started.accessToken) {
        await session.refreshOnce(started.version, started.accessToken);
      }
      assertCurrent();

      try {
        const result = await send<T>(path, options, session.getSessionState().accessToken);
        assertCurrent();
        return result;
      } catch (retryError) {
        assertCurrent();
        if (retryError instanceof ApiError && retryError.status === 401 && retryError.errorCode === 'AUTH_INVALID_TOKEN') {
          await session.expire(started.version, retryError);
        }
        throw retryError;
      }
    }
  }

  return { request };
}

export function publicApiRequest<T>(path: string, options: Omit<ApiRequestOptions, 'auth'>, fetcher: typeof fetch = fetch): Promise<T> {
  const client = createApiClient({
    baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
    fetcher,
    session: {
      async ready() {},
      getSessionState: () => ({ version: 0, accessToken: null }),
      async refreshOnce() {},
      async expire() {},
    },
  });
  return client.request(path, { ...options, auth: 'public' });
}
