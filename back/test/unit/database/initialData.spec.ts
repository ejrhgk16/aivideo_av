import { initialData } from '../../../src/common/database/seed/initialData.js';
import {
  createDramaImageStorageKey,
  createDramaPreviewStorageKey,
  createEpisodeImageStorageKey,
  createEpisodeSubtitleStorageKey,
  createEpisodeVideoStorageKey,
  createGenreImageStorageKey,
} from '../../../src/content/mediaStorage.js';

describe('initial seed data', () => {
  it('keeps fixed UUIDs used by existing media storage keys', () => {
    expect(initialData.productionCompanies[0].uuid).toBe(
      '00000001-0000-4000-8000-000000000001',
    );
    expect(initialData.dramas[0].uuid).toBe('00000002-0000-4000-8000-000000000001');
    expect(initialData.contentImages[0].storageKey).toBe(
      'dramas/00000002-0000-4000-8000-000000000001/images/poster/00000003-0000-4000-8000-000000000001.webp',
    );
  });

  it('defines the admin user and its one-time initial points grant', () => {
    expect(initialData.adminLogin).toEqual({ loginId: 'admin', password: 'admin' });
    expect(initialData.adminUser).toEqual({
      uuid: '00000010-0000-4000-8000-000000000001',
      displayName: 'admin',
      accountType: 'OPERATOR',
      status: 'ACTIVE',
      productionCompanyId: null,
    });
    expect(initialData.adminInitialGrant).toEqual({
      uuid: '00000011-0000-4000-8000-000000000001',
      transactionType: 'ADMIN_ADJUSTMENT',
      amount: 100,
      idempotencyKey: 'seed:admin:initial-points:v1',
      memo: 'admin initial points',
    });
  });

  it('contains the planned number of catalog and commerce rows', () => {
    expect(initialData.productionCompanies).toHaveLength(3);
    expect(initialData.genres).toHaveLength(6);
    expect(initialData.dramas).toHaveLength(5);
    expect(initialData.dramaGenres).toHaveLength(10);
    expect(initialData.contentImages).toHaveLength(56);
    expect(initialData.episodes).toHaveLength(20);
    expect(initialData.contentVideos).toHaveLength(30);
    expect(initialData.episodeSubtitles).toHaveLength(20);
    expect(initialData.contentCollections).toHaveLength(4);
    expect(initialData.collectionDramas).toHaveLength(14);
    expect(initialData.pointProducts).toHaveLength(3);
    expect(initialData.adRewardOffers).toHaveLength(2);
  });

  it('uses published content and references existing parent rows', () => {
    const companyUuids = new Set(initialData.productionCompanies.map(({ uuid }) => uuid));
    const dramaUuids = new Set(initialData.dramas.map(({ uuid }) => uuid));
    const genreIds = new Set(initialData.genres.map(({ id }) => id));
    const collectionUuids = new Set(initialData.contentCollections.map(({ uuid }) => uuid));
    const episodeUuids = new Set(initialData.episodes.map(({ uuid }) => uuid));

    expect(initialData.dramas.every((drama) => drama.status === 'PUBLISHED')).toBe(true);
    expect(initialData.dramas.every((drama) => drama.publishedAt instanceof Date)).toBe(true);
    expect(initialData.episodes.every((episode) => episode.status === 'PUBLISHED')).toBe(true);
    expect(initialData.episodes.every((episode) => episode.publishedAt instanceof Date)).toBe(true);
    expect(
      initialData.dramas.every((drama) => companyUuids.has(drama.productionCompanyUuid)),
    ).toBe(true);
    expect(
      initialData.dramaGenres.every(
        ({ dramaUuid, genreId }) => dramaUuids.has(dramaUuid) && genreIds.has(genreId),
      ),
    ).toBe(true);
    expect(
      initialData.contentImages.every(({ contentType, contentUuid }) =>
        contentType === 'DRAMA'
          ? dramaUuids.has(contentUuid!)
          : contentType === 'GENRE'
            ? genreIds.has(Number(contentUuid))
            : episodeUuids.has(contentUuid!),
      ),
    ).toBe(true);
    expect(initialData.episodes.every(({ dramaUuid }) => dramaUuids.has(dramaUuid))).toBe(true);
    expect(
      initialData.contentVideos.every(({ contentType, contentUuid }) =>
        contentType === 'DRAMA' ? dramaUuids.has(contentUuid!) : episodeUuids.has(contentUuid!),
      ),
    ).toBe(true);
    expect(
      initialData.episodeSubtitles.every(({ episodeUuid }) => episodeUuids.has(episodeUuid)),
    ).toBe(true);
    expect(
      initialData.collectionDramas.every(
        ({ collectionUuid, dramaUuid }) =>
          collectionUuids.has(collectionUuid) && dramaUuids.has(dramaUuid),
      ),
    ).toBe(true);
  });

  it('gives every drama one free episode followed by paid episodes', () => {
    for (const drama of initialData.dramas) {
      const dramaEpisodes = initialData.episodes
        .filter(({ dramaUuid }) => dramaUuid === drama.uuid)
        .sort((left, right) => left.episodeNumber! - right.episodeNumber!);

      expect(dramaEpisodes).toHaveLength(4);
      expect(dramaEpisodes[0].episodeNumber).toBe(1);
      expect(dramaEpisodes[0].pricePoints).toBe(0);
      expect(dramaEpisodes.slice(1).every(({ pricePoints }) => (pricePoints ?? 0) > 0)).toBe(true);
    }
  });

  it('has the planned image ownership and ordered campaigns', () => {
    for (const drama of initialData.dramas) {
      const images = initialData.contentImages.filter(
        ({ contentType, contentUuid }) =>
          contentType === 'DRAMA' && contentUuid === drama.uuid,
      );

      expect(images.map(({ kind }) => kind).sort()).toEqual([
        'CAMPAIGN',
        'CAMPAIGN',
        'DETAIL_COVER',
        'HOME_HERO',
        'POSTER',
        'POSTER_LANDSCAPE',
      ]);
      expect(
        images
          .filter(({ kind }) => kind === 'CAMPAIGN')
          .sort((left, right) => left.displayOrder! - right.displayOrder!)
          .map(({ displayOrder }) => displayOrder),
      ).toEqual([1, 2]);

      const landscapePoster = images.find(({ kind }) => kind === 'POSTER_LANDSCAPE');
      expect(landscapePoster?.storageKey).toBe(
        createDramaImageStorageKey(drama.uuid, landscapePoster!.uuid!, 'POSTER_LANDSCAPE'),
      );
    }

    for (const genre of initialData.genres) {
      expect(
        initialData.contentImages.filter(
          ({ contentType, contentUuid, kind }) =>
            contentType === 'GENRE' && contentUuid === String(genre.id) && kind === 'GENRE_TILE',
        ),
      ).toHaveLength(1);
    }

    for (const episode of initialData.episodes) {
      expect(
        initialData.contentImages.filter(
          ({ contentType, contentUuid, kind }) =>
            contentType === 'EPISODE' && contentUuid === episode.uuid && kind === 'EPISODE_COVER',
        ),
      ).toHaveLength(1);
    }

    const homeCampaign = initialData.contentCollections.find(
      ({ code }) => code === 'HOME_CAMPAIGN',
    );
    expect(homeCampaign).toMatchObject({ kind: 'HOME', isActive: true });

    const homeCampaignDrama = initialData.collectionDramas.find(
      ({ collectionUuid }) => collectionUuid === homeCampaign?.uuid,
    );
    expect(homeCampaignDrama?.dramaUuid).toBe(initialData.dramas[0].uuid);
    expect(
      initialData.contentImages.filter(
        ({ contentType, contentUuid, kind }) =>
          contentType === 'DRAMA' &&
          contentUuid === homeCampaignDrama?.dramaUuid &&
          kind === 'CAMPAIGN',
      ),
    ).toHaveLength(2);
  });

  it('has multiple drama previews and one full video for each episode', () => {
    for (const drama of initialData.dramas) {
      const videos = initialData.contentVideos
        .filter(
          ({ contentType, contentUuid }) =>
            contentType === 'DRAMA' && contentUuid === drama.uuid,
        )
        .sort((left, right) => left.displayOrder! - right.displayOrder!);

      expect(videos.map(({ kind }) => kind)).toEqual(['PREVIEW', 'PREVIEW']);
      expect(videos.map(({ displayOrder }) => displayOrder)).toEqual([1, 2]);
      expect(videos.map(({ durationMs }) => durationMs)).toEqual([15000, 15000]);
    }

    for (const episode of initialData.episodes) {
      const videos = initialData.contentVideos.filter(
        ({ contentType, contentUuid }) =>
          contentType === 'EPISODE' && contentUuid === episode.uuid,
      );

      expect(videos.map(({ kind }) => kind)).toEqual(['FULL']);
      expect(videos.every(({ storageKey }) => storageKey?.includes(episode.uuid!))).toBe(true);
      expect(videos[0].durationMs).toBe(episode.durationMs);
    }
  });

  it('keeps collection ordering and media storage keys deterministic', () => {
    const episodeByUuid = new Map(initialData.episodes.map((episode) => [episode.uuid, episode]));

    for (const collection of initialData.contentCollections) {
      const rows = initialData.collectionDramas
        .filter(({ collectionUuid }) => collectionUuid === collection.uuid)
        .sort((left, right) => left.displayOrder! - right.displayOrder!);

      expect(rows.map(({ displayOrder }) => displayOrder)).toEqual(
        rows.map((_, index) => index + 1),
      );
    }

    for (const image of initialData.contentImages) {
      if (image.contentType === 'DRAMA') {
        const kind = image.kind;
        if (
          kind !== 'POSTER' &&
          kind !== 'POSTER_LANDSCAPE' &&
          kind !== 'HOME_HERO' &&
          kind !== 'DETAIL_COVER' &&
          kind !== 'CAMPAIGN'
        ) {
          throw new Error(`Unexpected drama image kind: ${kind}`);
        }
        expect(image.storageKey).toBe(
          createDramaImageStorageKey(image.contentUuid!, image.uuid!, kind),
        );
      } else if (image.contentType === 'GENRE') {
        expect(image.storageKey).toBe(createGenreImageStorageKey(image.contentUuid!, image.uuid!));
      } else {
        const episode = episodeByUuid.get(image.contentUuid!);

        expect(image.storageKey).toBe(
          createEpisodeImageStorageKey(episode!.dramaUuid!, image.contentUuid!, image.uuid!),
        );
      }
    }

    for (const video of initialData.contentVideos) {
      if (video.contentType === 'DRAMA') {
        expect(video.storageKey).toBe(
          createDramaPreviewStorageKey(video.contentUuid!, video.uuid!),
        );
      } else {
        const episode = episodeByUuid.get(video.contentUuid!);

        expect(video.storageKey).toBe(
          createEpisodeVideoStorageKey(episode!.dramaUuid!, video.contentUuid!, video.uuid!),
        );
      }
    }

    for (const subtitle of initialData.episodeSubtitles) {
      const episode = episodeByUuid.get(subtitle.episodeUuid!);

      expect(subtitle.storageKey).toBe(
        createEpisodeSubtitleStorageKey(
          episode!.dramaUuid!,
          subtitle.episodeUuid!,
          subtitle.languageCode!,
          subtitle.format!,
        ),
      );
    }
  });
});
