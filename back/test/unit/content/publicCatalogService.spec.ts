import { NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicCatalogService } from '../../../src/content/publicCatalogService.js';

const repository = () => ({
  find: vi.fn().mockResolvedValue([]),
  findBy: vi.fn().mockResolvedValue([]),
  findOne: vi.fn().mockResolvedValue(null),
});

describe('PublicCatalogService publication boundaries', () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    { status: 'DRAFT', publishedAt: new Date('2026-10-08T00:00:00Z') },
    { status: 'PUBLISHED', publishedAt: null },
    { status: 'PUBLISHED', publishedAt: new Date('2026-10-10T00:00:00Z') },
  ])('rejects a non-public detail: %j', async (drama) => {
    const dramas = repository();
    dramas.findOne.mockResolvedValue(drama);
    const service = new PublicCatalogService(
      dramas as never, repository() as never, repository() as never,
      repository() as never, repository() as never, repository() as never,
      repository() as never,
    );

    await expect(service.getDrama('non-public', new Date('2026-10-09T00:00:00Z')))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('excludes hidden, undated, and future episodes from public counts', async () => {
    const now = new Date('2026-10-09T00:00:00Z');
    const past = new Date('2026-10-08T00:00:00Z');
    const future = new Date('2026-10-10T00:00:00Z');
    const query = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([{ id: 1, uuid: 'public', productionCompanyId: 1 }]),
    };
    const dramas = { ...repository(), createQueryBuilder: vi.fn().mockReturnValue(query) };
    const episodes = repository();
    episodes.findBy.mockResolvedValue([
      { dramaId: 1, status: 'PUBLISHED', publishedAt: past, pricePoints: 0 },
      { dramaId: 1, status: 'PUBLISHED', publishedAt: now, pricePoints: 30 },
      { dramaId: 1, status: 'HIDDEN', publishedAt: past, pricePoints: 0 },
      { dramaId: 1, status: 'PUBLISHED', publishedAt: null, pricePoints: 0 },
      { dramaId: 1, status: 'PUBLISHED', publishedAt: future, pricePoints: 0 },
    ]);
    const service = new PublicCatalogService(
      dramas as never, repository() as never, repository() as never,
      repository() as never, repository() as never, repository() as never,
      episodes as never,
    );

    await expect(service.listDramas('latest', now)).resolves.toEqual([
      expect.objectContaining({ episodeCount: 2, freeEpisodeCount: 1 }),
    ]);
  });

  it.each([null, new Date('2999-01-01T00:00:00Z')])(
    'rejects preview playback before publication: %s',
    async (publishedAt) => {
      vi.stubEnv('NODE_ENV', 'development');
      const dramas = repository();
      dramas.findOne.mockResolvedValue({ status: 'PUBLISHED', publishedAt });
      const service = new PublicCatalogService(
        dramas as never, repository() as never, repository() as never,
        repository() as never, repository() as never, repository() as never,
        repository() as never,
      );

      await expect(service.getDramaPreviewPlaybackUrl('not-yet-public', 'preview'))
        .rejects.toBeInstanceOf(NotFoundException);
    },
  );

  it('blocks episode and preview playback outside development', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const dramas = repository();
    const service = new PublicCatalogService(
      dramas as never, repository() as never, repository() as never,
      repository() as never, repository() as never, repository() as never,
      repository() as never,
    );

    await expect(service.getEpisodePlaybackUrl('episode'))
      .rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getDramaPreviewPlaybackUrl('drama', 'preview'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(dramas.findOne).not.toHaveBeenCalled();
  });
});
