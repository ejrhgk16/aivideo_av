import type { DramaImageUrls } from './mediaUrl.js';
import type { PageResponse } from '../common/pagination/paginationResponses.js';

export type DramaGenreResponse = {
  id: number;
  code: string;
  name: string;
};

export type GenreResponse = DramaGenreResponse & {
  tileImage: string | null;
};

export type DramaPreviewVideoResponse = {
  uuid: string;
  storageKey: string;
  durationMs: number;
  isSaved: boolean;
};

export type DramaSummaryResponse = {
  uuid: string;
  slug: string;
  title: string;
  shortDescription: string;
  productionCompany: string | null;
  genres: DramaGenreResponse[];
  imageUrls: DramaImageUrls;
  previewVideos: DramaPreviewVideoResponse[];
  episodeCount: number;
  freeEpisodeCount: number;
};

export type DramaPageResponse = PageResponse<DramaSummaryResponse>;

export type DramaWatchProgressResponse = {
  positionMs: number;
  isCompleted: boolean;
  lastPlayedAt: string;
};

export type DramaEpisodeResponse = {
  uuid: string;
  episodeNumber: number;
  title: string | null;
  synopsis: string | null;
  durationMs: number;
  pricePoints: number;
  image: string | null;
  isUnlocked: boolean;
  videoUuid: string | null;
  isSaved: boolean;
  watchProgress: DramaWatchProgressResponse | null;
};

export type DramaDetailResponse = {
  uuid: string;
  slug: string;
  title: string;
  shortDescription: string;
  synopsis: string;
  productionCompany: string | null;
  genres: DramaGenreResponse[];
  imageUrls: DramaImageUrls;
  previewVideos: DramaPreviewVideoResponse[];
  episodes: DramaEpisodeResponse[];
};

export type EpisodePlaybackResponse = {
  url: string;
  videoUuid: string;
  isSaved: boolean;
  title: string | null;
  episodeNumber: number;
  durationMs: number;
};

export type PreviewPlaybackResponse = {
  url: string;
  videoUuid: string;
  isSaved: boolean;
  durationMs: number;
};
