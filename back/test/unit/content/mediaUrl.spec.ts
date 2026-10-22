import { describe, expect, it } from 'vitest';
import { createDramaImageUrls } from '../../../src/content/mediaUrl.js';

describe('createDramaImageUrls', () => {
  it('creates public S3 URLs while preserving the image storage keys', () => {
    expect(
      createDramaImageUrls(
        {
          poster: 'dramas/drama-1/images/poster/image-1.webp',
          posterLandscape: 'dramas/drama-1/images/poster-landscape/image-4.webp',
          homeHero: 'dramas/drama-1/images/home-hero/image-2.webp',
          detailCover: null,
          campaigns: ['dramas/drama-1/images/campaign/image-3.webp'],
        },
        { AWS_REGION: 'ap-northeast-2', S3_BUCKET: 'aivideo-dev' },
      ),
    ).toEqual({
      poster: 'https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/dramas/drama-1/images/poster/image-1.webp',
      posterLandscape: 'https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/dramas/drama-1/images/poster-landscape/image-4.webp',
      homeHero: 'https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/dramas/drama-1/images/home-hero/image-2.webp',
      detailCover: null,
      campaigns: ['https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/dramas/drama-1/images/campaign/image-3.webp'],
    });
  });

  it('returns null URLs when bucket configuration is missing', () => {
    expect(
      createDramaImageUrls(
        { poster: 'poster.webp', posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] },
        {},
      ),
    ).toEqual({ poster: null, posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] });
  });

  it('encodes each storage key segment', () => {
    expect(
      createDramaImageUrls(
        { poster: 'dramas/drama 1/images/poster/image 1.webp', posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] },
        { AWS_REGION: 'ap-northeast-2', S3_BUCKET: 'aivideo-dev' },
      ).poster,
    ).toBe('https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/dramas/drama%201/images/poster/image%201.webp');
  });
});

