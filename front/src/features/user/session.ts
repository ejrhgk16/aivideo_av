import { AuthRequestError, type LoginResponse } from './login';

export type RefreshTokenStorage = {
  read: () => Promise<string | null>;
  write: (token: string) => Promise<void>;
  remove: () => Promise<void>;
};

async function post(path: 'refresh' | 'logout', body: object, fetcher: typeof fetch): Promise<Response> {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!baseUrl) throw new Error('EXPO_PUBLIC_API_BASE_URL must be set to manage the session.');
  const response = await fetcher(`${baseUrl.replace(/\/+$/, '')}/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new AuthRequestError(`Failed to ${path} session: ${response.status}`, response.status);
  return response;
}

export async function storeLoginResponse(response: LoginResponse, storage: RefreshTokenStorage) {
  await storage.write(response.refreshToken);
  return response;
}

export async function restoreSession(
  storage: RefreshTokenStorage,
  fetcher: typeof fetch = fetch,
): Promise<LoginResponse | null> {
  const refreshToken = await storage.read();
  if (refreshToken === null) return null;

  let response: Response;
  try {
    response = await post('refresh', { refreshToken }, fetcher);
  } catch (error) {
    if (error instanceof AuthRequestError && error.status === 401) await storage.remove();
    throw error;
  }

  const session = await response.json() as LoginResponse;
  await storage.write(session.refreshToken);
  return session;
}

export async function logoutSession(storage: RefreshTokenStorage, fetcher: typeof fetch = fetch) {
  try {
    const refreshToken = await storage.read();
    if (refreshToken !== null) await post('logout', { refreshToken }, fetcher);
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
