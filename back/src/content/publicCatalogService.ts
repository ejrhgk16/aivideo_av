import { Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Drama } from './entities/drama.entity.js';
import { DramaGenre } from './entities/dramaGenre.entity.js';
import { ContentImage } from './entities/contentImage.entity.js';
import { ContentVideo } from './entities/contentVideo.entity.js';
import { Episode } from './entities/episode.entity.js';
import { Genre } from './entities/genre.entity.js';
import { ProductionCompany } from './entities/productionCompany.entity.js';
import { EpisodeEntitlement } from '../economy/entities/episodeEntitlement.entity.js';
import { User } from '../identity/entities/user.entity.js';
import { UserWatchProgress } from '../playback/entities/userWatchProgress.entity.js';
import { UserSavedVideo } from '../playback/entities/userSavedVideo.entity.js';
import { createDramaImageUrls } from './mediaUrl.js';
import type {
  DramaDetailResponse,
  DramaSummaryResponse,
  EpisodePlaybackResponse,
  GenreResponse,
  PreviewPlaybackResponse,
} from './contentResponses.js';
import { S3VideoUrlService } from './s3VideoUrlService.js';
import { EpisodeAccessDeniedException, InvalidTokenException } from '../common/error/error.customExceptions.js';

const PUBLIC_STATUS = 'PUBLISHED';

function mapImages(images: ContentImage[]) {
  const sorted = [...images].sort((left, right) => left.displayOrder - right.displayOrder);
  const firstOfKind = (kind: string) => sorted.find((image) => image.kind === kind)?.storageKey ?? null;

  const imageKeys = {
    poster: firstOfKind('POSTER'),
    posterLandscape: firstOfKind('POSTER_LANDSCAPE'),
    homeHero: firstOfKind('HOME_HERO'),
    detailCover: firstOfKind('DETAIL_COVER'),
    campaigns: sorted.filter((image) => image.kind === 'CAMPAIGN').map((image) => image.storageKey),
  };
  return imageKeys;
}

type PreviewVideo = Pick<ContentVideo, 'uuid' | 'contentId' | 'storageKey' | 'durationMs' | 'displayOrder'> & {
  isSaved: boolean;
};

type PreviewVideoRow = Omit<PreviewVideo, 'isSaved'> & { isSaved: number | string };

function mapPreviewVideos(videos: PreviewVideo[]) {
  return [...videos]
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map(({ uuid, storageKey, durationMs, isSaved }) => ({ uuid, storageKey, durationMs, isSaved }));
}

export class PublicCatalogService {
  constructor(
    @InjectRepository(Drama)
    private readonly dramaRepository: Repository<Drama>,
    @InjectRepository(ProductionCompany)
    private readonly productionCompanyRepository: Repository<ProductionCompany>,
    @InjectRepository(DramaGenre)
    private readonly dramaGenreRepository: Repository<DramaGenre>,
    @InjectRepository(Genre)
    private readonly genreRepository: Repository<Genre>,
    @InjectRepository(ContentImage)
    private readonly contentImageRepository: Repository<ContentImage>,
    @InjectRepository(ContentVideo)
    private readonly contentVideoRepository: Repository<ContentVideo>,
    @InjectRepository(Episode)
    private readonly episodeRepository: Repository<Episode>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(S3VideoUrlService)
    private readonly s3VideoUrlService = new S3VideoUrlService(),
  ) {}

  private async findPreviewVideos(dramaIds: number[], userUuid?: string): Promise<PreviewVideo[]> {
    if (dramaIds.length === 0) return [];
    const rows = await this.contentVideoRepository.createQueryBuilder('video')
      .leftJoin(User, 'viewer', 'viewer.uuid = :userUuid', { userUuid: userUuid ?? null })
      .leftJoin(UserSavedVideo, 'saved',
        "saved.videoId = video.id AND saved.userId = viewer.id AND saved.contentType = 'PREVIEW'")
      .select('video.uuid', 'uuid')
      .addSelect('video.contentId', 'contentId')
      .addSelect('video.storageKey', 'storageKey')
      .addSelect('video.durationMs', 'durationMs')
      .addSelect('video.displayOrder', 'displayOrder')
      .addSelect('CASE WHEN saved.videoId IS NULL THEN 0 ELSE 1 END', 'isSaved')
      .where("video.contentType = 'DRAMA' AND video.kind = 'PREVIEW'")
      .andWhere('video.contentId IN (:...dramaIds)', { dramaIds })
      .orderBy('video.displayOrder', 'ASC')
      .getRawMany<PreviewVideoRow>();
    return rows.map((row) => ({ ...row, isSaved: Number(row.isSaved) === 1 }));
  }

  async listDramas(sort: 'latest' = 'latest', now = new Date(), userUuid?: string): Promise<DramaSummaryResponse[]> {
    if (sort !== 'latest') {
      return [];
    }

    const dramas = await this.dramaRepository
      .createQueryBuilder('drama')
      .where('drama.status = :status', { status: PUBLIC_STATUS })
      .andWhere('drama.publishedAt <= :now', { now })
      .orderBy('drama.publishedAt', 'DESC')
      .getMany();

    if (dramas.length === 0) {
      return [];
    }

    const dramaIds = dramas.map((drama) => drama.id);
    const [companies, dramaGenres, genres, images, videos, episodes] = await Promise.all([
      this.productionCompanyRepository.findBy({ id: In(dramas.map((drama) => drama.productionCompanyId)) }),
      this.dramaGenreRepository.findBy({ dramaId: In(dramaIds) }),
      this.genreRepository.find({ order: { displayOrder: 'ASC' } }),
      this.contentImageRepository.findBy({ contentType: 'DRAMA', contentId: In(dramaIds) }),
      this.findPreviewVideos(dramaIds, userUuid),
      this.episodeRepository.findBy({ dramaId: In(dramaIds) }),
    ]);

    const companiesById = new Map(companies.map((company) => [company.id, company.name]));
    const genresById = new Map(genres.map((genre) => [genre.id, genre]));
    const genreLinksByDrama = new Map<number, DramaGenre[]>();
    for (const link of dramaGenres) {
      const links = genreLinksByDrama.get(link.dramaId) ?? [];
      links.push(link);
      genreLinksByDrama.set(link.dramaId, links);
    }
    const imagesByDrama = new Map<number, ContentImage[]>();
    for (const image of images) {
      const dramaImages = imagesByDrama.get(image.contentId) ?? [];
      dramaImages.push(image);
      imagesByDrama.set(image.contentId, dramaImages);
    }
    const videosByDrama = new Map<number, PreviewVideo[]>();
    for (const video of videos) {
      const dramaVideos = videosByDrama.get(video.contentId) ?? [];
      dramaVideos.push(video);
      videosByDrama.set(video.contentId, dramaVideos);
    }
    const episodesByDrama = new Map<number, Episode[]>();
    for (const episode of episodes) {
      if (episode.status !== PUBLIC_STATUS || episode.publishedAt === null || episode.publishedAt > now) {
        continue;
      }
      const dramaEpisodes = episodesByDrama.get(episode.dramaId) ?? [];
      dramaEpisodes.push(episode);
      episodesByDrama.set(episode.dramaId, dramaEpisodes);
    }

    return dramas.map((drama) => {
      const dramaImages = imagesByDrama.get(drama.id) ?? [];
      const dramaVideos = videosByDrama.get(drama.id) ?? [];
      const dramaEpisodes = episodesByDrama.get(drama.id) ?? [];
      const dramaGenresForDrama = genreLinksByDrama.get(drama.id) ?? [];
      const dramaImagesForResponse = mapImages(dramaImages);

      return {
        uuid: drama.uuid,
        slug: drama.publicSlug,
        title: drama.title,
        shortDescription: drama.shortDescription,
        productionCompany: companiesById.get(drama.productionCompanyId) ?? null,
        genres: dramaGenresForDrama
          .map((link) => genresById.get(link.genreId))
          .filter((genre): genre is Genre => genre !== undefined)
          .map(({ id, code, name }) => ({ id, code, name })),
        imageUrls: createDramaImageUrls(dramaImagesForResponse),
        previewVideos: mapPreviewVideos(dramaVideos),
        episodeCount: dramaEpisodes.length,
        freeEpisodeCount: dramaEpisodes.filter((episode) => episode.pricePoints === 0).length,
      };
    });
  }

  async getDrama(dramaId: string, now = new Date(), userUuid?: string): Promise<DramaDetailResponse> {
    const drama = await this.dramaRepository.findOne({
      where: { uuid: dramaId, status: PUBLIC_STATUS },
    });

    if (
      !drama ||
      drama.status !== PUBLIC_STATUS ||
      drama.publishedAt === null ||
      drama.publishedAt > now
    ) {
      throw new NotFoundException(`Drama '${dramaId}' was not found`);
    }

    const user = userUuid === undefined
      ? null
      : await this.userRepository.findOneBy({ uuid: userUuid });
    if (userUuid !== undefined && user === null) {
      throw new NotFoundException('User not found');
    }
    const userId = user?.id ?? null;

    type DetailEpisodeRow = Pick<Episode,
      'id' | 'uuid' | 'episodeNumber' | 'title' | 'synopsis' | 'durationMs' | 'pricePoints'
    > & {
      unlocked: number | string;
      progressEpisodeId: number | null;
      positionMs: number | string | null;
      isCompleted: number | string | null;
      lastPlayedAt: Date | null;
      videoUuid: string | null;
      isSaved: number | string;
    };

    const episodeQuery = this.episodeRepository.createQueryBuilder('episode')
      .leftJoin(ContentVideo, 'video',
        "video.contentType = 'EPISODE' AND video.contentId = episode.id AND video.kind = 'FULL' AND video.displayOrder = (" +
        "SELECT MIN(full_video.display_order) FROM content_videos full_video " +
        "WHERE full_video.content_type = 'EPISODE' AND full_video.content_id = episode.id AND full_video.kind = 'FULL')")
      .leftJoin(EpisodeEntitlement, 'entitlement',
        'entitlement.episodeId = episode.id AND entitlement.userId = :userId',
        { userId })
      .leftJoin(UserWatchProgress, 'progress',
        'progress.episodeId = episode.id AND progress.userId = :userId',
        { userId })
      .leftJoin(UserSavedVideo, 'saved',
        "saved.videoId = video.id AND saved.userId = :userId AND saved.contentType = 'EPISODE'",
        { userId })
      .select('episode.id', 'id')
      .addSelect('episode.uuid', 'uuid')
      .addSelect('episode.episodeNumber', 'episodeNumber')
      .addSelect('episode.title', 'title')
      .addSelect('episode.synopsis', 'synopsis')
      .addSelect('episode.durationMs', 'durationMs')
      .addSelect('episode.pricePoints', 'pricePoints')
      .addSelect('video.uuid', 'videoUuid')
      .addSelect('CASE WHEN saved.videoId IS NULL THEN 0 ELSE 1 END', 'isSaved')
      .addSelect(
        'CASE WHEN episode.pricePoints = 0 OR entitlement.id IS NOT NULL THEN 1 ELSE 0 END',
        'unlocked',
      )
      .addSelect('progress.episodeId', 'progressEpisodeId')
      .addSelect('progress.positionMs', 'positionMs')
      .addSelect('progress.isCompleted', 'isCompleted')
      .addSelect('progress.lastPlayedAt', 'lastPlayedAt')
      .where('episode.dramaId = :dramaId', { dramaId: drama.id })
      .andWhere('episode.status = :status', { status: PUBLIC_STATUS })
      .andWhere('episode.publishedAt <= :now', { now })
      .orderBy('episode.episodeNumber', 'ASC');

    const [company, dramaGenres, genres, images, videos, episodes] = await Promise.all([
      this.productionCompanyRepository.findOne({ where: { id: drama.productionCompanyId } }),
      this.dramaGenreRepository.findBy({ dramaId: drama.id }),
      this.genreRepository.find({ order: { displayOrder: 'ASC' } }),
      this.contentImageRepository.findBy({ contentType: 'DRAMA', contentId: drama.id }),
      this.findPreviewVideos([drama.id], userUuid),
      episodeQuery.getRawMany<DetailEpisodeRow>(),
    ]);

    const genresById = new Map(genres.map((genre) => [genre.id, genre]));
    const episodeImages = episodes.length === 0
      ? []
      : await this.contentImageRepository.findBy({
        contentType: 'EPISODE',
        contentId: In(episodes.map((episode) => episode.id)),
        kind: 'EPISODE_COVER',
      });
    const episodeImagesById = new Map(episodeImages.map((image) => [image.contentId, image.storageKey]));

    const dramaImages = mapImages(images);
    return {
      uuid: drama.uuid,
      slug: drama.publicSlug,
      title: drama.title,
      shortDescription: drama.shortDescription,
      synopsis: drama.synopsis,
      productionCompany: company?.name ?? null,
      genres: dramaGenres
        .map((link) => genresById.get(link.genreId))
        .filter((genre): genre is Genre => genre !== undefined)
        .map(({ id, code, name }) => ({ id, code, name })),
      imageUrls: createDramaImageUrls(dramaImages),
      previewVideos: mapPreviewVideos(videos),
      episodes: episodes.map(
        ({ id, uuid, episodeNumber, title, synopsis, durationMs, pricePoints, unlocked, videoUuid, isSaved,
          progressEpisodeId, positionMs, isCompleted, lastPlayedAt }) => ({
          uuid,
          episodeNumber,
          title,
          synopsis,
          durationMs,
          pricePoints,
          image: episodeImagesById.get(id) ?? null,
          isUnlocked: Number(unlocked) === 1,
          videoUuid,
          isSaved: Number(isSaved) === 1,
          watchProgress: progressEpisodeId === null ? null : {
            positionMs: Number(positionMs),
            isCompleted: Number(isCompleted) === 1,
            lastPlayedAt: lastPlayedAt!.toISOString(),
          },
        }),
      ),
    };
  }

  private async getEpisodeVideo(episodeId: string, userUuid: string | undefined, now: Date): Promise<{ storageKey: string; videoUuid: string; isSaved: number | string; title: string | null; episodeNumber: number; durationMs: number; userId: number | null; pricePoints: number | string; entitlementId: number | null }> {
    const video = await this.episodeRepository
      .createQueryBuilder('episode')
      .innerJoin(Drama, 'drama', 'drama.id = episode.dramaId AND drama.status = :dramaStatus AND drama.publishedAt <= :now', {
        dramaStatus: PUBLIC_STATUS,
        now,
      })
      .innerJoin(ContentVideo, 'video', 'video.contentType = :contentType AND video.contentId = episode.id AND video.kind = :kind', {
        contentType: 'EPISODE',
        kind: 'FULL',
      })
      .leftJoin(User, 'playbackUser', 'playbackUser.uuid = :userUuid', { userUuid: userUuid ?? null })
      .leftJoin(EpisodeEntitlement, 'entitlement',
        'entitlement.userId = playbackUser.id AND entitlement.episodeId = episode.id')
      .leftJoin(UserSavedVideo, 'saved',
        "saved.videoId = video.id AND saved.userId = playbackUser.id AND saved.contentType = 'EPISODE'")
      .select('video.storageKey', 'storageKey')
      .addSelect('video.uuid', 'videoUuid')
      .addSelect('CASE WHEN saved.videoId IS NULL THEN 0 ELSE 1 END', 'isSaved')
      .addSelect('video.durationMs', 'durationMs')
      .addSelect('episode.title', 'title')
      .addSelect('episode.episodeNumber', 'episodeNumber')
      .addSelect('playbackUser.id', 'userId')
      .addSelect('episode.pricePoints', 'pricePoints')
      .addSelect('entitlement.id', 'entitlementId')
      .where('episode.uuid = :episodeUuid', { episodeUuid: episodeId })
      .andWhere('episode.status = :episodeStatus', { episodeStatus: PUBLIC_STATUS })
      .andWhere('episode.publishedAt <= :now', { now })
      .orderBy('video.displayOrder', 'ASC')
      .limit(1)
      .getRawOne<{
        storageKey: string;
        videoUuid: string;
        isSaved: number | string;
        title: string | null;
        episodeNumber: number;
        durationMs: number;
        userId: number | null;
        pricePoints: number | string;
        entitlementId: number | null;
      }>();

    if (!video) throw new NotFoundException(`Episode '${episodeId}' was not found`);
    if (userUuid !== undefined && video.userId === null) throw new NotFoundException('User not found');
    if (Number(video.pricePoints) !== 0 && userUuid === undefined) {
      throw new InvalidTokenException();
    }
    if (Number(video.pricePoints) !== 0 && video.entitlementId === null) {
      throw new EpisodeAccessDeniedException();
    }
    return video;
  }

  async getEpisodePlaybackUrl(episodeId: string, userUuid?: string, now = new Date()): Promise<EpisodePlaybackResponse> {
    if (process.env.NODE_ENV !== 'development') throw new NotFoundException(`Episode '${episodeId}' was not found`);
    const { storageKey, videoUuid, isSaved, title, episodeNumber, durationMs } = await this.getEpisodeVideo(episodeId, userUuid, now);
    const url = await this.s3VideoUrlService.createSignedGetUrl(storageKey);
    return { url, videoUuid, isSaved: Number(isSaved) === 1, title, episodeNumber, durationMs };
  }

  async getDramaPreviewPlaybackUrl(dramaId: string, videoId: string, userUuid?: string): Promise<PreviewPlaybackResponse> {
    if (process.env.NODE_ENV !== 'development') throw new NotFoundException();

    const video = await this.contentVideoRepository.createQueryBuilder('video')
      .innerJoin(Drama, 'drama',
        "drama.id = video.contentId AND drama.uuid = :dramaUuid AND drama.status = 'PUBLISHED' AND drama.publishedAt <= :now",
        { dramaUuid: dramaId, now: new Date() })
      .leftJoin(User, 'viewer', 'viewer.uuid = :userUuid', { userUuid: userUuid ?? null })
      .leftJoin(UserSavedVideo, 'saved',
        "saved.videoId = video.id AND saved.userId = viewer.id AND saved.contentType = 'PREVIEW'")
      .select('video.uuid', 'videoUuid')
      .addSelect('video.storageKey', 'storageKey')
      .addSelect('video.durationMs', 'durationMs')
      .addSelect('CASE WHEN saved.videoId IS NULL THEN 0 ELSE 1 END', 'isSaved')
      .where("video.uuid = :videoUuid AND video.contentType = 'DRAMA' AND video.kind = 'PREVIEW'", { videoUuid: videoId })
      .getRawOne<{ videoUuid: string; storageKey: string; durationMs: number; isSaved: number | string }>();
    if (!video) throw new NotFoundException();

    const url = await this.s3VideoUrlService.createSignedGetUrl(video.storageKey);
    return { url, videoUuid: video.videoUuid, isSaved: Number(video.isSaved) === 1, durationMs: video.durationMs };
  }

  async listGenres(): Promise<GenreResponse[]> {
    const genres = await this.genreRepository.find({ order: { displayOrder: 'ASC' } });
    const tileImages = await this.contentImageRepository.findBy({
      contentType: 'GENRE',
      kind: 'GENRE_TILE',
    });
    const tileImagesByGenre = new Map(tileImages.map((image) => [image.contentId, image.storageKey]));
    return genres.map(({ id, code, name }) => ({
      id,
      code,
      name,
      tileImage: tileImagesByGenre.get(id) ?? null,
    }));
  }
}
