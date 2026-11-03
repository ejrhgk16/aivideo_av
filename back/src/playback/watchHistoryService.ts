import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createPageResponse, getPageWindow } from '../common/pagination/pagination.js';
import { ContentImage } from '../content/entities/contentImage.entity.js';
import { ContentVideo } from '../content/entities/contentVideo.entity.js';
import { Drama } from '../content/entities/drama.entity.js';
import { Episode } from '../content/entities/episode.entity.js';
import { createDramaImageUrls } from '../content/mediaUrl.js';
import { User } from '../identity/entities/user.entity.js';
import { UserWatchProgress } from './entities/userWatchProgress.entity.js';
import type { WatchHistoryBase, WatchHistoryItemResponse, WatchHistoryPageResponse } from './watchHistoryResponses.js';

export const WATCH_HISTORY_PAGE_SIZE = 30;

type HistoryRow = {
  videoUuid: string;
  videoContentType: 'DRAMA' | 'EPISODE';
  lastPlayedAt: Date;
  dramaUuid: string;
  dramaTitle: string;
  imageKey: string | null;
  durationMs: number | string;
  episodeUuid: string | null;
  episodeNumber: number | string | null;
  episodeTitle: string | null;
};

@Injectable()
export class WatchHistoryService {
  constructor(private readonly dataSource: DataSource) {}

  async list(userUuid: string, page: number): Promise<WatchHistoryPageResponse> {
    const { offset, limit } = getPageWindow(page, WATCH_HISTORY_PAGE_SIZE);
    const rows = await this.dataSource.createQueryBuilder()
      .from(UserWatchProgress, 'progress')
      .innerJoin(User, 'appUser', 'appUser.id = progress.userId AND appUser.uuid = :userUuid', { userUuid })
      .innerJoin(ContentVideo, 'video', 'video.id = progress.videoId')
      .leftJoin(Episode, 'episode',
        "video.contentType = 'EPISODE' AND video.kind = 'FULL' AND episode.id = video.contentId")
      .innerJoin(Drama, 'drama',
        "((video.contentType = 'EPISODE' AND video.kind = 'FULL' AND drama.id = episode.dramaId) OR " +
        "(video.contentType = 'DRAMA' AND video.kind = 'PREVIEW' AND drama.id = video.contentId))")
      .where("drama.status = 'PUBLISHED' AND drama.publishedAt <= UTC_TIMESTAMP(3)")
      .andWhere("((video.contentType = 'DRAMA' AND video.kind = 'PREVIEW') OR " +
        "(video.contentType = 'EPISODE' AND video.kind = 'FULL' AND " +
        "episode.status = 'PUBLISHED' AND episode.publishedAt <= UTC_TIMESTAMP(3)))")
      .select('video.uuid', 'videoUuid')
      .addSelect('video.contentType', 'videoContentType')
      .addSelect('progress.lastPlayedAt', 'lastPlayedAt')
      .addSelect('video.durationMs', 'durationMs')
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
      .orderBy('progress.lastPlayedAt', 'DESC')
      .addOrderBy('progress.videoId', 'DESC')
      .offset(offset)
      .limit(limit)
      .getRawMany<HistoryRow>();
    const result = createPageResponse(rows, page, WATCH_HISTORY_PAGE_SIZE);

    return {
      ...result,
      items: result.items.map<WatchHistoryItemResponse>(row => {
        const base: WatchHistoryBase = {
          videoUuid: row.videoUuid,
          lastPlayedAt: new Date(row.lastPlayedAt).toISOString(),
          dramaUuid: row.dramaUuid,
          dramaTitle: row.dramaTitle,
          imageUrl: createDramaImageUrls({
            poster: row.imageKey,
            posterLandscape: null,
            homeHero: null,
            detailCover: null,
            campaigns: [],
          }).poster,
          durationMs: Number(row.durationMs),
        };

        return row.videoContentType === 'DRAMA'
          ? { ...base, contentType: 'PREVIEW', episodeUuid: null, episodeNumber: null, episodeTitle: null }
          : {
            ...base,
            contentType: 'EPISODE',
            episodeUuid: row.episodeUuid!,
            episodeNumber: Number(row.episodeNumber),
            episodeTitle: row.episodeTitle,
          };
      }),
    };
  }
}
