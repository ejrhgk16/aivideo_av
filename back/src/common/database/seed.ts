import { AdRewardOffer, PointProduct } from '../../economy/entities/index.js';
import {
  Drama,
  DramaGenre,
  DramaImage,
  Episode,
  EpisodeSubtitle,
  EpisodeVideo,
  Genre,
  ProductionCompany,
} from '../../content/entities/index.js';
import {
  CollectionDrama,
  ContentCollection,
} from '../../programming/entities/index.js';
import dataSource from './dataSource.js';
import initialData from './seed/initialData.js';

async function seed(): Promise<void> {
  try {
    await dataSource.initialize();

    await dataSource.transaction(async (manager) => {
      await manager
        .getRepository(ProductionCompany)
        .upsert(initialData.productionCompanies, ['id']);
      await manager.getRepository(Genre).upsert(initialData.genres, ['id']);
      await manager.getRepository(Drama).upsert(initialData.dramas, ['id']);
      await manager
        .getRepository(DramaGenre)
        .upsert(initialData.dramaGenres, ['dramaId', 'genreId']);
      await manager
        .getRepository(DramaImage)
        .upsert(initialData.dramaImages, ['id']);
      await manager.getRepository(Episode).upsert(initialData.episodes, ['id']);
      await manager
        .getRepository(EpisodeVideo)
        .upsert(initialData.episodeVideos, ['id']);
      await manager
        .getRepository(EpisodeSubtitle)
        .upsert(initialData.episodeSubtitles, ['id']);
      await manager
        .getRepository(ContentCollection)
        .upsert(initialData.contentCollections, ['id']);
      await manager
        .getRepository(CollectionDrama)
        .upsert(initialData.collectionDramas, ['collectionId', 'dramaId']);
      await manager
        .getRepository(PointProduct)
        .upsert(initialData.pointProducts, ['id']);
      await manager
        .getRepository(AdRewardOffer)
        .upsert(initialData.adRewardOffers, ['id']);
    });

    console.log('Database seed completed.');
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

seed().catch((error: unknown) => {
  console.error('Database seed failed.', error);
  process.exitCode = 1;
});
