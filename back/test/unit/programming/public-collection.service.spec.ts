import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { PublicCollectionService } from '../../../src/programming/public-collection.service.js';

const repository = () => ({ find: vi.fn(), findOne: vi.fn() });

describe('PublicCollectionService', () => {
  it('returns an active, scheduled collection in display order with public summaries', async () => {
    const collectionRepository = repository();
    const collectionDramaRepository = repository();
    const dramaRepository = repository();
    const productionCompanyRepository = repository();
    const dramaGenreRepository = repository();
    const genreRepository = repository();
    const dramaImageRepository = repository();
    const episodeRepository = repository();
    const publishedAt = new Date('2026-01-01T00:00:00.000Z');
    const now = Date.now();

    collectionRepository.findOne.mockResolvedValue({
      id: 'collection-1',
      code: 'HOME_FEATURED',
      title: '오늘의 추천',
      description: '지금 만나보세요',
      isActive: true,
    });
    collectionDramaRepository.find.mockResolvedValue([
      { collectionId: 'collection-1', dramaId: 'drama-2', displayOrder: 2, startsAt: null, endsAt: null },
      { collectionId: 'collection-1', dramaId: 'drama-1', displayOrder: 1, startsAt: new Date(now - 1000), endsAt: new Date(now + 1000) },
      { collectionId: 'collection-1', dramaId: 'drama-expired', displayOrder: 3, startsAt: null, endsAt: new Date(now - 1000) },
    ]);
    dramaRepository.find.mockResolvedValue([
      { id: 'drama-1', productionCompanyId: 'company-1', publicSlug: 'first', title: 'First', shortDescription: 'First short', status: 'PUBLISHED', publishedAt },
      { id: 'drama-2', productionCompanyId: 'company-1', publicSlug: 'second', title: 'Second', shortDescription: 'Second short', status: 'DRAFT', publishedAt },
    ]);
    productionCompanyRepository.find.mockResolvedValue([{ id: 'company-1', name: 'Studio' }]);
    dramaGenreRepository.find.mockResolvedValue([{ dramaId: 'drama-1', genreId: 1 }]);
    genreRepository.find.mockResolvedValue([{ id: 1, code: 'ROMANCE', name: '로맨스' }]);
    dramaImageRepository.find.mockResolvedValue([{ dramaId: 'drama-1', kind: 'POSTER', storageKey: 'poster.webp' }]);
    episodeRepository.find.mockResolvedValue([
      { dramaId: 'drama-1', status: 'PUBLISHED', publishedAt, pricePoints: 0 },
      { dramaId: 'drama-1', status: 'PUBLISHED', publishedAt, pricePoints: 10 },
      { dramaId: 'drama-1', status: 'HIDDEN', publishedAt, pricePoints: 0 },
    ]);

    const service = new PublicCollectionService(
      collectionRepository as never,
      collectionDramaRepository as never,
      dramaRepository as never,
      productionCompanyRepository as never,
      dramaGenreRepository as never,
      genreRepository as never,
      dramaImageRepository as never,
      episodeRepository as never,
    );

    await expect(service.getCollection('HOME_FEATURED')).resolves.toEqual({
      code: 'HOME_FEATURED',
      title: '오늘의 추천',
      description: '지금 만나보세요',
      dramas: [
        expect.objectContaining({
          displayOrder: 1,
          id: 'drama-1',
          publishedEpisodeCount: 2,
          freeEpisodeCount: 1,
          images: { POSTER: 'poster.webp', HERO: null, THUMBNAIL: null },
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
    );

    await expect(service.getCollection('UNKNOWN')).rejects.toBeInstanceOf(NotFoundException);
    expect(collectionRepository.findOne).toHaveBeenCalledWith({
      where: { code: 'UNKNOWN', isActive: true },
    });
  });
});
