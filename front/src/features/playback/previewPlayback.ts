import { apiRequest } from '../user/sessionClient';

export interface PreviewPlayback {
  url: string;
  durationMs: number;
}

export async function getPreviewPlayback(dramaId: string, videoId: string): Promise<PreviewPlayback> {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be set to fetch preview playback.');
  }

  const path = `dramas/${encodeURIComponent(dramaId)}/previews/${encodeURIComponent(videoId)}/playback`;
  return apiRequest<PreviewPlayback>(`/${path}`, { auth: 'public' });
}
