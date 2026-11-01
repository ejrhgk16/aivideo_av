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

type SavedVideoBase = {
  videoUuid: string;
  savedAt: string;
  dramaUuid: string;
  dramaTitle: string;
  imageUrl: string | null;
  durationMs: number;
};

export type SavedVideoItem = SavedVideoBase & (
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

export type SavedVideoPage = {
  items: SavedVideoItem[];
  page: number;
  hasNext: boolean;
};
