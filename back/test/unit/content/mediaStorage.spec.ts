import {
  createDramaImageStorageKey,
  createDramaPreviewStorageKey,
  createEpisodeImageStorageKey,
  createEpisodeSubtitleStorageKey,
  createEpisodeVideoStorageKey,
  createGenreImageStorageKey,
} from '../../../src/content/mediaStorage.js';

describe('media storage', () => {
  it('creates stable media storage keys', () => {
    expect(createDramaImageStorageKey('drama-1', 'image-1', 'POSTER')).toBe(
      'dramas/drama-1/images/poster/image-1.webp',
    );
    expect(createDramaImageStorageKey('drama-1', 'image-5', 'POSTER_LANDSCAPE')).toBe(
      'dramas/drama-1/images/poster-landscape/image-5.webp',
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

});
