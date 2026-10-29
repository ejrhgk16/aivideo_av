import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Drama } from '../content/entities/drama.entity.js';
import { Episode } from '../content/entities/episode.entity.js';
import { ContentVideo } from '../content/entities/contentVideo.entity.js';
import { EpisodeEntitlement } from '../economy/entities/episodeEntitlement.entity.js';
import { EpisodeAccessDeniedException } from '../common/error/error.customExceptions.js';
import { User } from '../identity/entities/user.entity.js';

type WatchProgressInput = { event: 'STARTED' | 'COMPLETED'; positionMs: number };

type EpisodePlaybackRow = {
  userId: number;
  episodeId: number;
  pricePoints: number | string;
  durationMs: number;
  entitlementId: number | null;
};

@Injectable()
export class WatchProgressService {
  constructor(private readonly dataSource: DataSource) {}

  async save(userUuid: string, episodeUuid: string, input: WatchProgressInput): Promise<void> {
    const row = await this.dataSource.createQueryBuilder()
      .select('appUser.id', 'userId')
      .addSelect('episode.id', 'episodeId')
      .addSelect('episode.pricePoints', 'pricePoints')
      .addSelect('video.durationMs', 'durationMs')
      .addSelect('entitlement.id', 'entitlementId')
      .from(Episode, 'episode')
      .innerJoin(Drama, 'drama',
        'drama.id = episode.dramaId AND drama.status = :dramaStatus AND drama.publishedAt <= UTC_TIMESTAMP(3)',
        { dramaStatus: 'PUBLISHED' })
      .innerJoin(ContentVideo, 'video',
        'video.contentType = :contentType AND video.contentId = episode.id AND video.kind = :kind',
        { contentType: 'EPISODE', kind: 'FULL' })
      .innerJoin(User, 'appUser', 'appUser.uuid = :userUuid', { userUuid })
      .leftJoin(EpisodeEntitlement, 'entitlement',
        'entitlement.userId = appUser.id AND entitlement.episodeId = episode.id')
      .where('episode.uuid = :episodeUuid', { episodeUuid })
      .andWhere('episode.status = :episodeStatus', { episodeStatus: 'PUBLISHED' })
      .andWhere('episode.publishedAt <= UTC_TIMESTAMP(3)')
      .orderBy('video.displayOrder', 'ASC')
      .limit(1)
      .getRawOne<EpisodePlaybackRow>();

    if (!row) throw new NotFoundException(`Episode '${episodeUuid}' was not found`);
    if (Number(row.pricePoints) > 0 && row.entitlementId === null) {
      throw new EpisodeAccessDeniedException();
    }

    const durationMs = Number(row.durationMs);
    const completed = input.event === 'COMPLETED';
    if (
      input.positionMs > durationMs ||
      (!completed && input.positionMs !== 0) ||
      (completed && input.positionMs * 3 < durationMs * 2)
    ) {
      throw new BadRequestException('Invalid watch progress');
    }

    await this.dataSource.query(
      `
        INSERT INTO user_watch_progress
          (user_id, episode_id, position_ms, is_completed,
           last_played_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))
        ON DUPLICATE KEY UPDATE
          position_ms = IF(VALUES(is_completed) = 1, VALUES(position_ms), position_ms),
          is_completed = GREATEST(is_completed, VALUES(is_completed)),
          last_played_at = UTC_TIMESTAMP(3),
          updated_at = UTC_TIMESTAMP(3)
      `,
      [row.userId, row.episodeId, input.positionMs, Number(completed)],
    );
  }
}
