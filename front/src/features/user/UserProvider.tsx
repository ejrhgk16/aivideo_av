import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { readRefreshToken, removeRefreshToken, writeRefreshToken } from '@/common/storage/refreshTokenStorage';
import { login as requestLogin, type LoginInput, type LoginResponse } from './login';
import { createRestoreOnce, createSessionQueue, logoutSession, restoreSession, storeLoginResponse } from './session';

export type User = {
  uuid: string;
  displayName: string | null;
  accountType: 'GUEST' | 'MEMBER' | 'OPERATOR' | 'PARTNER';
};

type UserSession = {
  user: User | null;
  points: number | null;
};

type UserContextValue = UserSession & {
  accessToken: string | null;
  isRestoring: boolean;
  restoreError: string | null;
  subtitlesEnabled: boolean;
  autoplayNext: boolean;
  setUser: (user: User | null, points?: number | null) => void;
  setPoints: (points: number) => void;
  login: (input: LoginInput) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  setSubtitlesEnabled: (enabled: boolean) => void;
  setAutoplayNext: (enabled: boolean) => void;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<UserSession>({ user: null, points: null });
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [autoplayNext, setAutoplayNext] = useState(false);
  const mounted = useRef(false);
  const queue = useRef<ReturnType<typeof createSessionQueue> | null>(null);
  queue.current ??= createSessionQueue();
  const restoration = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    mounted.current = true;
    restoration.current ??= createRestoreOnce(() => queue.current!.enqueue(async () => {
      try {
        const response = await restoreSession({
          read: readRefreshToken,
          write: writeRefreshToken,
          remove: removeRefreshToken,
        });
        if (mounted.current) {
          setSession(response === null ? { user: null, points: null } : userSession(response));
          setAccessToken(response?.accessToken ?? null);
          setRestoreError(null);
        }
      } catch (error) {
        if (mounted.current) {
          setSession({ user: null, points: null });
          setAccessToken(null);
          setRestoreError(error instanceof Error ? error.message : '로그인을 복원하지 못했습니다.');
        }
      } finally {
        if (mounted.current) setIsRestoring(false);
      }
    }));
    void restoration.current();
    return () => { mounted.current = false; };
  }, []);

  const setUser = useCallback((user: User | null, points: number | null = null) => {
    setSession({
      user,
      points: user === null ? null : points,
    });
  }, []);

  const setPoints = useCallback((points: number) => {
    setSession((previous) => previous.user === null ? previous : { ...previous, points });
  }, []);

  const login = useCallback((input: LoginInput) => queue.current!.enqueue(async () => {
    const response = await requestLogin(input);
    await storeLoginResponse(response, { read: readRefreshToken, write: writeRefreshToken, remove: removeRefreshToken });
    if (mounted.current) {
      setSession(userSession(response));
      setAccessToken(response.accessToken);
      setRestoreError(null);
    }
    return response;
  }), []);

  const logout = useCallback(() => queue.current!.enqueue(async () => {
    try {
      await logoutSession({ read: readRefreshToken, write: writeRefreshToken, remove: removeRefreshToken });
    } finally {
      if (mounted.current) {
        setSession({ user: null, points: null });
        setAccessToken(null);
        setRestoreError(null);
      }
    }
  }), []);

  const value = useMemo(() => ({
    ...session,
    accessToken,
    isRestoring,
    restoreError,
    subtitlesEnabled,
    autoplayNext,
    setUser,
    setPoints,
    login,
    logout,
    setSubtitlesEnabled,
    setAutoplayNext,
  }), [session, accessToken, isRestoring, restoreError, subtitlesEnabled, autoplayNext, setUser, setPoints, login, logout]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

function userSession(response: LoginResponse): UserSession {
  const { uuid, displayName, accountType, availablePoints } = response;
  return { user: { uuid, displayName, accountType }, points: availablePoints };
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === null) throw new Error('useUser must be used within UserProvider');
  return context;
}
