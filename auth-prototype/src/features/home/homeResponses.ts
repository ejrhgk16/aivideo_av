export type HomeCollectionDrama = {
  displayOrder: number;
  uuid: string;
  slug: string;
  title: string;
  shortDescription: string;
  productionCompany: { uuid: string; name: string } | null;
  genres: Array<{ id: number; code: string; name: string }>;
  imageUrls: {
    poster: string | null;
    posterLandscape: string | null;
    homeHero: string | null;
    detailCover: string | null;
    campaigns: string[];
  };
  previewVideos: Array<{ uuid: string; storageKey: string; durationMs: number; isSaved: boolean }>;
  publishedEpisodeCount: number;
  freeEpisodeCount: number;
};

export type HomeCollection = {
  code: string;
  title: string;
  description: string | null;
  dramas: HomeCollectionDrama[];
};
