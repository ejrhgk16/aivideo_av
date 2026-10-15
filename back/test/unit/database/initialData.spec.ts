import { initialData } from '../../../src/common/database/seed/initialData.js';
import {
  createDramaImageStorageKey,
  createDramaPreviewStorageKey,
  createEpisodeImageStorageKey,
  createEpisodeSubtitleStorageKey,
  createEpisodeVideoStorageKey,
  createGenreImageStorageKey,
} from '../../../src/content/media-storage.js';

describe('initial seed data', () => {
  it('contains the planned number of catalog and commerce rows', () => {
    expect(initialData.productionCompanies).toHaveLength(3);
    expect(initialData.genres).toHaveLength(6);
    expect(initialData.dramas).toHaveLength(5);
    expect(initialData.dramaGenres).toHaveLength(10);
    expect(initialData.contentImages).toHaveLength(51);
    expect(initialData.episodes).toHaveLength(20);
    expect(initialData.contentVideos).toHaveLength(30);
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
    expect(
      initialData.contentImages.every(({ contentType, contentId }) =>
        contentType === 'DRAMA'
          ? dramaIds.has(contentId!)
          : contentType === 'GENRE'
            ? genreIds.has(Number(contentId))
            : episodeIds.has(contentId!),
      ),
    ).toBe(true);
    expect(initialData.episodes.every(({ dramaId }) => dramaIds.has(dramaId))).toBe(true);
    expect(
      initialData.contentVideos.every(({ contentType, contentId }) =>
        contentType === 'DRAMA' ? dramaIds.has(contentId!) : episodeIds.has(contentId!),
      ),
    ).toBe(true);
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

  it('has the planned image ownership and ordered campaigns', () => {
    for (const drama of initialData.dramas) {
      const images = initialData.contentImages.filter(
        ({ contentType, contentId }) => contentType === 'DRAMA' && contentId === drama.id,
      );

      expect(images.map(({ kind }) => kind).sort()).toEqual([
        'CAMPAIGN',
        'CAMPAIGN',
        'DETAIL_COVER',
        'HOME_HERO',
        'POSTER',
      ]);
      expect(
        images
          .filter(({ kind }) => kind === 'CAMPAIGN')
          .sort((left, right) => left.displayOrder! - right.displayOrder!)
          .map(({ displayOrder }) => displayOrder),
      ).toEqual([1, 2]);
    }

    for (const genre of initialData.genres) {
      expect(
        initialData.contentImages.filter(
          ({ contentType, contentId, kind }) =>
            contentType === 'GENRE' && contentId === String(genre.id) && kind === 'GENRE_TILE',
        ),
      ).toHaveLength(1);
    }

    for (const episode of initialData.episodes) {
      expect(
        initialData.contentImages.filter(
          ({ contentType, contentId, kind }) =>
            contentType === 'EPISODE' && contentId === episode.id && kind === 'EPISODE_COVER',
        ),
      ).toHaveLength(1);
    }
  });

  it('has multiple drama previews and one full video for each episode', () => {
    for (const drama of initialData.dramas) {
      const videos = initialData.contentVideos
        .filter(({ contentType, contentId }) => contentType === 'DRAMA' && contentId === drama.id)
        .sort((left, right) => left.displayOrder! - right.displayOrder!);

      expect(videos.map(({ kind }) => kind)).toEqual(['PREVIEW', 'PREVIEW']);
      expect(videos.map(({ displayOrder }) => displayOrder)).toEqual([1, 2]);
    }

    for (const episode of initialData.episodes) {
      const videos = initialData.contentVideos.filter(
        ({ contentType, contentId }) => contentType === 'EPISODE' && contentId === episode.id,
      );

      expect(videos.map(({ kind }) => kind)).toEqual(['FULL']);
      expect(videos.every(({ storageKey }) => storageKey?.includes(episode.id!))).toBe(true);
    }
  });

  it('keeps collection ordering and media storage keys deterministic', () => {
    const episodeById = new Map(initialData.episodes.map((episode) => [episode.id, episode]));

    for (const collection of initialData.contentCollections) {
      const rows = initialData.collectionDramas
        .filter(({ collectionId }) => collectionId === collection.id)
        .sort((left, right) => left.displayOrder! - right.displayOrder!);

      expect(rows.map(({ displayOrder }) => displayOrder)).toEqual(
        rows.map((_, index) => index + 1),
      );
    }

    for (const image of initialData.contentImages) {
      if (image.contentType === 'DRAMA') {
        expect(image.storageKey).toBe(
          createDramaImageStorageKey(image.contentId!, image.id!, image.kind!),
        );
      } else if (image.contentType === 'GENRE') {
        expect(image.storageKey).toBe(createGenreImageStorageKey(image.contentId!, image.id!));
      } else {
        const episode = episodeById.get(image.contentId!);

        expect(image.storageKey).toBe(
          createEpisodeImageStorageKey(episode!.dramaId!, image.contentId!, image.id!),
        );
      }
    }

    for (const video of initialData.contentVideos) {
      if (video.contentType === 'DRAMA') {
        expect(video.storageKey).toBe(createDramaPreviewStorageKey(video.contentId!, video.id!));
      } else {
        const episode = episodeById.get(video.contentId!);

        expect(video.storageKey).toBe(
          createEpisodeVideoStorageKey(episode!.dramaId!, video.contentId!, video.id!),
        );
      }
    }

    for (const subtitle of initialData.episodeSubtitles) {
      const episode = episodeById.get(subtitle.episodeId!);

      expect(subtitle.storageKey).toBe(
        createEpisodeSubtitleStorageKey(
          episode!.dramaId!,
          subtitle.episodeId!,
          subtitle.languageCode!,
          subtitle.format!,
        ),
      );
    }
  });
});
