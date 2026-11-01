import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ContentVideo } from '../content/entities/contentVideo.entity.js';
import { ContentImage } from '../content/entities/contentImage.entity.js';
import { Drama } from '../content/entities/drama.entity.js';
import { Episode } from '../content/entities/episode.entity.js';
import { User } from '../identity/entities/user.entity.js';
import { UserSavedVideo } from './entities/userSavedVideo.entity.js';
import { createDramaImageUrls } from '../content/mediaUrl.js';

export type SavedContentType = 'EPISODE' | 'PREVIEW';
type SavedRow = {
  videoUuid: string;
  contentType: SavedContentType;
  savedAt: Date;
  durationMs: number | string;
  dramaUuid: string;
  dramaTitle: string;
  episodeUuid: string | null;
  episodeNumber: number | string | null;
  episodeTitle: string | null;
  imageKey: string | null;
};
type SavedVideoBase = {
  videoUuid: string;
  savedAt: string;
  dramaUuid: string;
  dramaTitle: string;
  imageUrl: string | null;
  durationMs: number;
};
type SavedVideoItem = SavedVideoBase & (
  | { contentType: 'PREVIEW'; episodeUuid: null; episodeNumber: null; episodeTitle: null }
  | { contentType: 'EPISODE'; episodeUuid: string; episodeNumber: number; episodeTitle: string | null }
);
export type SavedVideoPage = {
  items: SavedVideoItem[];
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
      .addSelect('video.durationMs', 'durationMs')
      .addSelect('saved.contentType', 'contentType')
      .addSelect('saved.savedAt', 'savedAt')
      .addSelect('drama.uuid', 'dramaUuid')
      .addSelect('drama.title', 'dramaTitle')
      .addSelect('episode.uuid', 'episodeUuid')
      .addSelect('episode.episodeNumber', 'episodeNumber')
      .addSelect('episode.title', 'episodeTitle')
      .addSelect(sub => sub.select('image.storageKey').from(ContentImage, 'image')
        .where("image.contentType = 'DRAMA' AND image.contentId = drama.id")
        .andWhere("image.kind IN ('POSTER_LANDSCAPE', 'POSTER')")
        .orderBy("CASE image.kind WHEN 'POSTER_LANDSCAPE' THEN 0 ELSE 1 END", 'ASC')
        .addOrderBy('image.displayOrder', 'ASC')
        .limit(1), 'imageKey')
      .orderBy('saved.savedAt', 'DESC')
      .addOrderBy('saved.videoId', 'DESC')
      .offset((page - 1) * 30)
      .limit(31)
      .getRawMany<SavedRow>();
    return {
      items: rows.slice(0, 30).map(row => {
        const base: SavedVideoBase = {
          videoUuid: row.videoUuid,
          savedAt: row.savedAt.toISOString(),
          dramaUuid: row.dramaUuid,
          dramaTitle: row.dramaTitle,
          imageUrl: createDramaImageUrls({
            poster: row.imageKey, posterLandscape: null, homeHero: null,
            detailCover: null, campaigns: [],
          }).poster,
          durationMs: Number(row.durationMs),
        };
        return row.contentType === 'PREVIEW'
          ? { ...base, contentType: 'PREVIEW', episodeUuid: null, episodeNumber: null, episodeTitle: null }
          : { ...base, contentType: 'EPISODE', episodeUuid: row.episodeUuid!,
            episodeNumber: Number(row.episodeNumber), episodeTitle: row.episodeTitle };
      }),
      page,
      hasNext: rows.length > 30,
    };
  }
}
