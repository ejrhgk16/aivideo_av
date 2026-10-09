import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Drama } from '../content/entities/drama.entity.js';
import { DramaGenre } from '../content/entities/dramaGenre.entity.js';
import { DramaImage } from '../content/entities/dramaImage.entity.js';
import { Episode } from '../content/entities/episode.entity.js';
import { Genre } from '../content/entities/genre.entity.js';
import { ProductionCompany } from '../content/entities/productionCompany.entity.js';
import { CollectionDrama } from './entities/collectionDrama.entity.js';
import { ContentCollection } from './entities/contentCollection.entity.js';

type ImageKind = 'POSTER' | 'HERO' | 'THUMBNAIL';

export interface PublicDramaSummary {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  productionCompany: { id: string; name: string } | null;
  genres: Array<{ id: number; code: string; name: string }>;
  images: Record<ImageKind, string | null>;
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
    @InjectRepository(DramaImage)
    private readonly dramaImageRepository: Repository<DramaImage>,
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
    const [companies, dramaGenres, genres, images, episodes] = publicDramaIds.length
      ? await Promise.all([
          this.productionCompanyRepository.find({
            where: { id: In(publicDramas.map(({ productionCompanyId }) => productionCompanyId)) },
          }),
          this.dramaGenreRepository.find({ where: { dramaId: In(publicDramaIds) } }),
          this.genreRepository.find(),
          this.dramaImageRepository.find({ where: { dramaId: In(publicDramaIds) } }),
          this.episodeRepository.find({ where: { dramaId: In(publicDramaIds) } }),
        ])
      : [[], [], [], [], []];

    const companiesById = new Map(companies.map((company) => [company.id, company]));
    const genresById = new Map(genres.map((genre) => [genre.id, genre]));
    const genreIdsByDrama = new Map<string, number[]>();
    for (const dramaGenre of dramaGenres) {
      const dramaGenreIds = genreIdsByDrama.get(dramaGenre.dramaId) ?? [];
      dramaGenreIds.push(dramaGenre.genreId);
      genreIdsByDrama.set(dramaGenre.dramaId, dramaGenreIds);
    }

    const imagesByDrama = new Map<string, Partial<Record<ImageKind, string>>>();
    for (const image of images) {
      const dramaImages = imagesByDrama.get(image.dramaId) ?? {};
      dramaImages[image.kind as ImageKind] = image.storageKey;
      imagesByDrama.set(image.dramaId, dramaImages);
    }

    const episodesByDrama = new Map<string, Episode[]>();
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
      const dramaImages = imagesByDrama.get(drama.id) ?? {};
      return [
        {
          displayOrder: scheduledDrama.displayOrder,
          id: drama.id,
          slug: drama.publicSlug,
          title: drama.title,
          shortDescription: drama.shortDescription,
          productionCompany: companiesById.has(drama.productionCompanyId)
            ? {
                id: drama.productionCompanyId,
                name: companiesById.get(drama.productionCompanyId)!.name,
              }
            : null,
          genres: (genreIdsByDrama.get(drama.id) ?? []).flatMap((genreId) => {
            const genre = genresById.get(genreId);
            return genre ? [{ id: genre.id, code: genre.code, name: genre.name }] : [];
          }),
          images: {
            POSTER: dramaImages.POSTER ?? null,
            HERO: dramaImages.HERO ?? null,
            THUMBNAIL: dramaImages.THUMBNAIL ?? null,
          },
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
