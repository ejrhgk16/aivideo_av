export interface EpisodePlayback {
  url: string;
  title: string | null;
  episodeNumber: number;
  durationMs: number;
}

interface EpisodePlaybackResponse extends Omit<EpisodePlayback, 'url'> {
  url: string;
}

function joinApiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

export async function getEpisodePlayback(episodeId: string): Promise<EpisodePlayback> {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be set to fetch episode playback.');
  }

  const response = await fetch(joinApiUrl(baseUrl, `episodes/${encodeURIComponent(episodeId)}/playback`));
  if (!response.ok) {
    throw new Error(`Failed to fetch playback for episode '${episodeId}': ${response.status}`);
  }

  const playback = (await response.json()) as EpisodePlaybackResponse;
  return {
    ...playback,
    url: new URL(playback.url, `${new URL(baseUrl).origin}/`).toString(),
  };
}
