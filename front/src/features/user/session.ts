import { ApiError } from '../../common/http/api';
import type { LoginResponse, RefreshTransport } from './login';

export type RefreshTokenStorage = {
  read: () => Promise<string | null>;
  write: (token: string) => Promise<void>;
  remove: () => Promise<void>;
};

async function post(path: 'refresh' | 'logout', body: object, fetcher: typeof fetch, configuredBaseUrl?: string, transport: RefreshTransport = 'body'): Promise<Response> {
  const baseUrl = configuredBaseUrl ?? process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!baseUrl) throw new Error('EXPO_PUBLIC_API_BASE_URL must be set to manage the session.');
  const response = await fetcher(`${baseUrl.replace(/\/+$/, '')}/auth/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(transport === 'cookie' ? { 'X-Auth-Transport': 'cookie' } : {}),
    },
    body: JSON.stringify(body),
    ...(transport === 'cookie' ? { credentials: 'include' as const } : {}),
  });
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { body = null; }
    const errorCode = body !== null && typeof body === 'object' && 'errorCode' in body && typeof body.errorCode === 'string'
      ? body.errorCode
      : null;
    throw new ApiError(response.status, errorCode);
  }
  return response;
}

export async function storeLoginResponse(response: LoginResponse, storage: RefreshTokenStorage, transport: RefreshTransport = 'body') {
  if (transport === 'body') {
    if (typeof response.refreshToken !== 'string' || !response.refreshToken.trim()) {
      throw new Error('Refresh token is missing from the native session response.');
    }
    await storage.write(response.refreshToken);
  }
  return response;
}

export async function restoreSession(
  storage: RefreshTokenStorage,
  fetcher: typeof fetch = fetch,
  baseUrl?: string,
  transport: RefreshTransport = 'body',
): Promise<LoginResponse | null> {
  if (transport === 'cookie') {
    const response = await post('refresh', {}, fetcher, baseUrl, transport);
    if (response.status === 204) return null;
    return await response.json() as LoginResponse;
  }

  const refreshToken = await storage.read();
  if (refreshToken === null) return null;

  let response: Response;
  try {
    response = await post('refresh', { refreshToken }, fetcher, baseUrl);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      try { await storage.remove(); } catch (storageError) {
        Object.defineProperty(error, 'storageError', { value: storageError, enumerable: false });
      }
    }
    throw error;
  }

  const session = await response.json() as LoginResponse;
  if (typeof session.refreshToken !== 'string' || !session.refreshToken.trim()) {
    throw new Error('Refresh token is missing from the native session response.');
  }
  await storage.write(session.refreshToken);
  return session;
}

export async function logoutSession(storage: RefreshTokenStorage, fetcher: typeof fetch = fetch, baseUrl?: string, transport: RefreshTransport = 'body') {
  if (transport === 'cookie') {
    await post('logout', {}, fetcher, baseUrl, transport);
    return;
  }

  try {
    const refreshToken = await storage.read();
    if (refreshToken !== null) await post('logout', { refreshToken }, fetcher, baseUrl);
  } finally {
    await storage.remove();
  }
}

export function createSessionQueue() {
  let queued = Promise.resolve();
  return {
    enqueue<T>(operation: () => Promise<T>): Promise<T> {
      const next = queued.then(operation, operation);
      queued = next.then(() => undefined, () => undefined);
      return next;
    },
  };
}

export function createRestoreOnce<T>(operation: () => Promise<T>): () => Promise<T> {
  let restoration: Promise<T> | null = null;
  return () => restoration ??= operation();
}
