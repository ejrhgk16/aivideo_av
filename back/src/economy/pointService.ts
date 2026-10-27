import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import { Drama, Episode } from '../content/entities/index.js';
import { User } from '../identity/entities/index.js';
import { EpisodeEntitlement, PointTransaction, Wallet } from './entities/index.js';
import {
  InsufficientPointsException,
  PointBalanceOverflowException,
  PointEpisodeNotFoundException,
  PointIdempotencyConflictException,
  PointUserNotFoundException,
  PointWalletNotFoundException,
} from '../common/error/error.customExceptions.js';

export interface IncreasePointsInput {
  amount: number;
  idempotencyKey: string;
  memo: string | null;
}

const MAX_POINTS = 2147483647;

@Injectable()
export class PointService {
  constructor(private readonly dataSource: DataSource) {}

  async increase(userUuid: string, input: IncreasePointsInput) {
    try {
      return await this.dataSource.transaction('READ COMMITTED', async (manager) => {
        const user = await manager.getRepository(User).findOneBy({ uuid: userUuid });
        if (!user) throw new PointUserNotFoundException();
        const wallet = await this.findLockedWallet(manager, user.id);
        const transactions = manager.getRepository(PointTransaction);
        const previous = await transactions.findOneBy({ idempotencyKey: input.idempotencyKey });

        if (previous) {
          if (
            previous.walletUserId !== user.id ||
            previous.amount !== input.amount ||
            previous.memo !== input.memo ||
            previous.transactionType !== 'ADMIN_ADJUSTMENT'
          ) {
            throw new PointIdempotencyConflictException();
          }
          return {
            uuid: previous.uuid,
            amount: previous.amount,
            balanceAfter: previous.balanceAfter,
          };
        }

        const balanceAfter = wallet.availablePoints + input.amount;
        if (balanceAfter > MAX_POINTS) {
          throw new PointBalanceOverflowException();
        }

        const transaction = {
          uuid: randomUUID(),
          walletUserId: user.id,
          transactionType: 'ADMIN_ADJUSTMENT',
          amount: input.amount,
          balanceAfter,
          idempotencyKey: input.idempotencyKey,
          memo: input.memo,
        };
        await transactions.insert(transaction);
        await manager.getRepository(Wallet).update(
          { userId: user.id },
          { availablePoints: balanceAfter },
        );
        return { uuid: transaction.uuid, amount: transaction.amount, balanceAfter };
      });
    } catch (error) {
      if (this.isIdempotencyKeyConflict(error)) {
        throw new PointIdempotencyConflictException();
      }
      throw error;
    }
  }

  async purchaseSingle(userUuid: string, episodeUuid: string) {
    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      const user = await manager.getRepository(User).findOneBy({ uuid: userUuid });
      if (!user) throw new PointUserNotFoundException();
      const wallet = await this.findLockedWallet(manager, user.id);
      const episode = await manager
        .getRepository(Episode)
        .createQueryBuilder('episode')
        .innerJoin(Drama, 'drama', 'drama.id = episode.dramaId')
        .where('episode.uuid = :episodeUuid', { episodeUuid })
        .andWhere('episode.status = :status AND drama.status = :status', {
          status: 'PUBLISHED',
        })
        .andWhere('episode.publishedAt <= :now AND drama.publishedAt <= :now', {
          now: new Date(),
        })
        .setLock('pessimistic_read')
        .getOne();

      if (!episode) throw new PointEpisodeNotFoundException();

      const entitlements = manager.getRepository(EpisodeEntitlement);
      const existing = await entitlements.findOneBy({
        userId: user.id,
        episodeId: episode.id,
      });
      if (existing || episode.pricePoints === 0) {
        return {
          episodeUuid,
          entitlementUuid: existing?.uuid ?? null,
          chargedPoints: 0,
          availablePoints: wallet.availablePoints,
        };
      }

      const price = episode.pricePoints;
      if (wallet.availablePoints < price) {
        throw new InsufficientPointsException();
      }

      const availablePoints = wallet.availablePoints - price;
      const transactions = manager.getRepository(PointTransaction);
      const transaction = await transactions.save(
        transactions.create({
          uuid: randomUUID(),
          walletUserId: user.id,
          transactionType: 'EPISODE_UNLOCK',
          amount: -price,
          balanceAfter: availablePoints,
          idempotencyKey: `episode-purchase:${randomUUID()}`,
          memo: null,
        }),
      );
      const entitlementUuid = randomUUID();
      await entitlements.insert({
        uuid: entitlementUuid,
        userId: user.id,
        episodeId: episode.id,
        acquisitionType: 'POINT_PURCHASE',
        unlockTransactionId: transaction.id,
      });
      await manager.getRepository(Wallet).update(
        { userId: user.id },
        { availablePoints },
      );

      return { episodeUuid, entitlementUuid, chargedPoints: price, availablePoints };
    });
  }

  private async findLockedWallet(manager: EntityManager, userId: number) {
    const wallet = await manager.getRepository(Wallet).findOne({
      where: { userId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!wallet) throw new PointWalletNotFoundException();
    return wallet;
  }

  private isIdempotencyKeyConflict(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const driverError = 'driverError' in error ? error.driverError : error;
    if (!driverError || typeof driverError !== 'object') return false;
    const candidate = driverError as { code?: string; message?: string; sqlMessage?: string };
    return (
      candidate.code === 'ER_DUP_ENTRY' &&
      /idempotency_key/i.test(`${candidate.message ?? ''} ${candidate.sqlMessage ?? ''}`)
    );
  }
}
