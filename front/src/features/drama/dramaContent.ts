import { apiRequest } from '../user/sessionClient';

export interface DramaContent {
  uuid: string;
  slug: string;
  title: string;
  shortDescription: string;
  synopsis: string;
  productionCompany: string | null;
  genres: Array<{ id: number; code: string; name: string }>;
  imageUrls: {
    poster: string | null;
    posterLandscape: string | null;
    homeHero: string | null;
    detailCover: string | null;
    campaigns: string[];
  };
  previewVideos: Array<{ uuid: string; storageKey: string; durationMs: number }>;
  episodes: Array<{
    uuid: string;
    episodeNumber: number;
    title: string | null;
    synopsis: string | null;
    durationMs: number;
    pricePoints: number;
    isUnlocked: boolean;
    image: string | null;
    watchProgress: {
      positionMs: number;
      isCompleted: boolean;
      lastPlayedAt: string;
    } | null;
  }>;
}

export interface DramaSummary {
  uuid: string;
  slug: string;
  title: string;
  shortDescription: string;
  productionCompany: string | null;
  genres: Array<{ id: number; code: string; name: string }>;
  imageUrls: {
    poster: string | null;
    posterLandscape: string | null;
    homeHero: string | null;
    detailCover: string | null;
    campaigns: string[];
  };
  previewVideos: Array<{ uuid: string; storageKey: string; durationMs: number }>;
  episodeCount: number;
  freeEpisodeCount: number;
}

export function getDramaContent(dramaId: string): Promise<DramaContent> {
  return apiRequest<DramaContent>(`/dramas/${encodeURIComponent(dramaId)}`, { auth: 'optional' });
}

export function getDramaList(): Promise<DramaSummary[]> {
  return apiRequest<DramaSummary[]>('/dramas?sort=latest', { auth: 'public' });
}
