import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ContentVideo } from '../content/entities/contentVideo.entity.js';
import { Drama } from '../content/entities/drama.entity.js';
import { Episode } from '../content/entities/episode.entity.js';
import { User } from '../identity/entities/user.entity.js';
import { UserSavedVideo } from './entities/userSavedVideo.entity.js';

export type SavedContentType = 'EPISODE' | 'PREVIEW';
type SavedRow = { videoUuid: string; contentType: SavedContentType; savedAt: Date };
export type SavedVideoPage = {
  items: Array<{ videoUuid: string; contentType: SavedContentType; savedAt: string }>;
  page: number;
  hasNext: boolean;
};

@Injectable()
export class SavedVideoService {
  constructor(private readonly dataSource: DataSource) {}

  private publicVideos() {
    return this.dataSource.createQueryBuilder()
      .from(ContentVideo, 'video')
      .leftJoin(Episode, 'episode',
        "video.contentType = 'EPISODE' AND video.kind = 'FULL' AND episode.id = video.contentId")
      .innerJoin(Drama, 'drama',
        "((video.contentType = 'EPISODE' AND video.kind = 'FULL' AND drama.id = episode.dramaId) OR " +
        "(video.contentType = 'DRAMA' AND video.kind = 'PREVIEW' AND drama.id = video.contentId))")
      .where("drama.status = 'PUBLISHED' AND drama.publishedAt <= UTC_TIMESTAMP(3)")
      .andWhere("((video.contentType = 'DRAMA' AND video.kind = 'PREVIEW') OR " +
        "(video.contentType = 'EPISODE' AND video.kind = 'FULL' AND " +
        "episode.status = 'PUBLISHED' AND episode.publishedAt <= UTC_TIMESTAMP(3)))");
  }

  async save(userUuid: string, videoUuid: string, contentType: SavedContentType): Promise<void> {
    const row = await this.publicVideos()
      .innerJoin(User, 'appUser', 'appUser.uuid = :userUuid', { userUuid })
      .select('appUser.id', 'userId')
      .addSelect('video.id', 'videoId')
      .andWhere('video.uuid = :videoUuid', { videoUuid })
      .andWhere(contentType === 'EPISODE'
        ? "video.contentType = 'EPISODE' AND video.kind = 'FULL'"
        : "video.contentType = 'DRAMA' AND video.kind = 'PREVIEW'")
      .getRawOne<{ userId: number; videoId: number }>();
    if (!row) throw new NotFoundException('Saved video target was not found');
    await this.dataSource.createQueryBuilder()
      .insert()
      .into(UserSavedVideo)
      .values({
        userId: row.userId,
        videoId: row.videoId,
        contentType,
        savedAt: () => 'UTC_TIMESTAMP(3)',
      })
      .orUpdate(['video_id'])
      .execute();
  }

  async remove(userUuid: string, videoUuid: string): Promise<void> {
    await this.dataSource.query(
      `DELETE saved FROM user_saved_videos saved
       INNER JOIN users app_user ON app_user.id = saved.user_id
       INNER JOIN content_videos video ON video.id = saved.video_id
       WHERE app_user.uuid = ? AND video.uuid = ?`,
      [userUuid, videoUuid],
    );
  }

  async list(userUuid: string, page: number): Promise<SavedVideoPage> {
    const rows = await this.publicVideos()
      .innerJoin(UserSavedVideo, 'saved', 'saved.videoId = video.id')
      .innerJoin(User, 'appUser', 'appUser.id = saved.userId AND appUser.uuid = :userUuid', { userUuid })
      .andWhere("((saved.contentType = 'EPISODE' AND video.contentType = 'EPISODE' AND video.kind = 'FULL') OR " +
        "(saved.contentType = 'PREVIEW' AND video.contentType = 'DRAMA' AND video.kind = 'PREVIEW'))")
      .select('video.uuid', 'videoUuid')
      .addSelect('saved.contentType', 'contentType')
      .addSelect('saved.savedAt', 'savedAt')
      .orderBy('saved.savedAt', 'DESC')
      .addOrderBy('saved.videoId', 'DESC')
      .offset((page - 1) * 30)
      .limit(31)
      .getRawMany<SavedRow>();
    return {
      items: rows.slice(0, 30).map(row => ({
        videoUuid: row.videoUuid,
        contentType: row.contentType,
        savedAt: row.savedAt.toISOString(),
      })),
      page,
      hasNext: rows.length > 30,
    };
  }
}
