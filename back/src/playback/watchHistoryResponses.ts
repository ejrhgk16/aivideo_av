import type { PageResponse } from '../common/pagination/paginationResponses.js';

export type WatchHistoryBase = {
  videoUuid: string;
  lastPlayedAt: string;
  dramaUuid: string;
  dramaTitle: string;
  imageUrl: string | null;
  durationMs: number;
};

export type WatchHistoryItemResponse = WatchHistoryBase & (
  | { contentType: 'PREVIEW'; episodeUuid: null; episodeNumber: null; episodeTitle: null }
  | { contentType: 'EPISODE'; episodeUuid: string; episodeNumber: number; episodeTitle: string | null }
);

export type WatchHistoryPageResponse = PageResponse<WatchHistoryItemResponse>;
