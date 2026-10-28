import { NotFoundException } from '@nestjs/common';
import { EpisodeAccessDeniedException, InvalidTokenException } from '../../../src/common/error/error.customExceptions.js';
import { PublicCatalogController } from '../../../src/content/publicCatalogController.js';
import { OptionalJwtAuthGuard } from '../../../src/identity/optionalJwtAuthGuard.js';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicCatalogService } from '../../../src/content/publicCatalogService.js';
import { UserWatchProgress } from '../../../src/playback/entities/userWatchProgress.entity.js';

const repository = () => ({
  find: vi.fn().mockResolvedValue([]),
  findBy: vi.fn().mockResolvedValue([]),
  findOne: vi.fn().mockResolvedValue(null),
  findOneBy: vi.fn().mockResolvedValue(null),
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

  it('queries public detail episodes in database order and joins only the requested user entitlement', async () => {
    const now = new Date('2026-10-09T00:00:00Z');
    const user = { id: 4, uuid: 'user-uuid' };
    const query = {
      leftJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getRawMany: vi.fn().mockResolvedValue([
        {
          id: 12,
          uuid: 'episode-uuid',
          episodeNumber: 2,
          title: 'Episode',
          synopsis: null,
          durationMs: 1000,
          pricePoints: 20,
          unlocked: '1',
          progressEpisodeId: null,
          positionMs: null,
          isCompleted: null,
          lastPlayedAt: null,
        },
      ]),
    };
    const drama = {
      id: 7,
      uuid: 'drama-uuid',
      status: 'PUBLISHED',
      publishedAt: new Date('2026-10-08T00:00:00Z'),
      productionCompanyId: 1,
      publicSlug: 'drama',
      title: 'Drama',
      shortDescription: 'Description',
      synopsis: 'Synopsis',
    };
    const dramas = repository();
    dramas.findOne.mockResolvedValue(drama);
    const episodes = {
      ...repository(),
      createQueryBuilder: vi.fn().mockReturnValue(query),
    };
    const users = repository();
    users.findOneBy.mockResolvedValue(user);
    const images = repository();
    const service = new PublicCatalogService(
      dramas as never, repository() as never, repository() as never,
      repository() as never, images as never, repository() as never,
      episodes as never, users as never,
    );

    const detail = await service.getDrama('drama-uuid', now, user.uuid);

    expect(users.findOneBy).toHaveBeenCalledWith({ uuid: user.uuid });
    expect(query.leftJoin).toHaveBeenCalledWith(
      expect.any(Function),
      'entitlement',
      'entitlement.episodeId = episode.id AND entitlement.userId = :userId',
      { userId: user.id },
    );
    expect(query.leftJoin).toHaveBeenCalledWith(
      UserWatchProgress,
      'progress',
      'progress.episodeId = episode.id AND progress.userId = :userId',
      { userId: user.id },
    );
    expect(query.where).toHaveBeenCalledWith('episode.dramaId = :dramaId', { dramaId: drama.id });
    expect(query.andWhere).toHaveBeenCalledWith('episode.status = :status', { status: 'PUBLISHED' });
    expect(query.andWhere).toHaveBeenCalledWith('episode.publishedAt <= :now', { now });
    expect(query.orderBy).toHaveBeenCalledWith('episode.episodeNumber', 'ASC');
    expect(episodes.findBy).not.toHaveBeenCalled();
    expect(detail.episodes).toEqual([
      expect.objectContaining({
        uuid: 'episode-uuid',
        isUnlocked: true,
        watchProgress: null,
      }),
    ]);
    expect(detail.episodes[0]).not.toHaveProperty('id');
  });

  it('rejects a well-formed but unknown detail user', async () => {
    const dramas = repository();
    dramas.findOne.mockResolvedValue({
      id: 1,
      status: 'PUBLISHED',
      publishedAt: new Date('2026-10-08T00:00:00Z'),
    });
    const users = repository();
    const service = new PublicCatalogService(
      dramas as never, repository() as never, repository() as never,
      repository() as never, repository() as never, repository() as never,
      repository() as never, users as never,
    );

    await expect(service.getDrama('drama', new Date('2026-10-09T00:00:00Z'), 'missing-user'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns anonymous detail with no user progress and only free episodes unlocked', async () => {
    const query = {
      leftJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getRawMany: vi.fn().mockResolvedValue([
        { id: 1, uuid: 'free', episodeNumber: 1, title: null, synopsis: null, durationMs: 1000, pricePoints: 0,
          unlocked: '1', progressEpisodeId: null, positionMs: null, isCompleted: null, lastPlayedAt: null },
        { id: 2, uuid: 'paid', episodeNumber: 2, title: null, synopsis: null, durationMs: 1000, pricePoints: 10,
          unlocked: '0', progressEpisodeId: null, positionMs: null, isCompleted: null, lastPlayedAt: null },
      ]),
    };
    const drama = { id: 7, uuid: 'drama', status: 'PUBLISHED', publishedAt: new Date('2026-10-08T00:00:00Z'),
      productionCompanyId: 1, publicSlug: 'drama', title: 'Drama', shortDescription: '', synopsis: '' };
    const dramas = repository();
    dramas.findOne.mockResolvedValue(drama);
    const service = new PublicCatalogService(
      dramas as never, repository() as never, repository() as never, repository() as never,
      repository() as never, repository() as never,
      { ...repository(), createQueryBuilder: vi.fn().mockReturnValue(query) } as never,
    );

    const detail = await service.getDrama('drama');

    expect(detail.episodes.map(({ isUnlocked, watchProgress }) => [isUnlocked, watchProgress]))
      .toEqual([[true, null], [false, null]]);
    expect(query.leftJoin).toHaveBeenCalledWith(expect.any(Function), 'entitlement',
      'entitlement.episodeId = episode.id AND entitlement.userId = :userId', { userId: null });
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
    await expect(service.getEpisodePlaybackUrl(
      'episode',
      '00000010-0000-4000-8000-000000000001',
    ))
      .rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getDramaPreviewPlaybackUrl('drama', 'preview'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(dramas.findOne).not.toHaveBeenCalled();
  });

  it('distinguishes anonymous paid playback from an authenticated missing entitlement', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const query = {
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      getRawOne: vi.fn().mockResolvedValue({ storageKey: 'episode.mp4', title: 'Episode', episodeNumber: 1,
        durationMs: 1000, userId: null, pricePoints: 10, entitlementId: null }),
    };
    const episodes = { ...repository(), createQueryBuilder: vi.fn().mockReturnValue(query) };
    const service = new PublicCatalogService(
      repository() as never, repository() as never, repository() as never, repository() as never,
      repository() as never, repository() as never, episodes as never,
    );

    await expect(service.getEpisodePlaybackUrl('episode')).rejects.toBeInstanceOf(InvalidTokenException);
    query.getRawOne.mockResolvedValueOnce({ storageKey: 'episode.mp4', title: 'Episode', episodeNumber: 1,
      durationMs: 1000, userId: 5, pricePoints: 10, entitlementId: null });
    await expect(service.getEpisodePlaybackUrl('episode', 'user-uuid'))
      .rejects.toBeInstanceOf(EpisodeAccessDeniedException);
  });
});

describe('PublicCatalogController optional identity', () => {
  it('uses only request.user for detail and playback while leaving other catalog routes public', async () => {
    const service = {
      getDrama: vi.fn(),
      getEpisodePlaybackUrl: vi.fn(),
    };
    const controller = new PublicCatalogController(service as never);
    const request = { user: { uuid: 'jwt-user' } } as never;

    controller.getDrama('drama', request);
    controller.getEpisodePlayback('episode', request);

    expect(service.getDrama).toHaveBeenCalledWith('drama', undefined, 'jwt-user');
    expect(service.getEpisodePlaybackUrl).toHaveBeenCalledWith('episode', 'jwt-user');
    expect(Reflect.getMetadata(GUARDS_METADATA, PublicCatalogController.prototype.getDrama))
      .toEqual([OptionalJwtAuthGuard]);
    expect(Reflect.getMetadata(GUARDS_METADATA, PublicCatalogController.prototype.getEpisodePlayback))
      .toEqual([OptionalJwtAuthGuard]);
    expect(Reflect.getMetadata(GUARDS_METADATA, PublicCatalogController.prototype.listDramas)).toBeUndefined();
    expect(Reflect.getMetadata(GUARDS_METADATA, PublicCatalogController.prototype.getDramaPreviewPlayback)).toBeUndefined();
  });
});
