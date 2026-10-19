import { isAbsolute, relative, resolve, sep } from 'node:path';

export type DramaImageKind =
  | 'POSTER'
  | 'POSTER_LANDSCAPE'
  | 'HOME_HERO'
  | 'DETAIL_COVER'
  | 'CAMPAIGN';

const dramaImageDirectoryByKind: Record<DramaImageKind, string> = {
  POSTER: 'poster',
  POSTER_LANDSCAPE: 'poster-landscape',
  HOME_HERO: 'home-hero',
  DETAIL_COVER: 'detail-cover',
  CAMPAIGN: 'campaign',
};

export function createDramaImageStorageKey(
  dramaId: string,
  imageId: string,
  kind: DramaImageKind,
): string {
  return `dramas/${dramaId}/images/${dramaImageDirectoryByKind[kind]}/${imageId}.webp`;
}

export function createDramaPreviewStorageKey(dramaId: string, videoId: string): string {
  return `dramas/${dramaId}/preview/${videoId}.mp4`;
}

export function createEpisodeImageStorageKey(
  dramaId: string,
  episodeId: string,
  imageId: string,
): string {
  return `dramas/${dramaId}/episodes/${episodeId}/images/${imageId}.webp`;
}

export function createEpisodeVideoStorageKey(
  dramaId: string,
  episodeId: string,
  videoId: string,
): string {
  return `dramas/${dramaId}/episodes/${episodeId}/videos/${videoId}.mp4`;
}

export function createEpisodeSubtitleStorageKey(
  dramaId: string,
  episodeId: string,
  languageCode: string,
  format: string,
): string {
  return `dramas/${dramaId}/episodes/${episodeId}/subtitles/${languageCode}.${format.toLowerCase()}`;
}

export function createGenreImageStorageKey(genreId: number | string, imageId: string): string {
  return `genres/${genreId}/images/${imageId}.webp`;
}

export function getMediaStorageRoot(environment: NodeJS.ProcessEnv = process.env): string {
  const configuredRoot = environment.MEDIA_STORAGE_ROOT?.trim();

  if (!configuredRoot) {
    throw new Error('MEDIA_STORAGE_ROOT must be configured.');
  }

  return resolve(process.cwd(), configuredRoot);
}

export function resolveMediaStoragePath(
  storageKey: string,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const root = getMediaStorageRoot(environment);
  const mediaPath = resolve(root, storageKey);
  const rootRelativePath = relative(root, mediaPath);

  if (
    rootRelativePath === '' ||
    rootRelativePath === '..' ||
    rootRelativePath.startsWith(`..${sep}`) ||
    isAbsolute(rootRelativePath)
  ) {
    throw new Error('storageKey must resolve within MEDIA_STORAGE_ROOT.');
  }

  return mediaPath;
}
