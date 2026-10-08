import { initialData } from '../../../src/common/database/seed/initialData.js';

describe('initial seed data', () => {
  it('contains the planned number of catalog and commerce rows', () => {
    expect(initialData.productionCompanies).toHaveLength(3);
    expect(initialData.genres).toHaveLength(6);
    expect(initialData.dramas).toHaveLength(5);
    expect(initialData.dramaGenres).toHaveLength(10);
    expect(initialData.dramaImages).toHaveLength(15);
    expect(initialData.episodes).toHaveLength(20);
    expect(initialData.episodeVideos).toHaveLength(40);
    expect(initialData.episodeSubtitles).toHaveLength(20);
    expect(initialData.contentCollections).toHaveLength(3);
    expect(initialData.collectionDramas).toHaveLength(13);
    expect(initialData.pointProducts).toHaveLength(3);
    expect(initialData.adRewardOffers).toHaveLength(2);
  });

  it('uses published content and references existing parent rows', () => {
    const companyIds = new Set(initialData.productionCompanies.map(({ id }) => id));
    const dramaIds = new Set(initialData.dramas.map(({ id }) => id));
    const genreIds = new Set(initialData.genres.map(({ id }) => id));
    const collectionIds = new Set(initialData.contentCollections.map(({ id }) => id));
    const episodeIds = new Set(initialData.episodes.map(({ id }) => id));

    expect(initialData.dramas.every((drama) => drama.status === 'PUBLISHED')).toBe(true);
    expect(initialData.dramas.every((drama) => drama.publishedAt instanceof Date)).toBe(true);
    expect(initialData.episodes.every((episode) => episode.status === 'PUBLISHED')).toBe(true);
    expect(initialData.episodes.every((episode) => episode.publishedAt instanceof Date)).toBe(true);
    expect(initialData.dramas.every((drama) => companyIds.has(drama.productionCompanyId))).toBe(true);
    expect(
      initialData.dramaGenres.every(
        ({ dramaId, genreId }) => dramaIds.has(dramaId) && genreIds.has(genreId),
      ),
    ).toBe(true);
    expect(initialData.dramaImages.every(({ dramaId }) => dramaIds.has(dramaId))).toBe(true);
    expect(initialData.episodes.every(({ dramaId }) => dramaIds.has(dramaId))).toBe(true);
    expect(initialData.episodeVideos.every(({ episodeId }) => episodeIds.has(episodeId))).toBe(true);
    expect(initialData.episodeSubtitles.every(({ episodeId }) => episodeIds.has(episodeId))).toBe(true);
    expect(
      initialData.collectionDramas.every(
        ({ collectionId, dramaId }) => collectionIds.has(collectionId) && dramaIds.has(dramaId),
      ),
    ).toBe(true);
  });

  it('gives every drama one free episode followed by paid episodes', () => {
    for (const drama of initialData.dramas) {
      const dramaEpisodes = initialData.episodes
        .filter(({ dramaId }) => dramaId === drama.id)
        .sort((left, right) => left.episodeNumber! - right.episodeNumber!);

      expect(dramaEpisodes).toHaveLength(4);
      expect(dramaEpisodes[0].episodeNumber).toBe(1);
      expect(dramaEpisodes[0].pricePoints).toBe(0);
      expect(dramaEpisodes.slice(1).every(({ pricePoints }) => (pricePoints ?? 0) > 0)).toBe(true);
    }
  });

  it('has one full and one preview video for each episode', () => {
    for (const episode of initialData.episodes) {
      const videos = initialData.episodeVideos.filter(({ episodeId }) => episodeId === episode.id);

      expect(videos.map(({ kind }) => kind).sort()).toEqual(['FULL', 'PREVIEW']);
      expect(videos.every(({ storageKey }) => storageKey?.includes(episode.id!))).toBe(true);
    }
  });

  it('keeps collection ordering and media storage keys deterministic', () => {
    for (const collection of initialData.contentCollections) {
      const rows = initialData.collectionDramas
        .filter(({ collectionId }) => collectionId === collection.id)
        .sort((left, right) => left.displayOrder! - right.displayOrder!);

      expect(rows.map(({ displayOrder }) => displayOrder)).toEqual(
        rows.map((_, index) => index + 1),
      );
    }

    expect(
      initialData.dramaImages.every(({ storageKey }) => storageKey?.startsWith('dramas/')),
    ).toBe(true);
    expect(
      initialData.episodeVideos.every(({ storageKey }) => storageKey?.startsWith('episodes/')),
    ).toBe(true);
    expect(
      initialData.episodeSubtitles.every(({ storageKey }) => storageKey?.startsWith('episodes/')),
    ).toBe(true);
  });
});
