import { describe, expect, it } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import { Drama, Episode } from '../../../src/content/entities/index.js';
import { User } from '../../../src/identity/entities/index.js';
import { EpisodeEntitlement, PointTransaction, Wallet } from '../../../src/economy/entities/index.js';
import { PointService } from '../../../src/economy/pointService.js';
import {
  InsufficientPointsException,
  PointBalanceOverflowException,
  PointEpisodeNotFoundException,
  PointIdempotencyConflictException,
} from '../../../src/common/error/error.customExceptions.js';

const userUuid = '00000010-0000-4000-8000-000000000001';
const episodeUuid = '00000020-0000-4000-8000-000000000001';

function createFixture() {
  const state = {
    wallet: { userId: 7, availablePoints: 100 },
    episode: {
      id: 11,
      uuid: episodeUuid,
      pricePoints: 35,
      status: 'PUBLISHED',
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    } as {
      id: number;
      uuid: string;
      pricePoints: number;
      status: string;
      publishedAt: Date | null;
    } | null,
    dramaStatus: 'PUBLISHED',
    dramaPublishedAt: new Date('2026-01-01T00:00:00.000Z') as Date | null,
    pointTransactions: [] as Array<Record<string, unknown>>,
    entitlements: [] as Array<Record<string, unknown>>,
    walletLock: false,
    episodeLock: false,
    isolation: [] as string[],
    failEntitlementInsert: false,
    duplicateKeyConflict: false,
  };
  let transactionQueue = Promise.resolve();
  const manager = {
    getRepository(entity: Function) {
      if (entity === User) {
        return { findOneBy: async () => ({ id: 7, uuid: userUuid }) };
      }
      if (entity === Wallet) {
        return {
          findOne: async (options: { lock: { mode: string } }) => {
            state.walletLock = options.lock.mode === 'pessimistic_write';
            return state.wallet;
          },
          update: async (_where: unknown, values: { availablePoints: number }) => {
            state.wallet.availablePoints = values.availablePoints;
          },
        };
      }
      if (entity === PointTransaction) {
        return {
          findOneBy: async (where: { idempotencyKey: string }) =>
            state.pointTransactions.find((row) => row.idempotencyKey === where.idempotencyKey) ?? null,
          insert: async (row: Record<string, unknown>) => {
            if (state.duplicateKeyConflict) {
              throw {
                driverError: {
                  code: 'ER_DUP_ENTRY',
                  sqlMessage: "Duplicate entry for key 'idempotency_key'",
                },
              };
            }
            state.pointTransactions.push({ ...row });
          },
          create: (row: Record<string, unknown>) => ({ ...row }),
          save: async (row: Record<string, unknown>) => {
            const saved = { ...row, id: state.pointTransactions.length + 1 };
            state.pointTransactions.push(saved);
            return saved;
          },
        };
      }
      if (entity === Episode) {
        let requestedUuid = '';
        const builder = {
          innerJoin: () => builder,
          where: (_condition: string, parameters: { episodeUuid: string }) => {
            requestedUuid = parameters.episodeUuid;
            return builder;
          },
          andWhere: () => builder,
          setLock: (mode: string) => {
            state.episodeLock = mode === 'pessimistic_read';
            return builder;
          },
          getOne: async () => {
            if (
              !state.episode ||
              state.episode.status !== 'PUBLISHED' ||
              !state.episode.publishedAt ||
              state.episode.publishedAt > new Date() ||
              state.dramaStatus !== 'PUBLISHED' ||
              !state.dramaPublishedAt ||
              state.dramaPublishedAt > new Date()
            ) return null;
            return requestedUuid.endsWith('0002')
              ? { ...state.episode, id: 12, uuid: requestedUuid }
              : state.episode;
          },
        };
        return { createQueryBuilder: () => builder };
      }
      if (entity === Drama) return {};
      if (entity === EpisodeEntitlement) {
        return {
          findOneBy: async (where: { userId: number; episodeId: number }) =>
            state.entitlements.find((row) =>
              row.userId === where.userId && row.episodeId === where.episodeId,
            ) ?? null,
          insert: async (row: Record<string, unknown>) => {
            if (state.failEntitlementInsert) throw new Error('entitlement insert failed');
            state.entitlements.push({ ...row });
          },
        };
      }
      throw new Error('Unexpected repository');
    },
  } as unknown as EntityManager;
  const dataSource = {
    transaction: (isolation: string, work: (manager: EntityManager) => Promise<unknown>) => {
      state.isolation.push(isolation);
      const run = transactionQueue.then(async () => {
        const snapshot = structuredClone(state);
        try {
          return await work(manager);
        } catch (error) {
          Object.assign(state, snapshot);
          throw error;
        }
      });
      transactionQueue = run.then(() => undefined, () => undefined);
      return run;
    },
  } as unknown as DataSource;
  return { service: new PointService(dataSource), state };
}

describe('PointService', () => {
  it('increases points once and replays the original result for a matching key', async () => {
    const { service, state } = createFixture();
    const input = { amount: 25, idempotencyKey: 'grant-1', memo: null };
    const first = await service.increase(userUuid, input);
    state.wallet.availablePoints = 80;
    const retry = await service.increase(userUuid, input);

    expect(retry).toEqual(first);
    expect(state.wallet.availablePoints).toBe(80);
    expect(state.pointTransactions).toHaveLength(1);
    expect(state.isolation).toEqual(['READ COMMITTED', 'READ COMMITTED']);
  });

  it('rejects key reuse with a different amount or transaction type', async () => {
    const { service } = createFixture();
    await service.increase(userUuid, { amount: 25, idempotencyKey: 'grant-1', memo: null });
    await expect(service.increase(userUuid, {
      amount: 26, idempotencyKey: 'grant-1', memo: null,
    })).rejects.toBeInstanceOf(PointIdempotencyConflictException);
  });

  it('rejects a reused key with a different memo or original transaction owner/type', async () => {
    const { service, state } = createFixture();
    await service.increase(userUuid, { amount: 25, idempotencyKey: 'grant-1', memo: 'one' });
    await expect(service.increase(userUuid, {
      amount: 25, idempotencyKey: 'grant-1', memo: 'two',
    })).rejects.toBeInstanceOf(PointIdempotencyConflictException);
    state.pointTransactions[0].transactionType = 'EPISODE_UNLOCK';
    await expect(service.increase(userUuid, {
      amount: 25, idempotencyKey: 'grant-1', memo: 'one',
    })).rejects.toBeInstanceOf(PointIdempotencyConflictException);
    state.pointTransactions[0].transactionType = 'ADMIN_ADJUSTMENT';
    state.pointTransactions[0].walletUserId = 8;
    await expect(service.increase(userUuid, {
      amount: 25, idempotencyKey: 'grant-1', memo: 'one',
    })).rejects.toBeInstanceOf(PointIdempotencyConflictException);
  });

  it('maps a concurrent global idempotency-key collision to a conflict', async () => {
    const { service, state } = createFixture();
    state.duplicateKeyConflict = true;
    await expect(service.increase(userUuid, {
      amount: 10, idempotencyKey: 'raced-key', memo: null,
    })).rejects.toBeInstanceOf(PointIdempotencyConflictException);
    expect(state.wallet.availablePoints).toBe(100);
  });

  it('rejects an increase that exceeds the database INT range without writing', async () => {
    const { service, state } = createFixture();
    state.wallet.availablePoints = 2147483640;
    await expect(service.increase(userUuid, {
      amount: 8, idempotencyKey: 'grant-1', memo: null,
    })).rejects.toBeInstanceOf(PointBalanceOverflowException);
    expect(state.pointTransactions).toHaveLength(0);
    expect(state.wallet.availablePoints).toBe(2147483640);
  });

  it('charges the server episode price and links the ledger to a new entitlement', async () => {
    const { service, state } = createFixture();
    const result = await service.purchaseSingle(userUuid, episodeUuid);

    expect(result).toMatchObject({
      episodeUuid,
      chargedPoints: 35,
      availablePoints: 65,
    });
    expect(state.pointTransactions[0]).toMatchObject({
      amount: -35,
      balanceAfter: 65,
      transactionType: 'EPISODE_UNLOCK',
      walletUserId: 7,
    });
    expect(state.entitlements[0]).toMatchObject({
      userId: 7,
      episodeId: 11,
      acquisitionType: 'POINT_PURCHASE',
      unlockTransactionId: 1,
    });
    expect(state.wallet.availablePoints).toBe(65);
    expect(state.walletLock).toBe(true);
    expect(state.episodeLock).toBe(true);
    expect(state.isolation).toEqual(['READ COMMITTED']);
  });

  it('allows an exact-balance purchase and returns an existing entitlement without charging again', async () => {
    const { service, state } = createFixture();
    state.wallet.availablePoints = 35;
    const first = await service.purchaseSingle(userUuid, episodeUuid);
    state.episode.pricePoints = 90;
    const retry = await service.purchaseSingle(userUuid, episodeUuid);

    expect(first.availablePoints).toBe(0);
    expect(retry).toEqual({
      episodeUuid,
      entitlementUuid: first.entitlementUuid,
      chargedPoints: 0,
      availablePoints: 0,
    });
    expect(state.pointTransactions).toHaveLength(1);
    expect(state.entitlements).toHaveLength(1);
  });

  it('does not create a ledger or entitlement for a free episode', async () => {
    const { service, state } = createFixture();
    state.episode.pricePoints = 0;
    expect(await service.purchaseSingle(userUuid, episodeUuid)).toEqual({
      episodeUuid,
      entitlementUuid: null,
      chargedPoints: 0,
      availablePoints: 100,
    });
    expect(state.pointTransactions).toHaveLength(0);
    expect(state.entitlements).toHaveLength(0);
  });

  it('returns 404 for an unavailable episode and makes no writes', async () => {
    const { service, state } = createFixture();
    state.episode = null;
    await expect(service.purchaseSingle(userUuid, episodeUuid)).rejects.toBeInstanceOf(PointEpisodeNotFoundException);
    expect(state.pointTransactions).toHaveLength(0);
    expect(state.entitlements).toHaveLength(0);
    expect(state.wallet.availablePoints).toBe(100);
  });

  it('returns 404 for hidden and future scheduled content', async () => {
    const cases = [
      (state: ReturnType<typeof createFixture>['state']) => { state.episode!.status = 'HIDDEN'; },
      (state: ReturnType<typeof createFixture>['state']) => { state.episode!.publishedAt = null; },
      (state: ReturnType<typeof createFixture>['state']) => {
        state.episode!.publishedAt = new Date(Date.now() + 60_000);
      },
      (state: ReturnType<typeof createFixture>['state']) => { state.dramaStatus = 'HIDDEN'; },
      (state: ReturnType<typeof createFixture>['state']) => { state.dramaPublishedAt = null; },
      (state: ReturnType<typeof createFixture>['state']) => {
        state.dramaPublishedAt = new Date(Date.now() + 60_000);
      },
    ];
    for (const makeUnavailable of cases) {
      const { service, state } = createFixture();
      makeUnavailable(state);
      await expect(service.purchaseSingle(userUuid, episodeUuid))
        .rejects.toBeInstanceOf(PointEpisodeNotFoundException);
      expect(state.pointTransactions).toHaveLength(0);
      expect(state.wallet.availablePoints).toBe(100);
    }
  });

  it('rejects insufficient points and rolls back when entitlement storage fails', async () => {
    const insufficient = createFixture();
    insufficient.state.wallet.availablePoints = 34;
    await expect(insufficient.service.purchaseSingle(userUuid, episodeUuid))
      .rejects.toBeInstanceOf(InsufficientPointsException);
    expect(insufficient.state.pointTransactions).toHaveLength(0);

    const failed = createFixture();
    failed.state.failEntitlementInsert = true;
    await expect(failed.service.purchaseSingle(userUuid, episodeUuid)).rejects.toThrow();
    expect(failed.state.pointTransactions).toHaveLength(0);
    expect(failed.state.wallet.availablePoints).toBe(100);
  });

  it('serializes concurrent purchases against the latest wallet balance', async () => {
    const { service, state } = createFixture();
    state.wallet.availablePoints = 50;
    const results = await Promise.allSettled([
      service.purchaseSingle(userUuid, episodeUuid),
      service.purchaseSingle(userUuid, '00000020-0000-4000-8000-000000000002'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(state.wallet.availablePoints).toBe(15);
    expect(state.pointTransactions).toHaveLength(1);
  });

  it('charges only once for concurrent requests for the same episode', async () => {
    const { service, state } = createFixture();
    const results = await Promise.all([
      service.purchaseSingle(userUuid, episodeUuid),
      service.purchaseSingle(userUuid, episodeUuid),
    ]);

    expect(results.map(({ chargedPoints }) => chargedPoints).sort()).toEqual([0, 35]);
    expect(results[0].entitlementUuid).toBe(results[1].entitlementUuid);
    expect(state.wallet.availablePoints).toBe(65);
    expect(state.pointTransactions).toHaveLength(1);
    expect(state.entitlements).toHaveLength(1);
  });
});
