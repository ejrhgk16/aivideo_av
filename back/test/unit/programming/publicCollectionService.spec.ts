import { NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicCollectionService } from '../../../src/programming/publicCollectionService.js';

const repository = () => ({ find: vi.fn(), findOne: vi.fn() });

describe('PublicCollectionService', () => {
  beforeEach(() => {
    vi.stubEnv('AWS_REGION', 'ap-northeast-2');
    vi.stubEnv('S3_BUCKET', 'aivideo-dev');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('returns an active, scheduled collection in display order with public summaries', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const collectionRepository = repository();
    const collectionDramaRepository = repository();
    const dramaRepository = repository();
    const productionCompanyRepository = repository();
    const dramaGenreRepository = repository();
    const genreRepository = repository();
    const contentImageRepository = repository();
    const contentVideoRepository = repository();
    const episodeRepository = repository();
    const publishedAt = new Date('2026-01-01T00:00:00.000Z');
    const now = Date.now();

    collectionRepository.findOne.mockResolvedValue({
      id: 100,
      uuid: '00000000-0000-4000-8000-000000000100',
      code: 'HOME_FEATURED',
      title: '오늘의 추천',
      description: '지금 만나보세요',
      isActive: true,
    });
    collectionDramaRepository.find.mockResolvedValue([
      { collectionId: 100, dramaId: 2, displayOrder: 2, startsAt: null, endsAt: null },
      { collectionId: 100, dramaId: 1, displayOrder: 1, startsAt: new Date(now - 1000), endsAt: new Date(now + 1000) },
      { collectionId: 100, dramaId: 3, displayOrder: 3, startsAt: null, endsAt: new Date(now - 1000) },
    ]);
    dramaRepository.find.mockResolvedValue([
      { id: 1, uuid: '00000000-0000-4000-8000-000000000001', productionCompanyId: 10, publicSlug: 'first', title: 'First', shortDescription: 'First short', status: 'PUBLISHED', publishedAt },
      { id: 2, uuid: '00000000-0000-4000-8000-000000000002', productionCompanyId: 10, publicSlug: 'second', title: 'Second', shortDescription: 'Second short', status: 'DRAFT', publishedAt },
    ]);
    productionCompanyRepository.find.mockResolvedValue([{ id: 10, uuid: '00000000-0000-4000-8000-000000000010', name: 'Studio' }]);
    dramaGenreRepository.find.mockResolvedValue([{ dramaId: 1, genreId: 1 }]);
    genreRepository.find.mockResolvedValue([{ id: 1, code: 'ROMANCE', name: '로맨스' }]);
    contentImageRepository.find.mockResolvedValue([
      { contentType: 'DRAMA', contentId: 1, kind: 'POSTER', storageKey: 'dramas/drama-1/images/poster/image-1.webp', displayOrder: 1 },
      { contentType: 'DRAMA', contentId: 1, kind: 'POSTER_LANDSCAPE', storageKey: 'dramas/drama-1/images/poster-landscape/image-4.webp', displayOrder: 1 },
      { contentType: 'DRAMA', contentId: 1, kind: 'HOME_HERO', storageKey: 'dramas/drama-1/images/home-hero/image-1.webp', displayOrder: 1 },
      { contentType: 'DRAMA', contentId: 1, kind: 'CAMPAIGN', storageKey: 'dramas/drama-1/images/campaign/image-2.webp', displayOrder: 2 },
      { contentType: 'DRAMA', contentId: 1, kind: 'CAMPAIGN', storageKey: 'dramas/drama-1/images/campaign/image-1.webp', displayOrder: 1 },
    ]);
    contentVideoRepository.find.mockResolvedValue([
      { id: 21, uuid: '00000000-0000-4000-8000-000000000021', contentType: 'DRAMA', contentId: 1, kind: 'PREVIEW', storageKey: 'preview-2.mp4', durationMs: 20000, displayOrder: 2 },
      { id: 20, uuid: '00000000-0000-4000-8000-000000000020', contentType: 'DRAMA', contentId: 1, kind: 'PREVIEW', storageKey: 'preview-1.mp4', durationMs: 15000, displayOrder: 1 },
    ]);
    episodeRepository.find.mockResolvedValue([
      { dramaId: 1, status: 'PUBLISHED', publishedAt, pricePoints: 0 },
      { dramaId: 1, status: 'PUBLISHED', publishedAt, pricePoints: 10 },
      { dramaId: 1, status: 'HIDDEN', publishedAt, pricePoints: 0 },
    ]);

    const service = new PublicCollectionService(
      collectionRepository as never,
      collectionDramaRepository as never,
      dramaRepository as never,
      productionCompanyRepository as never,
      dramaGenreRepository as never,
      genreRepository as never,
      contentImageRepository as never,
      contentVideoRepository as never,
      episodeRepository as never,
    );

    await expect(service.getCollection('HOME_FEATURED')).resolves.toEqual({
      code: 'HOME_FEATURED',
      title: '오늘의 추천',
      description: '지금 만나보세요',
      dramas: [
        expect.objectContaining({
          displayOrder: 1,
          uuid: '00000000-0000-4000-8000-000000000001',
          slug: 'first',
          title: 'First',
          shortDescription: 'First short',
          productionCompany: { uuid: '00000000-0000-4000-8000-000000000010', name: 'Studio' },
          genres: [{ id: 1, code: 'ROMANCE', name: '로맨스' }],
          publishedEpisodeCount: 2,
          freeEpisodeCount: 1,
          imageUrls: {
            poster: 'https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/dramas/drama-1/images/poster/image-1.webp',
            posterLandscape: 'https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/dramas/drama-1/images/poster-landscape/image-4.webp',
            homeHero: 'https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/dramas/drama-1/images/home-hero/image-1.webp',
            detailCover: null,
            campaigns: ['https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/dramas/drama-1/images/campaign/image-1.webp', 'https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/dramas/drama-1/images/campaign/image-2.webp'],
          },
          previewVideos: [
            { uuid: '00000000-0000-4000-8000-000000000020', storageKey: 'preview-1.mp4', durationMs: 15000 },
            { uuid: '00000000-0000-4000-8000-000000000021', storageKey: 'preview-2.mp4', durationMs: 20000 },
          ],
        }),
      ],
    });
  });

  it('rejects a missing or inactive collection', async () => {
    const collectionRepository = repository();
    collectionRepository.findOne.mockResolvedValue(null);
    const service = new PublicCollectionService(
      collectionRepository as never,
      repository() as never,
      repository() as never,
      repository() as never,
      repository() as never,
      repository() as never,
      repository() as never,
      repository() as never,
      repository() as never,
    );

    await expect(service.getCollection('UNKNOWN')).rejects.toBeInstanceOf(NotFoundException);
    expect(collectionRepository.findOne).toHaveBeenCalledWith({
      where: { code: 'UNKNOWN', isActive: true },
    });
  });
});
