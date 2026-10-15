import { PublicCatalogService } from '../../../src/content/public-catalog.service.js';
import { NotFoundException } from '@nestjs/common';
import { Drama } from '../../../src/content/entities/drama.entity.js';
import { DramaGenre } from '../../../src/content/entities/dramaGenre.entity.js';
import { ContentImage } from '../../../src/content/entities/contentImage.entity.js';
import { ContentVideo } from '../../../src/content/entities/contentVideo.entity.js';
import { Episode } from '../../../src/content/entities/episode.entity.js';
import { Genre } from '../../../src/content/entities/genre.entity.js';
import { ProductionCompany } from '../../../src/content/entities/productionCompany.entity.js';

type RepositoryMock = {
  find: ReturnType<typeof vi.fn>;
  findBy: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  createQueryBuilder?: ReturnType<typeof vi.fn>;
};

function repository(): RepositoryMock {
  return { find: vi.fn(), findBy: vi.fn(), findOne: vi.fn() };
}

function queryBuilder<T>(rows: T[]) {
  const builder = {
    where: vi.fn(),
    andWhere: vi.fn(),
    orderBy: vi.fn(),
    getMany: vi.fn().mockResolvedValue(rows),
  };
  builder.where.mockReturnValue(builder);
  builder.andWhere.mockReturnValue(builder);
  builder.orderBy.mockReturnValue(builder);
  return builder;
}

describe('PublicCatalogService', () => {
  it('returns published dramas ordered by latest publication with public episode counts', async () => {
    const now = new Date('2026-10-09T00:00:00.000Z');
    const drama = Object.assign(new Drama(), {
      id: 'drama-1',
      productionCompanyId: 'company-1',
      publicSlug: 'first-drama',
      title: '첫 작품',
      shortDescription: '짧은 소개',
      status: 'PUBLISHED',
      publishedAt: new Date('2026-10-08T00:00:00.000Z'),
    });
    const qb = queryBuilder([drama]);
    const dramas = repository();
    dramas.createQueryBuilder = vi.fn().mockReturnValue(qb);
    const companies = repository();
    companies.findBy.mockResolvedValue([Object.assign(new ProductionCompany(), { id: 'company-1', name: '제작사' })]);
    const dramaGenres = repository();
    dramaGenres.findBy.mockResolvedValue([Object.assign(new DramaGenre(), { dramaId: 'drama-1', genreId: 1 })]);
    const genres = repository();
    genres.find.mockResolvedValue([Object.assign(new Genre(), { id: 1, code: 'MYSTERY', name: '미스터리', displayOrder: 1 })]);
    const images = repository();
    images.findBy.mockResolvedValue([
      Object.assign(new ContentImage(), {
        contentType: 'DRAMA', contentId: 'drama-1', kind: 'POSTER', storageKey: 'poster.jpg', displayOrder: 1,
      }),
      Object.assign(new ContentImage(), {
        contentType: 'DRAMA', contentId: 'drama-1', kind: 'CAMPAIGN', storageKey: 'campaign-2.jpg', displayOrder: 2,
      }),
      Object.assign(new ContentImage(), {
        contentType: 'DRAMA', contentId: 'drama-1', kind: 'CAMPAIGN', storageKey: 'campaign-1.jpg', displayOrder: 1,
      }),
    ]);
    const videos = repository();
    videos.findBy.mockResolvedValue([
      Object.assign(new ContentVideo(), {
        contentType: 'DRAMA', contentId: 'drama-1', kind: 'PREVIEW', storageKey: 'preview-2.mp4', durationMs: 2000, displayOrder: 2,
      }),
      Object.assign(new ContentVideo(), {
        contentType: 'DRAMA', contentId: 'drama-1', kind: 'PREVIEW', storageKey: 'preview-1.mp4', durationMs: 1000, displayOrder: 1,
      }),
    ]);
    const episodes = repository();
    episodes.findBy.mockResolvedValue([
      Object.assign(new Episode(), { dramaId: 'drama-1', status: 'PUBLISHED', publishedAt: new Date('2026-10-01'), pricePoints: 0 }),
      Object.assign(new Episode(), { dramaId: 'drama-1', status: 'PUBLISHED', publishedAt: new Date('2026-10-02'), pricePoints: 10 }),
      Object.assign(new Episode(), { dramaId: 'drama-1', status: 'SCHEDULED', publishedAt: new Date('2026-10-10'), pricePoints: 0 }),
    ]);

    const service = new PublicCatalogService(
      dramas as never,
      companies as never,
      dramaGenres as never,
      genres as never,
      images as never,
      videos as never,
      episodes as never,
    );

    await expect(service.listDramas('latest', now)).resolves.toEqual([
      expect.objectContaining({
        id: 'drama-1',
        slug: 'first-drama',
        productionCompany: '제작사',
        episodeCount: 2,
        freeEpisodeCount: 1,
        images: {
          poster: 'poster.jpg', homeHero: null, detailCover: null,
          campaigns: ['campaign-1.jpg', 'campaign-2.jpg'],
        },
        previewVideos: [
          { storageKey: 'preview-1.mp4', durationMs: 1000 },
          { storageKey: 'preview-2.mp4', durationMs: 2000 },
        ],
      }),
    ]);
    expect(qb.where).toHaveBeenCalledWith('drama.status = :status', { status: 'PUBLISHED' });
    expect(qb.andWhere).toHaveBeenCalledWith('drama.publishedAt <= :now', { now });
    expect(qb.orderBy).toHaveBeenCalledWith('drama.publishedAt', 'DESC');
  });

  it('returns genres in display order', async () => {
    const genres = repository();
    const rows = [Object.assign(new Genre(), { id: 1, code: 'MYSTERY', name: '미스터리', displayOrder: 1 })];
    genres.find.mockResolvedValue(rows);
    const images = repository();
    images.findBy.mockResolvedValue([]);
    const service = new PublicCatalogService(
      repository() as never,
      repository() as never,
      repository() as never,
      genres as never,
      images as never,
      repository() as never,
      repository() as never,
    );

    await expect(service.listGenres()).resolves.toEqual([
      { id: 1, code: 'MYSTERY', name: '미스터리', tileImage: null },
    ]);
    expect(genres.find).toHaveBeenCalledWith({ order: { displayOrder: 'ASC' } });
  });

  it('returns a public drama detail with ordered public episodes and prices', async () => {
    const now = new Date('2026-10-09T00:00:00.000Z');
    const dramas = repository();
    dramas.findOne.mockResolvedValue(
      Object.assign(new Drama(), {
        id: 'drama-1',
        productionCompanyId: 'company-1',
        publicSlug: 'first-drama',
        title: '첫 작품',
        shortDescription: '짧은 소개',
        synopsis: '긴 줄거리',
        status: 'PUBLISHED',
        publishedAt: new Date('2026-10-08T00:00:00.000Z'),
      }),
    );
    const companies = repository();
    companies.findOne.mockResolvedValue(
      Object.assign(new ProductionCompany(), { id: 'company-1', name: '제작사' }),
    );
    const dramaGenres = repository();
    dramaGenres.findBy.mockResolvedValue([Object.assign(new DramaGenre(), { dramaId: 'drama-1', genreId: 1 })]);
    const genres = repository();
    genres.find.mockResolvedValue([Object.assign(new Genre(), { id: 1, code: 'MYSTERY', name: '미스터리' })]);
    const images = repository();
    images.findBy.mockResolvedValue([
      Object.assign(new ContentImage(), {
        contentType: 'DRAMA', contentId: 'drama-1', kind: 'POSTER', storageKey: 'poster.jpg', displayOrder: 1,
      }),
      Object.assign(new ContentImage(), {
        contentType: 'EPISODE', contentId: 'episode-1', kind: 'EPISODE_COVER', storageKey: 'episode-1.jpg', displayOrder: 1,
      }),
    ]);
    const videos = repository();
    videos.findBy.mockResolvedValue([]);
    const episodes = repository();
    episodes.findBy.mockResolvedValue([
      Object.assign(new Episode(), {
        id: 'episode-2',
        dramaId: 'drama-1',
        episodeNumber: 2,
        title: '2화',
        synopsis: '두 번째',
        durationMs: 120000,
        pricePoints: 10,
        status: 'PUBLISHED',
        publishedAt: new Date('2026-10-02'),
      }),
      Object.assign(new Episode(), {
        id: 'episode-hidden',
        dramaId: 'drama-1',
        episodeNumber: 3,
        title: '3화',
        synopsis: null,
        durationMs: 120000,
        pricePoints: 10,
        status: 'SCHEDULED',
        publishedAt: new Date('2026-10-10'),
      }),
      Object.assign(new Episode(), {
        id: 'episode-1',
        dramaId: 'drama-1',
        episodeNumber: 1,
        title: '1화',
        synopsis: '첫 번째',
        durationMs: 90000,
        pricePoints: 0,
        status: 'PUBLISHED',
        publishedAt: new Date('2026-10-01'),
      }),
    ]);

    const service = new PublicCatalogService(
      dramas as never,
      companies as never,
      dramaGenres as never,
      genres as never,
      images as never,
      videos as never,
      episodes as never,
    );

    await expect(service.getDrama('drama-1', now)).resolves.toEqual({
      id: 'drama-1',
      slug: 'first-drama',
      title: '첫 작품',
      shortDescription: '짧은 소개',
      synopsis: '긴 줄거리',
      productionCompany: '제작사',
      genres: [{ id: 1, code: 'MYSTERY', name: '미스터리' }],
      images: { poster: 'poster.jpg', homeHero: null, detailCover: null, campaigns: [] },
      previewVideos: [],
      episodes: [
        {
          id: 'episode-1',
          episodeNumber: 1,
          title: '1화',
          synopsis: '첫 번째',
          durationMs: 90000,
          pricePoints: 0,
          image: 'episode-1.jpg',
        },
        {
          id: 'episode-2',
          episodeNumber: 2,
          title: '2화',
          synopsis: '두 번째',
          durationMs: 120000,
          pricePoints: 10,
          image: null,
        },
      ],
    });
    expect(dramas.findOne).toHaveBeenCalledWith({ where: { id: 'drama-1', status: 'PUBLISHED' } });
  });

  it('rejects a missing, unpublished, or not-yet-published drama', async () => {
    const now = new Date('2026-10-09T00:00:00.000Z');
    const dramas = repository();
    const service = new PublicCatalogService(
      dramas as never,
      repository() as never,
      repository() as never,
      repository() as never,
      repository() as never,
      repository() as never,
      repository() as never,
    );

    dramas.findOne.mockResolvedValue(null);
    await expect(service.getDrama('missing', now)).rejects.toBeInstanceOf(NotFoundException);

    dramas.findOne.mockResolvedValue(
      Object.assign(new Drama(), {
        id: 'drama-1',
        status: 'DRAFT',
        publishedAt: new Date('2026-10-08T00:00:00.000Z'),
      }),
    );
    await expect(service.getDrama('drama-1', now)).rejects.toBeInstanceOf(NotFoundException);

    dramas.findOne.mockResolvedValue(
      Object.assign(new Drama(), {
        id: 'drama-1',
        status: 'PUBLISHED',
        publishedAt: new Date('2026-10-10T00:00:00.000Z'),
      }),
    );
    await expect(service.getDrama('drama-1', now)).rejects.toBeInstanceOf(NotFoundException);
  });
});
