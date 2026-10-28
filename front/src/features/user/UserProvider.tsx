import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { readRefreshToken, removeRefreshToken, writeRefreshToken } from '@/common/storage/refreshTokenStorage';
import type { LoginInput, LoginResponse } from './login';
import { configureSessionClient, type User, type UserSessionState } from './sessionClient';

export type { User } from './sessionClient';

const sessionClient = configureSessionClient({
  baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
  storage: { read: readRefreshToken, write: writeRefreshToken, remove: removeRefreshToken },
});

type UserContextValue = Omit<UserSessionState, 'version'> & {
  accessToken: string | null;
  sessionVersion: number;
  subtitlesEnabled: boolean;
  autoplayNext: boolean;
  setUser: (user: User | null, points?: number | null) => void;
  setPoints: (points: number) => void;
  login: (input: LoginInput) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  dismissSessionExpired: () => void;
  isCurrentSession: (version: number) => boolean;
  setSubtitlesEnabled: (enabled: boolean) => void;
  setAutoplayNext: (enabled: boolean) => void;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<UserSessionState>(() => sessionClient.getUserSessionState());
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [autoplayNext, setAutoplayNext] = useState(false);

  useEffect(() => {
    const update = () => setSession(sessionClient.getUserSessionState());
    const unsubscribe = sessionClient.subscribe(update);
    update();
    return unsubscribe;
  }, []);

  const setUser = useCallback((user: User | null, points: number | null = null) => sessionClient.setUser(user, points), []);
  const setPoints = useCallback((points: number) => sessionClient.setPoints(points), []);
  const login = useCallback((input: LoginInput) => sessionClient.login(input), []);
  const logout = useCallback(() => sessionClient.logout(), []);
  const dismissSessionExpired = useCallback(() => sessionClient.dismissSessionExpired(), []);
  const isCurrentSession = useCallback((version: number) => sessionClient.isCurrentSession(version), []);

  const value = useMemo(() => ({
    ...session,
    accessToken: session.accessToken,
    sessionVersion: session.version,
    subtitlesEnabled,
    autoplayNext,
    setUser,
    setPoints,
    login,
    logout,
    dismissSessionExpired,
    isCurrentSession,
    setSubtitlesEnabled,
    setAutoplayNext,
  }), [session, subtitlesEnabled, autoplayNext, setUser, setPoints, login, logout, dismissSessionExpired, isCurrentSession]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === null) throw new Error('useUser must be used within UserProvider');
  return context;
}
