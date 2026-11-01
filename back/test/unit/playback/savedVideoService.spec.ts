import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DataSource } from 'typeorm';
import { SavedVideoService } from '../../../src/playback/savedVideoService.js';

function listDataSource(rows: Array<{ videoUuid: string; contentType: 'EPISODE' | 'PREVIEW'; savedAt: Date }>) {
  const builder = {
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    getRawMany: vi.fn().mockResolvedValue(rows),
  };
  return { dataSource: { createQueryBuilder: vi.fn(() => builder) } as unknown as DataSource, builder };
}

describe('SavedVideoService', () => {
  const originalTimeZone = process.env.TZ;

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  });

  it('serializes database dates as ISO UTC and returns only the requested page fields', async () => {
    process.env.TZ = 'Asia/Seoul';
    const { dataSource, builder } = listDataSource([
      { videoUuid: 'a1b2c3d4-0000-4000-8000-000000000001', contentType: 'PREVIEW', savedAt: new Date('2026-11-01T00:00:00.000Z') },
    ]);
    const service = new SavedVideoService(dataSource);

    await expect(service.list('00000010-0000-4000-8000-000000000001', 1)).resolves.toEqual({
      items: [{ videoUuid: 'a1b2c3d4-0000-4000-8000-000000000001', contentType: 'PREVIEW', savedAt: '2026-11-01T00:00:00.000Z' }],
      page: 1,
      hasNext: false,
    });
    expect(builder.offset).toHaveBeenCalledWith(0);
    expect(builder.limit).toHaveBeenCalledWith(31);
  });

  it('preserves database read failures', async () => {
    const failure = new Error('database unavailable');
    const { dataSource, builder } = listDataSource([]);
    builder.getRawMany.mockRejectedValue(failure);
    const service = new SavedVideoService(dataSource);

    await expect(service.list('00000010-0000-4000-8000-000000000001', 1)).rejects.toBe(failure);
  });

  it('preserves database write failures', async () => {
    const failure = new Error('database unavailable');
    const builder = {
      from: vi.fn().mockReturnThis(), leftJoin: vi.fn().mockReturnThis(), innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(), getRawOne: vi.fn().mockResolvedValue({ userId: 1, videoId: 2 }),
      insert: vi.fn().mockReturnThis(), into: vi.fn().mockReturnThis(), values: vi.fn().mockReturnThis(),
      orUpdate: vi.fn().mockReturnThis(), execute: vi.fn().mockRejectedValue(failure),
    };
    const dataSource = {
      createQueryBuilder: vi.fn(() => builder),
    } as unknown as DataSource;
    const service = new SavedVideoService(dataSource);

    await expect(service.save('00000010-0000-4000-8000-000000000001', 'a1b2c3d4-0000-4000-8000-000000000001', 'PREVIEW'))
      .rejects.toBe(failure);
  });

  it('preserves database delete failures', async () => {
    const failure = new Error('database unavailable');
    const dataSource = {
      query: vi.fn().mockRejectedValue(failure),
    } as unknown as DataSource;
    const service = new SavedVideoService(dataSource);

    await expect(service.remove('00000010-0000-4000-8000-000000000001', 'a1b2c3d4-0000-4000-8000-000000000001'))
      .rejects.toBe(failure);
  });
});
