import { apiRequest } from '../user/sessionClient';
import type { PreviewPlayback } from './playbackResponses';

export type { PreviewPlayback } from './playbackResponses';

export async function getPreviewPlayback(dramaId: string, videoId: string): Promise<PreviewPlayback> {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be set to fetch preview playback.');
  }

  const path = `dramas/${encodeURIComponent(dramaId)}/previews/${encodeURIComponent(videoId)}/playback`;
  return apiRequest<PreviewPlayback>(`/${path}`, { auth: 'optional' });
}
