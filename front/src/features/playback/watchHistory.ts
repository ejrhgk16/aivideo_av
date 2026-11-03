import { apiRequest } from '../user/sessionClient';
import type { WatchHistoryPage } from './playbackResponses';

export type { WatchHistoryItem, WatchHistoryPage } from './playbackResponses';

export function getWatchHistory(page = 1): Promise<WatchHistoryPage> {
  return apiRequest<WatchHistoryPage>('/me/watch-history?page=' + encodeURIComponent(page), {
    auth: 'required',
  });
}
