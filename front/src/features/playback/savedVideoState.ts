import type { SavedContentType } from './savedVideos';

export type SavedVideoEntry = {
  isSaved: boolean;
  pending: boolean;
};

export type SavedVideoObservation = {
  videoUuid: string;
  isSaved: boolean;
};

export type SavedVideoSnapshot = {
  videos: Record<string, SavedVideoEntry>;
  revision: number;
};

export function createSavedVideoState(
  send: (videoUuid: string, contentType: SavedContentType, nextSaved: boolean) => Promise<void>,
  isCurrent: () => boolean,
  canWrite: () => boolean = isCurrent,
) {
  let snapshot: SavedVideoSnapshot = { videos: {}, revision: 0 };
  const listeners = new Set<() => void>();

  function publish(videos: Record<string, SavedVideoEntry>, revision = snapshot.revision) {
    if (videos === snapshot.videos && revision === snapshot.revision) return;
    snapshot = { videos, revision };
    for (const listener of listeners) listener();
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    accept(rows: SavedVideoObservation[], startedRevision: number) {
      if (!isCurrent() || snapshot.revision !== startedRevision) return false;
      let videos = snapshot.videos;
      for (const row of rows) {
        const existing = videos[row.videoUuid];
        if (existing?.pending) continue;
        if (existing?.isSaved === row.isSaved && existing.pending === false) continue;
        if (videos === snapshot.videos) videos = { ...videos };
        videos[row.videoUuid] = { isSaved: row.isSaved, pending: false };
      }
      publish(videos);
      return true;
    },
    async toggle(videoUuid: string, contentType: SavedContentType, initialSaved: boolean) {
      if (!canWrite()) return false;
      const entry = snapshot.videos[videoUuid] ?? { isSaved: initialSaved, pending: false };
      if (entry.pending) return false;

      publish({ ...snapshot.videos, [videoUuid]: { ...entry, pending: true } });
      let nextSaved = entry.isSaved;
      try {
        await send(videoUuid, contentType, !entry.isSaved);
        if (!isCurrent()) return false;
        nextSaved = !entry.isSaved;
        return true;
      } finally {
        if (isCurrent()) {
          publish({
            ...snapshot.videos,
            [videoUuid]: { isSaved: nextSaved, pending: false },
          }, snapshot.revision + 1);
        }
      }
    },
  };
}
