import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { createSavedVideoState, type SavedVideoSnapshot } from './savedVideoState';
import { removeSavedVideo, saveVideo, type SavedContentType } from './savedVideos';
import { useUser } from '../user/UserProvider';

type SavedVideoState = ReturnType<typeof createSavedVideoState>;
type SavedVideosContextValue = {
  state: SavedVideoState;
  snapshot: SavedVideoSnapshot;
};

const SavedVideosContext = createContext<SavedVideosContextValue | null>(null);

export function SavedVideosProvider({ children }: { children: ReactNode }) {
  const { user, sessionVersion, isCurrentSession } = useUser();
  const userUuid = user?.uuid ?? null;
  const state = useMemo(() => createSavedVideoState(
    (videoUuid, contentType, nextSaved) => nextSaved
      ? saveVideo(videoUuid, contentType)
      : removeSavedVideo(videoUuid),
    () => isCurrentSession(sessionVersion),
    () => userUuid !== null && isCurrentSession(sessionVersion),
  ), [userUuid, sessionVersion, isCurrentSession]);
  const snapshot = useSyncExternalStore(state.subscribe, state.getSnapshot, state.getSnapshot);
  const value = useMemo(() => ({ state, snapshot }), [state, snapshot]);

  return <SavedVideosContext.Provider value={value}>{children}</SavedVideosContext.Provider>;
}

export function useSavedVideos() {
  const context = useContext(SavedVideosContext);
  if (context === null) throw new Error('useSavedVideos must be used within SavedVideosProvider');
  return context;
}

export function useSavedVideo(
  videoUuid: string | null,
  contentType: SavedContentType,
  initialSaved: boolean,
) {
  const { state, snapshot } = useSavedVideos();
  const entry = videoUuid === null ? undefined : snapshot.videos[videoUuid];

  return {
    saved: entry?.isSaved ?? (videoUuid === null ? false : initialSaved),
    pending: entry?.pending ?? false,
    toggle: () => videoUuid === null
      ? Promise.resolve(false)
      : state.toggle(videoUuid, contentType, initialSaved),
  };
}
