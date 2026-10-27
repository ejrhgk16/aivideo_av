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
import { createDramaImageUrls } from './mediaUrl.js';
import { S3VideoUrlService } from './s3VideoUrlService.js';

const PUBLIC_STATUS = 'PUBLISHED';

export type DramaSummary = {
  uuid: string;
  slug: string;
  title: string;
  shortDescription: string;
  productionCompany: string | null;
  genres: Array<{ id: number; code: string; name: string }>;
  imageUrls: ReturnType<typeof createDramaImageUrls>;
  previewVideos: Array<{ uuid: string; storageKey: string; durationMs: number }>;
  episodeCount: number;
  freeEpisodeCount: number;
};

export type GenreSummary = Pick<Genre, 'id' | 'code' | 'name'> & { tileImage: string | null };

export type DramaDetail = {
  uuid: string;
  slug: string;
  title: string;
  shortDescription: string;
  synopsis: string;
  productionCompany: string | null;
  genres: Array<{ id: number; code: string; name: string }>;
  imageUrls: ReturnType<typeof createDramaImageUrls>;
  previewVideos: Array<{ uuid: string; storageKey: string; durationMs: number }>;
  episodes: Array<{
    uuid: string;
    episodeNumber: number;
    title: string | null;
    synopsis: string | null;
    durationMs: number;
    pricePoints: number;
    image: string | null;
    isUnlocked: boolean;
    watchProgress: {
      positionMs: number;
      isCompleted: boolean;
      lastPlayedAt: string;
    } | null;
  }>;
};

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

function mapPreviewVideos(videos: ContentVideo[]) {
  return [...videos]
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map(({ uuid, storageKey, durationMs }) => ({ uuid, storageKey, durationMs }));
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

  async listDramas(sort: 'latest' = 'latest', now = new Date()): Promise<DramaSummary[]> {
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
      this.contentVideoRepository.findBy({ contentType: 'DRAMA', contentId: In(dramaIds), kind: 'PREVIEW' }),
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
    const videosByDrama = new Map<number, ContentVideo[]>();
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

  async getDrama(dramaId: string, now = new Date(), userUuid?: string): Promise<DramaDetail> {
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
    };

    const episodeQuery = this.episodeRepository.createQueryBuilder('episode')
      .leftJoin(EpisodeEntitlement, 'entitlement',
        'entitlement.episodeId = episode.id AND entitlement.userId = :userId',
        { userId })
      .leftJoin(UserWatchProgress, 'progress',
        'progress.episodeId = episode.id AND progress.userId = :userId',
        { userId })
      .select('episode.id', 'id')
      .addSelect('episode.uuid', 'uuid')
      .addSelect('episode.episodeNumber', 'episodeNumber')
      .addSelect('episode.title', 'title')
      .addSelect('episode.synopsis', 'synopsis')
      .addSelect('episode.durationMs', 'durationMs')
      .addSelect('episode.pricePoints', 'pricePoints')
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
      this.contentVideoRepository.findBy({ contentType: 'DRAMA', contentId: drama.id, kind: 'PREVIEW' }),
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
        ({ id, uuid, episodeNumber, title, synopsis, durationMs, pricePoints, unlocked,
          progressEpisodeId, positionMs, isCompleted, lastPlayedAt }) => ({
          uuid,
          episodeNumber,
          title,
          synopsis,
          durationMs,
          pricePoints,
          image: episodeImagesById.get(id) ?? null,
          isUnlocked: Number(unlocked) === 1,
          watchProgress: progressEpisodeId === null ? null : {
            positionMs: Number(positionMs),
            isCompleted: Number(isCompleted) === 1,
            lastPlayedAt: lastPlayedAt!.toISOString(),
          },
        }),
      ),
    };
  }

  private async getEpisodeVideo(episodeId: string, now: Date): Promise<{ storageKey: string; title: string | null; episodeNumber: number; durationMs: number }> {
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
      .select('video.storageKey', 'storageKey')
      .addSelect('video.durationMs', 'durationMs')
      .addSelect('episode.title', 'title')
      .addSelect('episode.episodeNumber', 'episodeNumber')
      .where('episode.uuid = :episodeUuid', { episodeUuid: episodeId })
      .andWhere('episode.status = :episodeStatus', { episodeStatus: PUBLIC_STATUS })
      .andWhere('episode.publishedAt <= :now', { now })
      .orderBy('video.displayOrder', 'ASC')
      .limit(1)
      .getRawOne<{ storageKey: string; title: string | null; episodeNumber: number; durationMs: number }>();

    if (!video) throw new NotFoundException(`Episode '${episodeId}' was not found`);
    return video;
  }

  async getEpisodePlaybackUrl(episodeId: string, now = new Date()): Promise<{ url: string; title: string | null; episodeNumber: number; durationMs: number }> {
    if (process.env.NODE_ENV !== 'development') throw new NotFoundException(`Episode '${episodeId}' was not found`);
    const { storageKey, title, episodeNumber, durationMs } = await this.getEpisodeVideo(episodeId, now);
    const url = await this.s3VideoUrlService.createSignedGetUrl(storageKey);
    return { url, title, episodeNumber, durationMs };
  }

  async getDramaPreviewPlaybackUrl(dramaId: string, videoId: string): Promise<{ url: string; durationMs: number }> {
    if (process.env.NODE_ENV !== 'development') throw new NotFoundException();

    const drama = await this.dramaRepository.findOne({ where: { uuid: dramaId, status: PUBLIC_STATUS } });
    if (!drama || drama.publishedAt === null || drama.publishedAt > new Date()) {
      throw new NotFoundException();
    }

    const video = await this.contentVideoRepository.findOne({
      where: { uuid: videoId, contentType: 'DRAMA', contentId: drama.id, kind: 'PREVIEW' },
    });
    if (!video) throw new NotFoundException();

    const url = await this.s3VideoUrlService.createSignedGetUrl(video.storageKey);
    return { url, durationMs: video.durationMs };
  }

  async listGenres(): Promise<GenreSummary[]> {
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
