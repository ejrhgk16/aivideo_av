import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { ContentImage } from '../content/entities/contentImage.entity.js';
import { ContentVideo } from '../content/entities/contentVideo.entity.js';
import { Drama } from '../content/entities/drama.entity.js';
import { DramaGenre } from '../content/entities/dramaGenre.entity.js';
import { Episode } from '../content/entities/episode.entity.js';
import { Genre } from '../content/entities/genre.entity.js';
import { ProductionCompany } from '../content/entities/productionCompany.entity.js';
import { CollectionDrama } from './entities/collectionDrama.entity.js';
import { ContentCollection } from './entities/contentCollection.entity.js';
import { createDramaImageUrls } from '../content/mediaUrl.js';

type PublicPreviewVideo = {
  uuid: string;
  storageKey: string;
  durationMs: number;
};

export interface PublicDramaSummary {
  uuid: string;
  slug: string;
  title: string;
  shortDescription: string;
  productionCompany: { uuid: string; name: string } | null;
  genres: Array<{ id: number; code: string; name: string }>;
  imageUrls: ReturnType<typeof createDramaImageUrls>;
  previewVideos: PublicPreviewVideo[];
  publishedEpisodeCount: number;
  freeEpisodeCount: number;
}

export interface PublicCollectionItem extends PublicDramaSummary {
  displayOrder: number;
}

export interface PublicCollectionResponse {
  code: string;
  title: string;
  description: string | null;
  dramas: PublicCollectionItem[];
}

@Injectable()
export class PublicCollectionService {
  constructor(
    @InjectRepository(ContentCollection)
    private readonly collectionRepository: Repository<ContentCollection>,
    @InjectRepository(CollectionDrama)
    private readonly collectionDramaRepository: Repository<CollectionDrama>,
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
  ) {}

  async getCollection(code: string): Promise<PublicCollectionResponse> {
    const collection = await this.collectionRepository.findOne({
      where: { code, isActive: true },
    });

    if (!collection) {
      throw new NotFoundException(`Content collection '${code}' was not found`);
    }

    const now = new Date();
    const scheduledDramas = (
      await this.collectionDramaRepository.find({
        where: { collectionId: collection.id },
        order: { displayOrder: 'ASC' },
      })
    ).filter(
      ({ startsAt, endsAt }) =>
        (startsAt === null || startsAt <= now) &&
        (endsAt === null || endsAt > now),
    );

    const dramaIds = scheduledDramas.map(({ dramaId }) => dramaId);
    const dramas = dramaIds.length
      ? await this.dramaRepository.find({ where: { id: In(dramaIds) } })
      : [];
    const publicDramas = dramas.filter(
      ({ status, publishedAt }) =>
        status === 'PUBLISHED' && publishedAt !== null && publishedAt <= now,
    );

    const publicDramaIds = publicDramas.map(({ id }) => id);
    const [companies, dramaGenres, genres, images, videos, episodes] = publicDramaIds.length
      ? await Promise.all([
          this.productionCompanyRepository.find({
            where: { id: In(publicDramas.map(({ productionCompanyId }) => productionCompanyId)) },
          }),
          this.dramaGenreRepository.find({ where: { dramaId: In(publicDramaIds) } }),
          this.genreRepository.find(),
          this.contentImageRepository.find({
            where: { contentType: 'DRAMA', contentId: In(publicDramaIds) },
          }),
          this.contentVideoRepository.find({
            where: { contentType: 'DRAMA', contentId: In(publicDramaIds), kind: 'PREVIEW' },
            order: { displayOrder: 'ASC' },
          }),
          this.episodeRepository.find({ where: { dramaId: In(publicDramaIds) } }),
        ])
      : [[], [], [], [], [], []];

    const companiesById = new Map(companies.map((company) => [company.id, company]));
    const genresById = new Map(genres.map((genre) => [genre.id, genre]));
    const genreIdsByDrama = new Map<number, number[]>();
    for (const dramaGenre of dramaGenres) {
      const dramaGenreIds = genreIdsByDrama.get(dramaGenre.dramaId) ?? [];
      dramaGenreIds.push(dramaGenre.genreId);
      genreIdsByDrama.set(dramaGenre.dramaId, dramaGenreIds);
    }

    const imagesByDrama = new Map<number, ContentImage[]>();
    for (const image of images) {
      const dramaImages = imagesByDrama.get(image.contentId) ?? [];
      dramaImages.push(image);
      imagesByDrama.set(image.contentId, dramaImages);
    }

    const previewVideosByDrama = new Map<number, ContentVideo[]>();
    for (const video of videos) {
      const dramaVideos = previewVideosByDrama.get(video.contentId) ?? [];
      dramaVideos.push(video);
      previewVideosByDrama.set(video.contentId, dramaVideos);
    }

    const episodesByDrama = new Map<number, Episode[]>();
    for (const episode of episodes) {
      if (episode.status !== 'PUBLISHED' || episode.publishedAt === null || episode.publishedAt > now) {
        continue;
      }
      const dramaEpisodes = episodesByDrama.get(episode.dramaId) ?? [];
      dramaEpisodes.push(episode);
      episodesByDrama.set(episode.dramaId, dramaEpisodes);
    }

    const dramasById = new Map(publicDramas.map((drama) => [drama.id, drama]));
    const items = scheduledDramas.flatMap((scheduledDrama) => {
      const drama = dramasById.get(scheduledDrama.dramaId);
      if (!drama) {
        return [];
      }

      const dramaEpisodes = episodesByDrama.get(drama.id) ?? [];
      const dramaImages = imagesByDrama.get(drama.id) ?? [];
      const imageByKind = new Map<string, string>();
      const campaignImages: Array<{ displayOrder: number; storageKey: string }> = [];
      for (const image of dramaImages) {
        if (image.kind === 'CAMPAIGN') {
          campaignImages.push({ displayOrder: image.displayOrder, storageKey: image.storageKey });
        } else if (!imageByKind.has(image.kind)) {
          imageByKind.set(image.kind, image.storageKey);
        }
      }
      campaignImages.sort((left, right) => left.displayOrder - right.displayOrder);
      const previewVideos = (previewVideosByDrama.get(drama.id) ?? [])
        .slice()
        .sort((left, right) => left.displayOrder - right.displayOrder);
      return [
        {
          displayOrder: scheduledDrama.displayOrder,
          uuid: drama.uuid,
          slug: drama.publicSlug,
          title: drama.title,
          shortDescription: drama.shortDescription,
          productionCompany: companiesById.has(drama.productionCompanyId)
            ? {
                uuid: companiesById.get(drama.productionCompanyId)!.uuid,
                name: companiesById.get(drama.productionCompanyId)!.name,
              }
            : null,
          genres: (genreIdsByDrama.get(drama.id) ?? []).flatMap((genreId) => {
            const genre = genresById.get(genreId);
            return genre ? [{ id: genre.id, code: genre.code, name: genre.name }] : [];
          }),
          imageUrls: createDramaImageUrls({
            poster: imageByKind.get('POSTER') ?? null,
            posterLandscape: imageByKind.get('POSTER_LANDSCAPE') ?? null,
            homeHero: imageByKind.get('HOME_HERO') ?? null,
            detailCover: imageByKind.get('DETAIL_COVER') ?? null,
            campaigns: campaignImages.map(({ storageKey }) => storageKey),
          }),
          previewVideos: previewVideos.map(({ uuid, storageKey, durationMs }) => ({ uuid, storageKey, durationMs })),
          publishedEpisodeCount: dramaEpisodes.length,
          freeEpisodeCount: dramaEpisodes.filter(({ pricePoints }) => pricePoints === 0).length,
        },
      ];
    });

    return {
      code: collection.code,
      title: collection.title,
      description: collection.description,
      dramas: items,
    };
  }
}
