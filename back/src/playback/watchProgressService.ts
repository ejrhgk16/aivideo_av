import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Drama } from '../content/entities/drama.entity.js';
import { Episode } from '../content/entities/episode.entity.js';
import { ContentVideo } from '../content/entities/contentVideo.entity.js';
import { EpisodeEntitlement } from '../economy/entities/episodeEntitlement.entity.js';
import { EpisodeAccessDeniedException } from '../common/error/error.customExceptions.js';
import { User } from '../identity/entities/user.entity.js';

type WatchProgressInput = { event: 'STARTED' | 'COMPLETED'; positionMs: number };

type VideoPlaybackRow = {
  userId: number;
  videoId: number;
  durationMs: number | string;
  pricePoints: number | string | null;
  entitlementId: number | null;
};

@Injectable()
export class WatchProgressService {
  constructor(private readonly dataSource: DataSource) {}

  async save(userUuid: string, videoUuid: string, input: WatchProgressInput): Promise<void> {
    const row = await this.dataSource.createQueryBuilder()
      .from(ContentVideo, 'video')
      .leftJoin(Episode, 'episode',
        "video.contentType = 'EPISODE' AND video.kind = 'FULL' AND episode.id = video.contentId")
      .innerJoin(Drama, 'drama',
        "((video.contentType = 'EPISODE' AND video.kind = 'FULL' AND drama.id = episode.dramaId) OR " +
        "(video.contentType = 'DRAMA' AND video.kind = 'PREVIEW' AND drama.id = video.contentId))")
      .innerJoin(User, 'appUser', 'appUser.uuid = :userUuid', { userUuid })
      .leftJoin(EpisodeEntitlement, 'entitlement',
        'entitlement.userId = appUser.id AND entitlement.episodeId = episode.id')
      .select('appUser.id', 'userId')
      .addSelect('video.id', 'videoId')
      .addSelect('video.durationMs', 'durationMs')
      .addSelect('episode.pricePoints', 'pricePoints')
      .addSelect('entitlement.id', 'entitlementId')
      .where('video.uuid = :videoUuid', { videoUuid })
      .andWhere("drama.status = 'PUBLISHED' AND drama.publishedAt <= UTC_TIMESTAMP(3)")
      .andWhere("((video.contentType = 'DRAMA' AND video.kind = 'PREVIEW') OR " +
        "(video.contentType = 'EPISODE' AND video.kind = 'FULL' AND " +
        "episode.status = 'PUBLISHED' AND episode.publishedAt <= UTC_TIMESTAMP(3)))")
      .getRawOne<VideoPlaybackRow>();

    if (!row) throw new NotFoundException(`Video '${videoUuid}' was not found`);
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

    // Conditional atomic upsert preserves completion and position for STARTED events.
    await this.dataSource.query(
      `
        INSERT INTO user_watch_progress
          (user_id, video_id, position_ms, is_completed,
           last_played_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))
        ON DUPLICATE KEY UPDATE
          position_ms = IF(VALUES(is_completed) = 1, VALUES(position_ms), position_ms),
          is_completed = GREATEST(is_completed, VALUES(is_completed)),
          last_played_at = UTC_TIMESTAMP(3),
          updated_at = UTC_TIMESTAMP(3)
      `,
      [row.userId, row.videoId, input.positionMs, Number(completed)],
    );
  }
}
