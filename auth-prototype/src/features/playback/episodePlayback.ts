import { apiRequest } from '../user/sessionClient';
import type { EpisodePlayback } from './playbackResponses';

export type { EpisodePlayback } from './playbackResponses';

export async function getEpisodePlayback(episodeId: string): Promise<EpisodePlayback> {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be set to fetch episode playback.');
  }

  const playback = await apiRequest<EpisodePlayback>(`/episodes/${encodeURIComponent(episodeId)}/playback`, { auth: 'optional' });
  return {
    ...playback,
    url: new URL(playback.url, `${new URL(baseUrl).origin}/`).toString(),
  };
}
