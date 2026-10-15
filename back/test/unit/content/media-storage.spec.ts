import { resolve } from 'node:path';

import {
  createDramaImageStorageKey,
  createDramaPreviewStorageKey,
  createEpisodeImageStorageKey,
  createEpisodeSubtitleStorageKey,
  createEpisodeVideoStorageKey,
  createGenreImageStorageKey,
  getMediaStorageRoot,
  resolveMediaStoragePath,
} from '../../../src/content/media-storage.js';

describe('media storage', () => {
  const environment = { MEDIA_STORAGE_ROOT: 'local-media' };

  it('creates stable media storage keys', () => {
    expect(createDramaImageStorageKey('drama-1', 'image-1', 'POSTER')).toBe(
      'dramas/drama-1/images/poster/image-1.webp',
    );
    expect(createDramaImageStorageKey('drama-1', 'image-2', 'CAMPAIGN')).toBe(
      'dramas/drama-1/images/campaign/image-2.webp',
    );
    expect(createDramaPreviewStorageKey('drama-1', 'video-1')).toBe(
      'dramas/drama-1/preview/video-1.mp4',
    );
    expect(createEpisodeImageStorageKey('drama-1', 'episode-1', 'image-3')).toBe(
      'dramas/drama-1/episodes/episode-1/images/image-3.webp',
    );
    expect(createEpisodeVideoStorageKey('drama-1', 'episode-1', 'video-2')).toBe(
      'dramas/drama-1/episodes/episode-1/videos/video-2.mp4',
    );
    expect(createEpisodeSubtitleStorageKey('drama-1', 'episode-1', 'ko', 'VTT')).toBe(
      'dramas/drama-1/episodes/episode-1/subtitles/ko.vtt',
    );
    expect(createGenreImageStorageKey(1, 'image-4')).toBe('genres/1/images/image-4.webp');
  });

  it('resolves only paths below MEDIA_STORAGE_ROOT', () => {
    const root = getMediaStorageRoot(environment);

    expect(root).toBe(resolve(process.cwd(), 'local-media'));
    expect(resolveMediaStoragePath('dramas/drama-1/preview/video-1.mp4', environment)).toBe(
      resolve(root, 'dramas/drama-1/preview/video-1.mp4'),
    );
    expect(() => resolveMediaStoragePath('../outside.mp4', environment)).toThrow(
      'storageKey must resolve within MEDIA_STORAGE_ROOT.',
    );
  });

  it('requires MEDIA_STORAGE_ROOT', () => {
    expect(() => getMediaStorageRoot({})).toThrow('MEDIA_STORAGE_ROOT must be configured.');
  });
});
