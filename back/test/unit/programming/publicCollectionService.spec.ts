import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicCollectionService } from '../../../src/programming/publicCollectionService.js';

const repository = () => ({
  find: vi.fn().mockResolvedValue([]),
  findOne: vi.fn().mockResolvedValue(null),
});

describe('PublicCollectionService scheduling boundaries', () => {
  afterEach(() => vi.useRealTimers());

  it('excludes non-public dramas and items outside their display window', async () => {
    const now = new Date('2026-10-09T00:00:00Z');
    const past = new Date('2026-10-08T00:00:00Z');
    const future = new Date('2026-10-10T00:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const collections = repository();
    collections.findOne.mockResolvedValue({ id: 1, code: 'HOME_FEATURED', title: 'Home', description: null });
    const items = repository();
    items.find.mockResolvedValue([
      { dramaId: 1, displayOrder: 1, startsAt: null, endsAt: null },
      { dramaId: 2, displayOrder: 2, startsAt: null, endsAt: null },
      { dramaId: 3, displayOrder: 3, startsAt: null, endsAt: null },
      { dramaId: 4, displayOrder: 4, startsAt: null, endsAt: null },
      { dramaId: 5, displayOrder: 5, startsAt: future, endsAt: null },
      { dramaId: 6, displayOrder: 6, startsAt: null, endsAt: past },
      { dramaId: 7, displayOrder: 7, startsAt: null, endsAt: now },
      { dramaId: 8, displayOrder: 8, startsAt: now, endsAt: future },
    ]);
    const dramas = repository();
    dramas.find.mockResolvedValue(
      Array.from({ length: 8 }, (_, index) => ({
        id: index + 1, uuid: 'drama-' + (index + 1), productionCompanyId: 1,
        status: index === 1 ? 'DRAFT' : 'PUBLISHED',
        publishedAt: index === 2 ? future : index === 3 ? null : past,
      })),
    );
    const episodes = repository();
    episodes.find.mockResolvedValue([
      { dramaId: 1, status: 'PUBLISHED', publishedAt: now, pricePoints: 0 },
      { dramaId: 1, status: 'HIDDEN', publishedAt: past, pricePoints: 0 },
      { dramaId: 1, status: 'PUBLISHED', publishedAt: future, pricePoints: 0 },
      { dramaId: 1, status: 'PUBLISHED', publishedAt: null, pricePoints: 0 },
    ]);
    const service = new PublicCollectionService(
      collections as never, items as never, dramas as never,
      repository() as never, repository() as never, repository() as never,
      repository() as never, repository() as never, episodes as never,
    );

    const response = await service.getCollection('HOME_FEATURED');

    expect(response.dramas.map(drama => drama.uuid)).toEqual(['drama-1', 'drama-8']);
    expect(response.dramas[0]).toMatchObject({ publishedEpisodeCount: 1, freeEpisodeCount: 1 });
  });
});
