import { describe, expect, it } from 'vitest';
import { createDramaImageUrls, createEpisodePlaybackUrl } from '../../../src/content/media-url.js';

describe('createDramaImageUrls', () => {
  it('creates development URLs matching the local image endpoint', () => {
    expect(
      createDramaImageUrls(
        {
          poster: 'dramas/drama-1/images/poster/image-1.webp',
          posterLandscape: 'dramas/drama-1/images/poster-landscape/image-4.webp',
          homeHero: 'dramas/drama-1/images/home-hero/image-2.webp',
          detailCover: null,
          campaigns: ['dramas/drama-1/images/campaign/image-3.webp'],
        },
        { NODE_ENV: 'development' },
      ),
    ).toEqual({
      poster: '/media/images/dramas/drama-1/images/poster/image-1.webp',
      posterLandscape: '/media/images/dramas/drama-1/images/poster-landscape/image-4.webp',
      homeHero: '/media/images/dramas/drama-1/images/home-hero/image-2.webp',
      detailCover: null,
      campaigns: ['/media/images/dramas/drama-1/images/campaign/image-3.webp'],
    });
  });

  it('does not expose local URLs outside development', () => {
    expect(
      createDramaImageUrls(
        { poster: 'poster.webp', posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] },
        { NODE_ENV: 'production' },
      ),
    ).toEqual({ poster: null, posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] });
  });
});

describe('createEpisodePlaybackUrl', () => {
  it('creates a local URL for development', () => {
    expect(createEpisodePlaybackUrl('episode-1', { NODE_ENV: 'development' })).toBe(
      '/media/videos/episodes/episode-1',
    );
  });

  it('does not expose a local URL outside development', () => {
    expect(createEpisodePlaybackUrl('episode-1', { NODE_ENV: 'production' })).toBeNull();
  });
});
