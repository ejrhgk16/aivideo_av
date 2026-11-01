import { apiRequest } from '../user/sessionClient';

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
