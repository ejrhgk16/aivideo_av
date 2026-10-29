import { ApiError, createApiClient, SessionChangedError, type ApiSession } from '../../common/http/api';
import type { LoginInput, LoginResponse, RefreshTransport } from './login';
import { login as requestLogin } from './login';
import { createSessionQueue, logoutSession, restoreSession, storeLoginResponse, type RefreshTokenStorage } from './session';

export type User = {
  uuid: string;
  displayName: string | null;
  accountType: 'GUEST' | 'MEMBER' | 'OPERATOR' | 'PARTNER';
};

export type UserSessionState = {
  version: number;
  accessToken: string | null;
  user: User | null;
  points: number | null;
  isRestoring: boolean;
  restoreError: string | null;
  sessionExpired: boolean;
};

type SessionClientOptions = {
  baseUrl: string;
  storage: RefreshTokenStorage;
  fetcher?: typeof fetch;
  refreshTransport?: RefreshTransport;
  loginRequest?: (input: LoginInput, fetcher?: typeof fetch, transport?: RefreshTransport) => Promise<LoginResponse>;
};

function userSession(response: LoginResponse): Pick<UserSessionState, 'user' | 'points' | 'accessToken'> {
  const { uuid, displayName, accountType, availablePoints, accessToken } = response;
  return { user: { uuid, displayName, accountType }, points: availablePoints, accessToken };
}

export function createSessionClient({ baseUrl, storage, fetcher = fetch, refreshTransport = 'body', loginRequest = requestLogin }: SessionClientOptions) {
  const queue = createSessionQueue();
  const listeners = new Set<() => void>();
  const state: UserSessionState = {
    version: 0,
    accessToken: null,
    user: null,
    points: null,
    isRestoring: true,
    restoreError: null,
    sessionExpired: false,
  };
  let restoration: Promise<void> | null = null;
  let initialized = false;
  let automaticRefreshBlocked = false;
  const refreshes = new Map<number, { accessToken: string; promise: Promise<void> }>();

  function notify() { for (const listener of listeners) listener(); }
  function patch(values: Partial<UserSessionState>) {
    Object.assign(state, values);
    notify();
  }
  function clearSession(sessionExpired: boolean) {
    state.version += 1;
    patch({ user: null, points: null, accessToken: null, sessionExpired, restoreError: null });
  }
  function currentUserSession(response: LoginResponse) {
    patch({ ...userSession(response), restoreError: null });
  }
  function applyRefreshedSession(response: LoginResponse, version: number) {
    if (state.version !== version) throw new SessionChangedError();
    if (refreshTransport === 'cookie' && state.user !== null && response.uuid !== state.user.uuid) {
      clearSession(true);
      throw new SessionChangedError();
    }
    currentUserSession(response);
  }
  function getSessionState() {
    return { version: state.version, accessToken: state.accessToken };
  }

  async function initialize(): Promise<void> {
    if (restoration !== null) return restoration;
    automaticRefreshBlocked = false;
    patch({ isRestoring: true, restoreError: null });
    restoration = queue.enqueue(async () => {
      const version = state.version;
      try {
        const response = await restoreSession(storage, fetcher, baseUrl, refreshTransport);
        if (version === state.version) {
          if (response === null) patch({ user: null, points: null, accessToken: null });
          else applyRefreshedSession(response, version);
        }
      } catch (error) {
        if (version === state.version) {
          if (error instanceof ApiError && error.status === 401 && error.errorCode === 'AUTH_INVALID_TOKEN') {
            clearSession(true);
          }
          patch({ user: null, points: null, accessToken: null, restoreError: error instanceof Error ? error.message : '세션을 복원하지 못했습니다.' });
        }
      } finally {
        initialized = true;
        patch({ isRestoring: false });
      }
    }).finally(() => { restoration = null; });
    return restoration;
  }

  async function expire(version: number, cause?: unknown): Promise<void> {
    if (state.version !== version) return;
    clearSession(true);
    try {
      await queue.enqueue(() => refreshTransport === 'cookie'
        ? logoutSession(storage, fetcher, baseUrl, refreshTransport)
        : storage.remove());
    } catch (error) {
      if (cause !== null && (typeof cause === 'object' || typeof cause === 'function')) {
        Object.defineProperty(cause, 'storageError', { value: error, enumerable: false, configurable: true });
      } else {
        throw error;
      }
    }
  }

  const session: ApiSession = {
    async ready() {
      if (restoration !== null) await restoration;
      else if (!initialized) await initialize();
    },
    getSessionState,
    async refreshOnce(version, failedAccess) {
      const existing = refreshes.get(version);
      if (existing?.accessToken === failedAccess) return existing.promise;
      const refresh = queue.enqueue(async () => {
        if (state.version !== version) throw new SessionChangedError();
        if (state.accessToken !== failedAccess) return;
        if (automaticRefreshBlocked) throw new Error('Session refresh is unavailable until a new login or explicit restore.');
        try {
          const response = await restoreSession(storage, fetcher, baseUrl, refreshTransport);
          if (response === null) {
            clearSession(true);
            throw new ApiError(401, 'AUTH_INVALID_TOKEN');
          }
          applyRefreshedSession(response, version);
        } catch (error) {
          if (error instanceof ApiError && error.status === 401 && error.errorCode === 'AUTH_INVALID_TOKEN') {
            if (state.version === version) clearSession(true);
          } else if (!(error instanceof SessionChangedError)) {
            automaticRefreshBlocked = true;
          }
          throw error;
        }
      });
      const entry = { accessToken: failedAccess, promise: refresh };
      refreshes.set(version, entry);
      void refresh.finally(() => { if (refreshes.get(version) === entry) refreshes.delete(version); }).catch(() => undefined);
      return refresh;
    },
    expire,
  };

  const api = createApiClient({ baseUrl, fetcher, session });

  function login(input: LoginInput): Promise<LoginResponse> {
    state.version += 1;
    patch({ user: null, points: null, accessToken: null, restoreError: null });
    const version = state.version;
    automaticRefreshBlocked = false;
    return queue.enqueue(async () => {
      const response = await loginRequest(input, fetcher, refreshTransport);
      await storeLoginResponse(response, storage, refreshTransport);
      if (state.version === version) {
        currentUserSession(response);
        patch({ sessionExpired: false, restoreError: null, isRestoring: false });
      }
      return response;
    });
  }

  function logout(): Promise<void> {
    clearSession(false);
    const version = state.version;
    return queue.enqueue(async () => {
      try {
        await logoutSession(storage, fetcher, baseUrl, refreshTransport);
      } finally {
        if (state.version === version) patch({ user: null, points: null, accessToken: null });
      }
    });
  }

  return {
    apiRequest: api.request,
    initialize,
    login,
    logout,
    getSessionState,
    getUserSessionState: (): UserSessionState => ({ ...state }),
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setUser(user: User | null, points: number | null = null) { patch({ user, points: user === null ? null : points }); },
    setPoints(points: number) { if (state.user !== null) patch({ points }); },
    dismissSessionExpired() { patch({ sessionExpired: false }); },
    isCurrentSession(version: number) { return state.version === version; },
  };
}

let activeSessionClient: ReturnType<typeof createSessionClient> | null = null;

export function configureSessionClient(options: SessionClientOptions) {
  if (activeSessionClient === null) {
    activeSessionClient = createSessionClient(options);
    void activeSessionClient.initialize();
  }
  return activeSessionClient;
}

export function apiRequest<T>(path: string, options: Parameters<ReturnType<typeof createApiClient>['request']>[1]): Promise<T> {
  if (activeSessionClient === null) throw new Error('The session client has not been configured.');
  return activeSessionClient.apiRequest<T>(path, options);
}
