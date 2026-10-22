import type { EntityManager } from 'typeorm';

import { AdRewardOffer, PointProduct } from '../../../src/economy/entities/index.js';
import {
  ContentImage,
  ContentVideo,
  Drama,
  DramaGenre,
  Episode,
  EpisodeSubtitle,
  Genre,
  ProductionCompany,
} from '../../../src/content/entities/index.js';
import { CollectionDrama, ContentCollection } from '../../../src/programming/entities/index.js';
import { seedData } from '../../../src/common/database/seed.js';
import initialData from '../../../src/common/database/seed/initialData.js';

type SeedRow = Record<string, unknown> & { id?: number; uuid?: string };

function createManager(): {
  manager: EntityManager;
  rowsFor: (entity: Function) => SeedRow[];
  updateEntityFlags: boolean[];
  updateColumns: string[][];
} {
  const tables = new Map<Function, { rows: SeedRow[]; nextId: number }>();
  const updateEntityFlags: boolean[] = [];
  const updateColumns: string[][] = [];
  const manager = {
    getRepository(entity: Function) {
      const table = tables.get(entity) ?? { rows: [], nextId: 1 };
      tables.set(entity, table);
      const applyUpsert = (rows: SeedRow[], conflictPaths: string[]) => {
        for (const row of rows) {
          const existing = table.rows.find((saved) =>
            conflictPaths.every((key) => saved[key] === row[key]),
          );
          if (existing) {
            Object.assign(existing, row);
          } else {
            table.rows.push({ ...row, id: row.id ?? table.nextId++ });
          }
        }
      };
      return {
        metadata: {
          findColumnWithPropertyPath(property: string) {
            return { databaseName: property.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`) };
          },
        },
        async upsert(rows: SeedRow[], conflictPaths: string[]) {
          applyUpsert(rows, conflictPaths);
          return {};
        },
        createQueryBuilder() {
          let rows: SeedRow[] = [];
          let conflictPaths: string[] = [];
          return {
            insert() { return this; },
            values(value: SeedRow[]) { rows = value; return this; },
            orUpdate(columns: string[], paths: string[]) {
              updateColumns.push(columns);
              conflictPaths = paths;
              return this;
            },
            updateEntity(value: boolean) { updateEntityFlags.push(value); return this; },
            async execute() { applyUpsert(rows, conflictPaths); return {}; },
          };
        },
        async find() {
          return table.rows.map(({ id, uuid }) => ({ id, uuid }));
        },
      };
    },
  } as unknown as EntityManager;

  return {
    manager,
    rowsFor: (entity) => tables.get(entity)?.rows ?? [],
    updateEntityFlags,
    updateColumns,
  };
}

describe('database seed with numeric primary keys', () => {
  it('resolves UUID parents to stable integer references on repeated runs', async () => {
    const { manager, rowsFor, updateEntityFlags, updateColumns } = createManager();

    await seedData(manager);
    expect(updateEntityFlags.length).toBeGreaterThan(0);
    expect(updateEntityFlags.every((value) => value === false)).toBe(true);
    expect(updateColumns.some((columns) => columns.includes('public_slug'))).toBe(true);
    const firstIds = new Map(
      [ProductionCompany, Drama, Episode, ContentCollection].flatMap((entity) =>
        rowsFor(entity).map(({ uuid, id }) => [`${entity.name}:${uuid}`, id] as const),
      ),
    );
    const firstCounts = [
      ProductionCompany,
      Genre,
      Drama,
      DramaGenre,
      ContentImage,
      Episode,
      ContentVideo,
      EpisodeSubtitle,
      ContentCollection,
      CollectionDrama,
      PointProduct,
      AdRewardOffer,
    ].map((entity) => rowsFor(entity).length);

    const companyIdByUuid = new Map(
      rowsFor(ProductionCompany).map(({ uuid, id }) => [String(uuid), Number(id)]),
    );
    const dramaIdByUuid = new Map(
      rowsFor(Drama).map(({ uuid, id }) => [String(uuid), Number(id)]),
    );
    const episodeIdByUuid = new Map(
      rowsFor(Episode).map(({ uuid, id }) => [String(uuid), Number(id)]),
    );
    const collectionIdByUuid = new Map(
      rowsFor(ContentCollection).map(({ uuid, id }) => [String(uuid), Number(id)]),
    );

    for (const drama of initialData.dramas) {
      expect(
        rowsFor(Drama).find(({ uuid }) => uuid === drama.uuid)?.productionCompanyId,
      ).toBe(companyIdByUuid.get(drama.productionCompanyUuid));
    }
    for (const relation of initialData.dramaGenres) {
      expect(
        rowsFor(DramaGenre).find(
          ({ dramaId, genreId }) =>
            dramaId === dramaIdByUuid.get(relation.dramaUuid) && genreId === relation.genreId,
        ),
      ).toBeDefined();
    }
    for (const episode of initialData.episodes) {
      expect(
        rowsFor(Episode).find(({ uuid }) => uuid === episode.uuid)?.dramaId,
      ).toBe(dramaIdByUuid.get(episode.dramaUuid));
    }

    for (const image of initialData.contentImages) {
      const expectedContentId =
        image.contentType === 'DRAMA'
          ? dramaIdByUuid.get(image.contentUuid)
          : image.contentType === 'EPISODE'
            ? episodeIdByUuid.get(image.contentUuid)
            : Number(image.contentUuid);
      expect(rowsFor(ContentImage).find(({ uuid }) => uuid === image.uuid)?.contentId).toBe(
        expectedContentId,
      );
    }
    for (const video of initialData.contentVideos) {
      const expectedContentId =
        video.contentType === 'DRAMA'
          ? dramaIdByUuid.get(video.contentUuid)
          : episodeIdByUuid.get(video.contentUuid);
      expect(rowsFor(ContentVideo).find(({ uuid }) => uuid === video.uuid)?.contentId).toBe(
        expectedContentId,
      );
    }
    for (const subtitle of initialData.episodeSubtitles) {
      expect(
        rowsFor(EpisodeSubtitle).find(({ uuid }) => uuid === subtitle.uuid)?.episodeId,
      ).toBe(episodeIdByUuid.get(subtitle.episodeUuid));
    }
    for (const relation of initialData.collectionDramas) {
      expect(
        rowsFor(CollectionDrama).find(
          ({ collectionId, dramaId, displayOrder }) =>
            collectionId === collectionIdByUuid.get(relation.collectionUuid) &&
            dramaId === dramaIdByUuid.get(relation.dramaUuid) &&
            displayOrder === relation.displayOrder,
        ),
      ).toBeDefined();
    }

    await seedData(manager);

    const secondIds = new Map(
      [ProductionCompany, Drama, Episode, ContentCollection].flatMap((entity) =>
        rowsFor(entity).map(({ uuid, id }) => [`${entity.name}:${uuid}`, id] as const),
      ),
    );
    expect(secondIds).toEqual(firstIds);
    expect([
      ProductionCompany,
      Genre,
      Drama,
      DramaGenre,
      ContentImage,
      Episode,
      ContentVideo,
      EpisodeSubtitle,
      ContentCollection,
      CollectionDrama,
      PointProduct,
      AdRewardOffer,
    ].map((entity) => rowsFor(entity).length)).toEqual(firstCounts);
  });
});
