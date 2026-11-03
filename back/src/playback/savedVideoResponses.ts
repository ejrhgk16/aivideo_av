import type { PageResponse } from '../common/pagination/paginationResponses.js';

export type SavedContentType = 'EPISODE' | 'PREVIEW';

export type SavedVideoBase = {
  videoUuid: string;
  savedAt: string;
  dramaUuid: string;
  dramaTitle: string;
  imageUrl: string | null;
  durationMs: number;
};

export type SavedVideoItemResponse = SavedVideoBase & (
  | { contentType: 'PREVIEW'; episodeUuid: null; episodeNumber: null; episodeTitle: null }
  | { contentType: 'EPISODE'; episodeUuid: string; episodeNumber: number; episodeTitle: string | null }
);

export type SavedVideoPageResponse = PageResponse<SavedVideoItemResponse>;
