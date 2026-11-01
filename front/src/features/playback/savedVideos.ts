import { apiRequest } from '../user/sessionClient';
import type { SavedContentType, SavedVideoItem, SavedVideoPage } from './playbackResponses';

export type { SavedContentType, SavedVideoItem, SavedVideoPage } from './playbackResponses';

export function saveVideo(videoUuid: string, contentType: SavedContentType): Promise<void> {
  return apiRequest<void>('/me/saved-videos/' + encodeURIComponent(videoUuid), {
    auth: 'required',
    method: 'PUT',
    json: { contentType },
  });
}

export function removeSavedVideo(videoUuid: string): Promise<void> {
  return apiRequest<void>('/me/saved-videos/' + encodeURIComponent(videoUuid), {
    auth: 'required',
    method: 'DELETE',
  });
}

export function getSavedVideos(page = 1): Promise<SavedVideoPage> {
  return apiRequest<SavedVideoPage>('/me/saved-videos?page=' + encodeURIComponent(page), {
    auth: 'required',
  });
}

export function savedVideoRoute(item: SavedVideoItem) {
  return item.contentType === 'EPISODE'
    ? {
        pathname: '/episode/[id]' as const,
        params: { id: item.episodeUuid, dramaId: item.dramaUuid },
      }
    : {
        pathname: '/preview/[dramaId]/[videoId]' as const,
        params: { dramaId: item.dramaUuid, videoId: item.videoUuid },
      };
}
