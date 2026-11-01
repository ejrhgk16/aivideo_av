import type { DramaImageUrls } from '../content/mediaUrl.js';

export type PublicPreviewVideoResponse = {
  uuid: string;
  storageKey: string;
  durationMs: number;
  isSaved: boolean;
};

export type PublicDramaSummaryResponse = {
  uuid: string;
  slug: string;
  title: string;
  shortDescription: string;
  productionCompany: { uuid: string; name: string } | null;
  genres: Array<{ id: number; code: string; name: string }>;
  imageUrls: DramaImageUrls;
  previewVideos: PublicPreviewVideoResponse[];
  publishedEpisodeCount: number;
  freeEpisodeCount: number;
};

export type PublicCollectionItemResponse = PublicDramaSummaryResponse & {
  displayOrder: number;
};

export type PublicCollectionResponse = {
  code: string;
  title: string;
  description: string | null;
  dramas: PublicCollectionItemResponse[];
};
