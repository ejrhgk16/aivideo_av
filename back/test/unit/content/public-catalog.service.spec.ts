import { PublicCatalogService } from '../../../src/content/public-catalog.service.js';
import { Drama } from '../../../src/content/entities/drama.entity.js';
import { DramaGenre } from '../../../src/content/entities/dramaGenre.entity.js';
import { DramaImage } from '../../../src/content/entities/dramaImage.entity.js';
import { Episode } from '../../../src/content/entities/episode.entity.js';
import { Genre } from '../../../src/content/entities/genre.entity.js';
import { ProductionCompany } from '../../../src/content/entities/productionCompany.entity.js';

type RepositoryMock = {
  find: ReturnType<typeof vi.fn>;
  findBy: ReturnType<typeof vi.fn>;
  createQueryBuilder?: ReturnType<typeof vi.fn>;
};

function repository(): RepositoryMock {
  return { find: vi.fn(), findBy: vi.fn() };
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
      Object.assign(new DramaImage(), { dramaId: 'drama-1', kind: 'POSTER', storageKey: 'poster.jpg' }),
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
      episodes as never,
    );

    await expect(service.listDramas('latest', now)).resolves.toEqual([
      expect.objectContaining({
        id: 'drama-1',
        slug: 'first-drama',
        productionCompany: '제작사',
        episodeCount: 2,
        freeEpisodeCount: 1,
        images: { poster: 'poster.jpg', hero: null, thumbnail: null },
      }),
    ]);
    expect(qb.where).toHaveBeenCalledWith('drama.status = :status', { status: 'PUBLISHED' });
    expect(qb.andWhere).toHaveBeenCalledWith('drama.publishedAt <= :now', { now });
    expect(qb.orderBy).toHaveBeenCalledWith('drama.publishedAt', 'DESC');
  });

  it('returns genres in display order', async () => {
    const genres = repository<Genre>();
    const rows = [Object.assign(new Genre(), { id: 1, code: 'MYSTERY', name: '미스터리', displayOrder: 1 })];
    genres.find.mockResolvedValue(rows);
    const service = new PublicCatalogService(
      repository() as never,
      repository() as never,
      repository() as never,
      genres as never,
      repository() as never,
      repository() as never,
    );

    await expect(service.listGenres()).resolves.toEqual([
      { id: 1, code: 'MYSTERY', name: '미스터리' },
    ]);
    expect(genres.find).toHaveBeenCalledWith({ order: { displayOrder: 'ASC' } });
  });
});
