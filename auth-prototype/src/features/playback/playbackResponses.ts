export type EpisodePlayback = {
  url: string;
  videoUuid: string;
  isSaved: boolean;
  title: string | null;
  episodeNumber: number;
  durationMs: number;
};

export type PreviewPlayback = {
  url: string;
  videoUuid: string;
  isSaved: boolean;
  durationMs: number;
};

export type SavedContentType = 'EPISODE' | 'PREVIEW';

type LibraryVideoBase = {
  videoUuid: string;
  dramaUuid: string;
  dramaTitle: string;
  imageUrl: string | null;
  durationMs: number;
};

type LibraryVideoDetails = LibraryVideoBase & (
  | {
      contentType: 'EPISODE';
      episodeUuid: string;
      episodeNumber: number;
      episodeTitle: string | null;
    }
  | {
      contentType: 'PREVIEW';
      episodeUuid: null;
      episodeNumber: null;
      episodeTitle: null;
    }
);

export type SavedVideoItem = LibraryVideoDetails & { savedAt: string };

export type WatchHistoryItem = LibraryVideoDetails & { lastPlayedAt: string };

export type SavedVideoPage = {
  items: SavedVideoItem[];
  page: number;
  hasNext: boolean;
};

export type WatchHistoryPage = {
  items: WatchHistoryItem[];
  page: number;
  hasNext: boolean;
};
