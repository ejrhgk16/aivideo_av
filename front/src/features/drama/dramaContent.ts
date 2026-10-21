export interface DramaContent {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  synopsis: string;
  productionCompany: string | null;
  genres: Array<{ id: number; code: string; name: string }>;
  images: {
    poster: string | null;
    posterLandscape: string | null;
    homeHero: string | null;
    detailCover: string | null;
    campaigns: string[];
  };
  imageUrls: {
    poster: string | null;
    posterLandscape: string | null;
    homeHero: string | null;
    detailCover: string | null;
    campaigns: string[];
  };
  previewVideos: Array<{ storageKey: string; durationMs: number }>;
  episodes: Array<{
    id: string;
    episodeNumber: number;
    title: string | null;
    synopsis: string | null;
    durationMs: number;
    pricePoints: number;
    image: string | null;
  }>;
}

export interface DramaSummary {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  productionCompany: string | null;
  genres: Array<{ id: number; code: string; name: string }>;
  images: {
    poster: string | null;
    posterLandscape: string | null;
    homeHero: string | null;
    detailCover: string | null;
    campaigns: string[];
  };
  imageUrls: {
    poster: string | null;
    posterLandscape: string | null;
    homeHero: string | null;
    detailCover: string | null;
    campaigns: string[];
  };
  previewVideos: Array<{ storageKey: string; durationMs: number }>;
  episodeCount: number;
  freeEpisodeCount: number;
}

function joinApiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

export async function getDramaContent(dramaId: string): Promise<DramaContent> {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be set to fetch drama content.');
  }

  const response = await fetch(joinApiUrl(baseUrl, `dramas/${encodeURIComponent(dramaId)}`));
  if (!response.ok) {
    throw new Error(`Failed to fetch drama '${dramaId}': ${response.status}`);
  }

  return (await response.json()) as DramaContent;
}

export async function getDramaList(): Promise<DramaSummary[]> {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be set to fetch drama list.');
  }

  const response = await fetch(joinApiUrl(baseUrl, 'dramas?sort=latest'));
  if (!response.ok) {
    throw new Error(`Failed to fetch drama list: ${response.status}`);
  }

  return (await response.json()) as DramaSummary[];
}
