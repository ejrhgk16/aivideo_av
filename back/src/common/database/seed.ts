import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  In,
  type EntityManager,
  type FindOptionsSelect,
  type FindOptionsWhere,
  type QueryDeepPartialEntity,
  type Repository,
} from 'typeorm';

import { AdRewardOffer, PointProduct } from '../../economy/entities/index.js';
import {
  ContentImage,
  ContentVideo,
  Drama,
  DramaGenre,
  Episode,
  EpisodeSubtitle,
  Genre,
  ProductionCompany,
} from '../../content/entities/index.js';
import {
  CollectionDrama,
  ContentCollection,
} from '../../programming/entities/index.js';
import dataSource from './dataSource.js';
import initialData from './seed/initialData.js';

type NumericUuidEntity = { id: number; uuid: string };

async function upsertUuidRows<T extends NumericUuidEntity>(
  repository: Repository<T>,
  rows: Array<QueryDeepPartialEntity<T> & { uuid: string }>,
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const updateColumns = Object.keys(rows[0]).filter(
    (column) => column !== 'id' && column !== 'uuid',
  ).map((property) => {
    const column = repository.metadata.findColumnWithPropertyPath(property);
    if (!column) {
      throw new Error(`Unknown seed column: ${property}`);
    }
    return column.databaseName;
  });
  await repository
    .createQueryBuilder()
    .insert()
    .values(rows)
    .orUpdate(updateColumns, ['uuid'])
    .updateEntity(false)
    .execute();
}

async function upsertAndGetIds<T extends NumericUuidEntity>(
  repository: Repository<T>,
  rows: Array<QueryDeepPartialEntity<T> & { uuid: string }>,
): Promise<Map<string, number>> {
  if (rows.length === 0) {
    return new Map();
  }

  await upsertUuidRows(repository, rows);
  const uuids = rows.map(({ uuid }) => String(uuid));
  const savedRows = await repository.find({
    select: { id: true, uuid: true } as FindOptionsSelect<T>,
    where: { uuid: In(uuids) } as FindOptionsWhere<T>,
  });
  return new Map(savedRows.map(({ uuid, id }) => [uuid, id]));
}

function requireId(ids: Map<string, number>, uuid: string): number {
  const id = ids.get(uuid);
  if (id === undefined) {
    throw new Error(`Seed reference UUID was not found: ${uuid}`);
  }
  return id;
}

export async function seedData(manager: EntityManager): Promise<void> {
  const companyIds = await upsertAndGetIds(
    manager.getRepository(ProductionCompany),
    initialData.productionCompanies,
  );
  await manager.getRepository(Genre).upsert(initialData.genres, ['id']);

  const dramaRows = initialData.dramas.map(({ productionCompanyUuid, ...drama }) => ({
    ...drama,
    productionCompanyId: requireId(companyIds, productionCompanyUuid),
  }));
  const dramaIds = await upsertAndGetIds(manager.getRepository(Drama), dramaRows);

  await manager.getRepository(DramaGenre).upsert(
    initialData.dramaGenres.map(({ dramaUuid, ...dramaGenre }) => ({
      ...dramaGenre,
      dramaId: requireId(dramaIds, dramaUuid),
    })),
    ['dramaId', 'genreId'],
  );

  const episodeRows = initialData.episodes.map(({ dramaUuid, ...episode }) => ({
    ...episode,
    dramaId: requireId(dramaIds, dramaUuid),
  }));
  const episodeIds = await upsertAndGetIds(manager.getRepository(Episode), episodeRows);

  const collectionIds = await upsertAndGetIds(
    manager.getRepository(ContentCollection),
    initialData.contentCollections,
  );

  await upsertUuidRows(
    manager.getRepository(ContentImage),
    initialData.contentImages.map(({ contentUuid, ...image }) => ({
      ...image,
      contentId:
        image.contentType === 'DRAMA'
          ? requireId(dramaIds, contentUuid)
          : image.contentType === 'EPISODE'
            ? requireId(episodeIds, contentUuid)
            : Number(contentUuid),
    })),
  );

  await upsertUuidRows(
    manager.getRepository(ContentVideo),
    initialData.contentVideos.map(({ contentUuid, ...video }) => ({
      ...video,
      contentId:
        video.contentType === 'DRAMA'
          ? requireId(dramaIds, contentUuid)
          : requireId(episodeIds, contentUuid),
    })),
  );

  await upsertUuidRows(
    manager.getRepository(EpisodeSubtitle),
    initialData.episodeSubtitles.map(({ episodeUuid, ...subtitle }) => ({
      ...subtitle,
      episodeId: requireId(episodeIds, episodeUuid),
    })),
  );

  await manager.getRepository(CollectionDrama).upsert(
    initialData.collectionDramas.map(({ collectionUuid, dramaUuid, ...row }) => ({
      ...row,
      collectionId: requireId(collectionIds, collectionUuid),
      dramaId: requireId(dramaIds, dramaUuid),
    })),
    ['collectionId', 'dramaId'],
  );

  await upsertAndGetIds(manager.getRepository(PointProduct), initialData.pointProducts);
  await upsertAndGetIds(manager.getRepository(AdRewardOffer), initialData.adRewardOffers);
}

async function seed(): Promise<void> {
  try {
    await dataSource.initialize();

    await dataSource.transaction(seedData);

    console.log('Database seed completed.');
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  seed().catch((error: unknown) => {
    console.error('Database seed failed.', error);
    process.exitCode = 1;
  });
}
