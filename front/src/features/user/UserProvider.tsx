import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

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
  subtitlesEnabled: boolean;
  autoplayNext: boolean;
  setUser: (user: User | null, points?: number | null) => void;
  setPoints: (points: number) => void;
  setSubtitlesEnabled: (enabled: boolean) => void;
  setAutoplayNext: (enabled: boolean) => void;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<UserSession>({ user: null, points: null });
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [autoplayNext, setAutoplayNext] = useState(false);

  const setUser = useCallback((user: User | null, points: number | null = null) => {
    setSession({
      user,
      points: user === null ? null : points,
    });
  }, []);

  const setPoints = useCallback((points: number) => {
    setSession((previous) => previous.user === null ? previous : { ...previous, points });
  }, []);

  const value = useMemo(() => ({
    ...session,
    subtitlesEnabled,
    autoplayNext,
    setUser,
    setPoints,
    setSubtitlesEnabled,
    setAutoplayNext,
  }), [session, subtitlesEnabled, autoplayNext, setUser, setPoints]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === null) throw new Error('useUser must be used within UserProvider');
  return context;
}
