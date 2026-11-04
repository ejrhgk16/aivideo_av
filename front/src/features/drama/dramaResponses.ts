export type DramaContent = {
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
  previewVideos: Array<{ uuid: string; storageKey: string; durationMs: number; isSaved: boolean }>;
  episodes: Array<{
    uuid: string;
    episodeNumber: number;
    title: string | null;
    synopsis: string | null;
    durationMs: number;
    videoUuid: string | null;
    isSaved: boolean;
    pricePoints: number;
    isUnlocked: boolean;
    image: string | null;
    watchProgress: {
      positionMs: number;
      isCompleted: boolean;
      lastPlayedAt: string;
    } | null;
  }>;
};

export type DramaSummary = {
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
  previewVideos: Array<{ uuid: string; storageKey: string; durationMs: number; isSaved: boolean }>;
  episodeCount: number;
  freeEpisodeCount: number;
};

export type DramaListParams = {
  page?: number;
  q?: string;
  genre?: string;
};

export type DramaListPage = {
  items: DramaSummary[];
  page: number;
  hasNext: boolean;
};

export type GenreSummary = {
  id: number;
  code: string;
  name: string;
  tileImage: string | null;
};
