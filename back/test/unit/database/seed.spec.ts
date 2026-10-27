import type { EntityManager } from 'typeorm';

import { AdRewardOffer, PointProduct } from '../../../src/economy/entities/index.js';
import { PointTransaction, Wallet } from '../../../src/economy/entities/index.js';
import { User } from '../../../src/identity/entities/index.js';
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
      const applyInsertIgnore = (rows: SeedRow[]) => {
        for (const row of rows) {
          const key = entity === Wallet ? 'userId' : 'uuid';
          if (!table.rows.some((saved) => saved[key] === row[key])) {
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
          let ignore = false;
          return {
            insert() { return this; },
            values(value: SeedRow | SeedRow[]) { rows = Array.isArray(value) ? value : [value]; return this; },
            orIgnore() { ignore = true; return this; },
            orUpdate(columns: string[], paths: string[]) {
              updateColumns.push(columns);
              conflictPaths = paths;
              return this;
            },
            updateEntity(value: boolean) { updateEntityFlags.push(value); return this; },
            async execute() {
              if (ignore) applyInsertIgnore(rows);
              else applyUpsert(rows, conflictPaths);
              return {};
            },
          };
        },
        async find() {
          return table.rows.map(({ id, uuid }) => ({ id, uuid }));
        },
        async findOneByOrFail(where: SeedRow) {
          const row = table.rows.find((saved) =>
            Object.entries(where).every(([key, value]) => saved[key] === value),
          );
          if (!row) throw new Error('Seed row not found');
          return row;
        },
        async findOneOrFail(options: { where: SeedRow }) {
          return this.findOneByOrFail(options.where);
        },
        async findOneBy(where: SeedRow) {
          return table.rows.find((saved) =>
            Object.entries(where).every(([key, value]) => saved[key] === value),
          ) ?? null;
        },
        async insert(row: SeedRow) {
          table.rows.push({ ...row, id: row.id ?? table.nextId++ });
          return {};
        },
        async update(criteria: SeedRow, values: SeedRow) {
          const row = table.rows.find((saved) =>
            Object.entries(criteria).every(([key, value]) => saved[key] === value),
          );
          if (row) Object.assign(row, values);
          return {};
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
      User,
      Wallet,
      PointTransaction,
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

    const admin = rowsFor(User).find(({ uuid }) => uuid === initialData.adminUser.uuid);
    expect(admin).toMatchObject({
      displayName: 'admin',
      accountType: 'OPERATOR',
      status: 'ACTIVE',
      productionCompanyId: null,
    });
    expect(rowsFor(Wallet)).toContainEqual({ userId: admin?.id, availablePoints: 100, id: 1 });
    expect(rowsFor(PointTransaction)).toContainEqual({
      ...initialData.adminInitialGrant,
      walletUserId: admin?.id,
      balanceAfter: 100,
      id: 1,
    });

    await seedData(manager);

    const secondIds = new Map(
      [ProductionCompany, Drama, Episode, ContentCollection].flatMap((entity) =>
        rowsFor(entity).map(({ uuid, id }) => [`${entity.name}:${uuid}`, id] as const),
      ),
    );
    expect(secondIds).toEqual(firstIds);
    expect([
      User,
      Wallet,
      PointTransaction,
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

    rowsFor(Wallet)[0].availablePoints = 40;
    await seedData(manager);
    expect(
      rowsFor(User).find(({ uuid }) => uuid === initialData.adminUser.uuid)?.id,
    ).toBe(admin?.id);
    expect(rowsFor(Wallet)[0].userId).toBe(admin?.id);
    expect(rowsFor(Wallet)[0].availablePoints).toBe(40);
    expect(rowsFor(PointTransaction)).toHaveLength(1);
  });
});
