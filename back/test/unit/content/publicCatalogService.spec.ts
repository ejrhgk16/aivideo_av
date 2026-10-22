import { afterEach, beforeEach } from 'vitest';
import { PublicCatalogService } from '../../../src/content/publicCatalogService.js';
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

function episodePlaybackQueryBuilder() {
  const builder = {
    innerJoin: vi.fn(),
    select: vi.fn(),
    addSelect: vi.fn(),
    where: vi.fn(),
    andWhere: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    getRawOne: vi.fn(),
  };
  builder.innerJoin.mockReturnValue(builder);
  builder.select.mockReturnValue(builder);
  builder.addSelect.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.andWhere.mockReturnValue(builder);
  builder.orderBy.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  return builder;
}

describe('PublicCatalogService', () => {
  beforeEach(() => {
    vi.stubEnv('AWS_REGION', 'ap-northeast-2');
    vi.stubEnv('S3_BUCKET', 'aivideo-dev');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('returns published dramas ordered by latest publication with public episode counts', async () => {
    vi.stubEnv('NODE_ENV', 'development');
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
        contentType: 'DRAMA', contentId: 'drama-1', kind: 'POSTER', storageKey: 'dramas/drama-1/images/poster/image-1.webp', displayOrder: 1,
      }),
      Object.assign(new ContentImage(), {
        contentType: 'DRAMA', contentId: 'drama-1', kind: 'POSTER_LANDSCAPE', storageKey: 'dramas/drama-1/images/poster-landscape/image-4.webp', displayOrder: 1,
      }),
      Object.assign(new ContentImage(), {
        contentType: 'DRAMA', contentId: 'drama-1', kind: 'CAMPAIGN', storageKey: 'dramas/drama-1/images/campaign/image-2.webp', displayOrder: 2,
      }),
      Object.assign(new ContentImage(), {
        contentType: 'DRAMA', contentId: 'drama-1', kind: 'CAMPAIGN', storageKey: 'dramas/drama-1/images/campaign/image-1.webp', displayOrder: 1,
      }),
    ]);
    const videos = repository();
    videos.findBy.mockResolvedValue([
      Object.assign(new ContentVideo(), {
        id: 'preview-2', contentType: 'DRAMA', contentId: 'drama-1', kind: 'PREVIEW', storageKey: 'preview-2.mp4', durationMs: 2000, displayOrder: 2,
      }),
      Object.assign(new ContentVideo(), {
        id: 'preview-1', contentType: 'DRAMA', contentId: 'drama-1', kind: 'PREVIEW', storageKey: 'preview-1.mp4', durationMs: 1000, displayOrder: 1,
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
          poster: 'dramas/drama-1/images/poster/image-1.webp', posterLandscape: 'dramas/drama-1/images/poster-landscape/image-4.webp', homeHero: null, detailCover: null,
          campaigns: ['dramas/drama-1/images/campaign/image-1.webp', 'dramas/drama-1/images/campaign/image-2.webp'],
        },
        imageUrls: {
          poster: 'https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/dramas/drama-1/images/poster/image-1.webp',
          posterLandscape: 'https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/dramas/drama-1/images/poster-landscape/image-4.webp',
          homeHero: null,
          detailCover: null,
          campaigns: ['https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/dramas/drama-1/images/campaign/image-1.webp', 'https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/dramas/drama-1/images/campaign/image-2.webp'],
        },
        previewVideos: [
        { id: 'preview-1', storageKey: 'preview-1.mp4', durationMs: 1000 },
          { id: 'preview-2', storageKey: 'preview-2.mp4', durationMs: 2000 },
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

  it('returns the development playback URL for the first full episode video', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const now = new Date('2026-10-09T00:00:00.000Z');
    const dramas = repository();
    const episodes = repository();
    const qb = episodePlaybackQueryBuilder();
    episodes.createQueryBuilder = vi.fn().mockReturnValue(qb);
    qb.getRawOne.mockResolvedValue({
      storageKey: 'first.mp4', title: '첫 번째 이야기', episodeNumber: 1, durationMs: 1000,
    });
    const videos = repository();
    const s3 = { createSignedGetUrl: vi.fn().mockResolvedValue('https://s3.example/full') };
    const service = new PublicCatalogService(
      dramas as never, repository() as never, repository() as never, repository() as never,
      repository() as never, videos as never, episodes as never, s3 as never,
    );

    await expect(service.getEpisodePlaybackUrl('episode-1', now)).resolves.toEqual({
      url: 'https://s3.example/full',
      title: '첫 번째 이야기',
      episodeNumber: 1,
      durationMs: 1000,
    });
    expect(s3.createSignedGetUrl).toHaveBeenCalledWith('first.mp4');
    expect(episodes.createQueryBuilder).toHaveBeenCalledWith('episode');
    expect(qb.innerJoin).toHaveBeenNthCalledWith(1, Drama, 'drama', expect.stringContaining('drama.id = episode.dramaId AND drama.status = :dramaStatus AND drama.publishedAt <= :now'), {
      dramaStatus: 'PUBLISHED', now,
    });
    expect(qb.innerJoin).toHaveBeenNthCalledWith(2, ContentVideo, 'video', expect.stringContaining('video.contentType = :contentType AND video.contentId = episode.id AND video.kind = :kind'), {
      contentType: 'EPISODE', kind: 'FULL',
    });
    expect(qb.where).toHaveBeenCalledWith('episode.id = :episodeId', { episodeId: 'episode-1' });
    expect(qb.andWhere).toHaveBeenCalledWith('episode.status = :episodeStatus', { episodeStatus: 'PUBLISHED' });
    expect(qb.andWhere).toHaveBeenCalledWith('episode.publishedAt <= :now', { now });
    expect(qb.orderBy).toHaveBeenCalledWith('video.displayOrder', 'ASC');
    expect(qb.limit).toHaveBeenCalledWith(1);
    expect(qb.getRawOne).toHaveBeenCalledTimes(1);
    expect(dramas.findOne).not.toHaveBeenCalled();
    expect(videos.findBy).not.toHaveBeenCalled();
  });

  it('rejects missing or unpublished playback content and episodes without a full video', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const now = new Date('2026-10-09T00:00:00.000Z');
    const dramas = repository();
    const episodes = repository();
    const qb = episodePlaybackQueryBuilder();
    episodes.createQueryBuilder = vi.fn().mockReturnValue(qb);
    qb.getRawOne.mockResolvedValue(null);
    const videos = repository();
    const service = new PublicCatalogService(
      dramas as never, repository() as never, repository() as never, repository() as never,
      repository() as never, videos as never, episodes as never,
    );

    await expect(service.getEpisodePlaybackUrl('missing', now)).rejects.toBeInstanceOf(NotFoundException);

    await expect(service.getEpisodePlaybackUrl('episode-1', now)).rejects.toBeInstanceOf(NotFoundException);

    await expect(service.getEpisodePlaybackUrl('episode-1', now)).rejects.toBeInstanceOf(NotFoundException);
    expect(qb.getRawOne).toHaveBeenCalledTimes(3);
    expect(dramas.findOne).not.toHaveBeenCalled();
    expect(videos.findBy).not.toHaveBeenCalled();
  });

  it('does not issue local playback URLs outside development', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const service = new PublicCatalogService(
      repository() as never, repository() as never, repository() as never, repository() as never,
      repository() as never, repository() as never, repository() as never,
    );

    await expect(service.getEpisodePlaybackUrl('episode-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns an S3 playback URL for a published drama preview', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const dramas = repository();
    dramas.findOne.mockResolvedValue(Object.assign(new Drama(), {
      id: 'drama-1', status: 'PUBLISHED', publishedAt: new Date('2026-01-01T00:00:00Z'),
    }));
    const videos = repository();
    videos.findOne.mockResolvedValue(Object.assign(new ContentVideo(), {
      id: 'preview-1', contentType: 'DRAMA', contentId: 'drama-1', kind: 'PREVIEW',
      storageKey: 'dramas/drama-1/preview/preview-1.mp4', durationMs: 30000,
    }));
    const s3 = { createSignedGetUrl: vi.fn().mockResolvedValue('https://s3.example/preview') };
    const service = new PublicCatalogService(
      dramas as never, repository() as never, repository() as never, repository() as never,
      repository() as never, videos as never, repository() as never, s3 as never,
    );

    await expect(service.getDramaPreviewPlaybackUrl('drama-1', 'preview-1')).resolves.toEqual({
      url: 'https://s3.example/preview', durationMs: 30000,
    });
    expect(videos.findOne).toHaveBeenCalledWith({
      where: { id: 'preview-1', contentType: 'DRAMA', contentId: 'drama-1', kind: 'PREVIEW' },
    });
    expect(s3.createSignedGetUrl).toHaveBeenCalledWith('dramas/drama-1/preview/preview-1.mp4');
  });

  it('rejects missing, unpublished, mismatched, and non-development previews', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const dramas = repository();
    const videos = repository();
    const service = new PublicCatalogService(
      dramas as never, repository() as never, repository() as never, repository() as never,
      repository() as never, videos as never, repository() as never,
    );

    dramas.findOne.mockResolvedValue(null);
    await expect(service.getDramaPreviewPlaybackUrl('missing', 'preview-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(videos.findOne).not.toHaveBeenCalled();

    dramas.findOne.mockResolvedValue(Object.assign(new Drama(), {
      id: 'drama-1', status: 'PUBLISHED', publishedAt: new Date(Date.now() + 60_000),
    }));
    await expect(service.getDramaPreviewPlaybackUrl('drama-1', 'preview-1')).rejects.toBeInstanceOf(NotFoundException);

    dramas.findOne.mockResolvedValue(Object.assign(new Drama(), {
      id: 'drama-1', status: 'PUBLISHED', publishedAt: new Date('2026-01-01T00:00:00Z'),
    }));
    videos.findOne.mockResolvedValue(null);
    await expect(service.getDramaPreviewPlaybackUrl('drama-1', 'wrong-kind')).rejects.toBeInstanceOf(NotFoundException);

    vi.stubEnv('NODE_ENV', 'production');
    await expect(service.getDramaPreviewPlaybackUrl('drama-1', 'preview-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(videos.findOne).toHaveBeenCalledTimes(1);
  });

  it('returns a public drama detail with ordered public episodes and prices', async () => {
    vi.stubEnv('NODE_ENV', 'development');
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
        contentType: 'DRAMA', contentId: 'drama-1', kind: 'POSTER', storageKey: 'dramas/drama-1/images/poster/image-1.webp', displayOrder: 1,
      }),
      Object.assign(new ContentImage(), {
        contentType: 'DRAMA', contentId: 'drama-1', kind: 'POSTER_LANDSCAPE', storageKey: 'dramas/drama-1/images/poster-landscape/image-4.webp', displayOrder: 1,
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
      images: { poster: 'dramas/drama-1/images/poster/image-1.webp', posterLandscape: 'dramas/drama-1/images/poster-landscape/image-4.webp', homeHero: null, detailCover: null, campaigns: [] },
      imageUrls: { poster: 'https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/dramas/drama-1/images/poster/image-1.webp', posterLandscape: 'https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/dramas/drama-1/images/poster-landscape/image-4.webp', homeHero: null, detailCover: null, campaigns: [] },
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
