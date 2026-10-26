export interface PreviewPlayback {
  url: string;
  durationMs: number;
}

function joinApiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

export async function getPreviewPlayback(dramaId: string, videoId: string): Promise<PreviewPlayback> {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be set to fetch preview playback.');
  }

  const path = `dramas/${encodeURIComponent(dramaId)}/previews/${encodeURIComponent(videoId)}/playback`;
  const response = await fetch(joinApiUrl(baseUrl, path));
  if (!response.ok) {
    throw new Error(`Failed to fetch preview playback: ${response.status}`);
  }

  return (await response.json()) as PreviewPlayback;
}
