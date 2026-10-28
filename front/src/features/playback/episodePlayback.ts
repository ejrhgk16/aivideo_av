import { apiRequest } from '../user/sessionClient';

export interface EpisodePlayback {
  url: string;
  title: string | null;
  episodeNumber: number;
  durationMs: number;
}

interface EpisodePlaybackResponse extends Omit<EpisodePlayback, 'url'> {
  url: string;
}

export async function getEpisodePlayback(episodeId: string): Promise<EpisodePlayback> {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be set to fetch episode playback.');
  }

  const playback = await apiRequest<EpisodePlaybackResponse>(`/episodes/${encodeURIComponent(episodeId)}/playback`, { auth: 'optional' });
  return {
    ...playback,
    url: new URL(playback.url, `${new URL(baseUrl).origin}/`).toString(),
  };
}
